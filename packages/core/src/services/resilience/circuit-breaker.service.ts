/**
 * Circuit Breaker Service
 *
 * Prevents cascading failures by stopping requests to failing services.
 * Implements the Circuit Breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 *
 * Phase 14.2.1
 */

import { LoggerService } from '../../types/legacy';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
  DEFAULT_CIRCUIT_FAILURE_RATE,
  DEFAULT_CIRCUIT_SUCCESS_THRESHOLD,
  DEFAULT_CIRCUIT_TIMEOUT_MS,
  DEFAULT_CIRCUIT_VOLUME_THRESHOLD,
  MAX_CIRCUIT_BREAKERS,
  CIRCUIT_STATE_CLOSED,
  CIRCUIT_STATE_OPEN,
  CIRCUIT_STATE_HALF_OPEN,
} from '../../constants/phase-14-2-constants';

// ============================================================================
// TYPES
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Failure rate (0-1) before opening circuit */
  failureRateThreshold: number;
  /** Number of successes to close from HALF_OPEN */
  successThreshold: number;
  /** Time (ms) before attempting HALF_OPEN from OPEN */
  timeout: number;
  /** Minimum requests before evaluating failure rate */
  volumeThreshold: number;
}

export interface CircuitStats {
  /** Current circuit state */
  state: CircuitState;
  /** Number of consecutive failures */
  failureCount: number;
  /** Number of consecutive successes (in HALF_OPEN) */
  successCount: number;
  /** Total requests since last reset */
  totalRequests: number;
  /** Timestamp of last failure */
  lastFailureTime: number;
  /** Timestamp of last success */
  lastSuccessTime: number;
  /** Timestamp when circuit was opened */
  openedAt: number;
  /** Timestamp when circuit was closed */
  closedAt: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public circuitName: string, public openedAt: number) {
    super(`Circuit breaker [${circuitName}] is OPEN (opened at ${new Date(openedAt).toISOString()})`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class CircuitBreakerService {
  private readonly circuits: Map<string, CircuitStats>;
  private readonly config: CircuitBreakerConfig;

  constructor(
    config?: Partial<CircuitBreakerConfig>,
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    // Validate config OUTSIDE try-catch for THROW to propagate
    if (config?.failureThreshold !== undefined && config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be positive');
    }
    if (config?.failureRateThreshold !== undefined && (config.failureRateThreshold < 0 || config.failureRateThreshold > 1)) {
      throw new Error('failureRateThreshold must be between 0 and 1');
    }
    if (config?.successThreshold !== undefined && config.successThreshold <= 0) {
      throw new Error('successThreshold must be positive');
    }
    if (config?.timeout !== undefined && config.timeout <= 0) {
      throw new Error('timeout must be positive');
    }
    if (config?.volumeThreshold !== undefined && config.volumeThreshold <= 0) {
      throw new Error('volumeThreshold must be positive');
    }

    this.config = {
      failureThreshold: config?.failureThreshold ?? DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
      failureRateThreshold: config?.failureRateThreshold ?? DEFAULT_CIRCUIT_FAILURE_RATE,
      successThreshold: config?.successThreshold ?? DEFAULT_CIRCUIT_SUCCESS_THRESHOLD,
      timeout: config?.timeout ?? DEFAULT_CIRCUIT_TIMEOUT_MS,
      volumeThreshold: config?.volumeThreshold ?? DEFAULT_CIRCUIT_VOLUME_THRESHOLD,
    };

    this.circuits = new Map();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Execute operation with circuit breaker protection
   * @throws CircuitBreakerOpenError if circuit is OPEN
   * @throws Error from operation if it fails
   */
  async execute<T>(operation: () => Promise<T>, name: string): Promise<T> {
    // Validate input OUTSIDE try-catch for THROW to propagate
    if (!name || typeof name !== 'string') {
      throw new Error('Circuit name must be a non-empty string');
    }
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    const circuit = this.getOrCreateCircuit(name);

    // Check if circuit is OPEN
    if (circuit.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset(circuit)) {
        this.transitionToHalfOpen(circuit, name);
      } else {
        throw new CircuitBreakerOpenError(name, circuit.openedAt);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(name);
      return result;
    } catch (error) {
      this.onFailure(name, error);
      throw error;
    }
  }

  /**
   * Get current state of circuit
   */
  getStateSnapshot(name: string): CircuitState {
    const circuit = this.circuits.get(name);
    return circuit?.state ?? CircuitState.CLOSED;
  }

  /**
   * Reset circuit to CLOSED state
   */
  reset(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.totalRequests = 0;
      circuit.closedAt = Date.now();
      this.safeLog('info', `Circuit breaker [${name}] reset to CLOSED`);
    }
  }

  /**
   * Force circuit to OPEN state
   */
  forceOpen(name: string): void {
    const circuit = this.getOrCreateCircuit(name);
    circuit.state = CircuitState.OPEN;
    circuit.openedAt = Date.now();
    this.safeLog('warn', `Circuit breaker [${name}] forced to OPEN`);
  }

  /**
   * Force circuit to CLOSED state
   */
  forceClose(name: string): void {
    const circuit = this.getOrCreateCircuit(name);
    circuit.state = CircuitState.CLOSED;
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.closedAt = Date.now();
    this.safeLog('info', `Circuit breaker [${name}] forced to CLOSED`);
  }

  /**
   * Get circuit statistics
   */
  getStats(name: string): CircuitStats | undefined {
    return this.circuits.get(name);
  }

  /**
   * Get all circuit names
   */
  getCircuitNames(): string[] {
    return Array.from(this.circuits.keys());
  }

  /**
   * Get all circuit statistics (Phase 15.2: Added for ResilienceCoordinator)
   */
  getAllStats(): Record<string, { state: string; failures: number; successes: number }> {
    const stats: Record<string, { state: string; failures: number; successes: number }> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = {
        state: circuit.state,
        failures: circuit.failureCount,
        successes: circuit.successCount,
      };
    }
    return stats;
  }

  /**
   * Clear all circuits (for testing)
   */
  clearAll(): void {
    this.circuits.clear();
    this.safeLog('info', 'All circuit breakers cleared');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private onSuccess(name: string): void {
    const circuit = this.circuits.get(name)!;
    circuit.successCount++;
    circuit.totalRequests++;
    circuit.lastSuccessTime = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successCount >= this.config.successThreshold) {
        this.transitionToClosed(circuit, name);
      }
    }

    // Check if circuit should open based on failure rate (even on success)
    if (circuit.state === CircuitState.CLOSED) {
      if (this.shouldOpen(circuit)) {
        this.transitionToOpen(circuit, name);
      }
    }
  }

  private onFailure(name: string, error: unknown): void {
    const circuit = this.circuits.get(name)!;
    circuit.failureCount++;
    circuit.totalRequests++;
    circuit.lastFailureTime = Date.now();

    // Reset success count on any failure
    circuit.successCount = 0;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately opens circuit
      this.transitionToOpen(circuit, name);
      return;
    }

    if (circuit.state === CircuitState.CLOSED) {
      if (this.shouldOpen(circuit)) {
        this.transitionToOpen(circuit, name);
      }
    }
  }

  private shouldOpen(circuit: CircuitStats): boolean {
    // Need minimum volume
    if (circuit.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check failure count threshold
    if (circuit.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate threshold
    const failureRate = circuit.failureCount / circuit.totalRequests;
    if (failureRate >= this.config.failureRateThreshold) {
      return true;
    }

    return false;
  }

  private shouldAttemptReset(circuit: CircuitStats): boolean {
    const timeSinceOpened = Date.now() - circuit.openedAt;
    return timeSinceOpened >= this.config.timeout;
  }

  private transitionToOpen(circuit: CircuitStats, name: string): void {
    circuit.state = CircuitState.OPEN;
    circuit.openedAt = Date.now();
    this.safeLog('warn', `Circuit breaker [${name}] transitioned to OPEN`, {
      failureCount: circuit.failureCount,
      totalRequests: circuit.totalRequests,
      failureRate: (circuit.failureCount / circuit.totalRequests).toFixed(2),
    });
  }

  private transitionToHalfOpen(circuit: CircuitStats, name: string): void {
    circuit.state = CircuitState.HALF_OPEN;
    circuit.successCount = 0;
    circuit.failureCount = 0;
    circuit.totalRequests = 0;
    this.safeLog('info', `Circuit breaker [${name}] transitioned to HALF_OPEN`);
  }

  private transitionToClosed(circuit: CircuitStats, name: string): void {
    circuit.state = CircuitState.CLOSED;
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.totalRequests = 0;
    circuit.closedAt = Date.now();
    this.safeLog('info', `Circuit breaker [${name}] transitioned to CLOSED`, {
      successCount: circuit.successCount,
    });
  }

  private getOrCreateCircuit(name: string): CircuitStats {
    if (!this.circuits.has(name)) {
      // Prevent memory leaks
      if (this.circuits.size >= MAX_CIRCUIT_BREAKERS) {
        this.safeLog('error', `Maximum circuit breakers (${MAX_CIRCUIT_BREAKERS}) reached`);
        throw new Error(`Maximum circuit breakers (${MAX_CIRCUIT_BREAKERS}) reached`);
      }

      this.circuits.set(name, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        openedAt: 0,
        closedAt: Date.now(),
      });

      this.safeLog('info', `Circuit breaker [${name}] created`);
    }

    return this.circuits.get(name)!;
  }

  private safeLog(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger) {
        this.logger[level](message, meta);
      }
    } catch (error) {
      // SKIP strategy: Logging failures should never block circuit breaker operations
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
}
