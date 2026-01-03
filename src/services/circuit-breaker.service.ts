/**
 * Circuit Breaker Service
 *
 * Protects the system from API failures by tracking consecutive errors.
 * When error threshold is reached, the circuit "trips" and pauses operations.
 *
 * States:
 * - CLOSED: Normal operation (no errors or below threshold)
 * - OPEN: Circuit tripped (pause operations for cooldown period)
 * - HALF_OPEN: Testing if service recovered (allow one request)
 *
 * Configuration:
 * - errorThreshold: Number of consecutive errors before trip (default: 5)
 * - cooldownMs: How long to wait before testing recovery (default: 5 min)
 * - autoReset: Automatically close circuit after successful call (default: true)
 */

import { LoggerService } from '../types';
import { TIME_INTERVALS, MAX_ERROR_HISTORY, DEFAULT_ERROR_THRESHOLD } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

// DEFAULT_ERROR_THRESHOLD imported from technical.constants (error handling)
// MAX_ERROR_HISTORY imported from technical.constants (system limit)
const DEFAULT_COOLDOWN_MS = TIME_INTERVALS.MS_PER_5_MINUTES; // 5 minutes

// ============================================================================
// TYPES
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit tripped
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

export interface CircuitBreakerConfig {
  errorThreshold: number; // Consecutive errors before trip
  cooldownMs: number; // Cooldown period when open
  autoReset: boolean; // Auto-close on success
}

export interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveErrors: number;
  totalErrors: number;
  totalSuccesses: number;
  lastErrorTime: number | null;
  lastSuccessTime: number | null;
  tripCount: number; // How many times circuit tripped
  tripTime: number | null; // When circuit last tripped
}

// ============================================================================
// CIRCUIT BREAKER SERVICE
// ============================================================================

export class CircuitBreakerService {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveErrors: number = 0;
  private totalErrors: number = 0;
  private totalSuccesses: number = 0;
  private lastErrorTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private tripCount: number = 0;
  private tripTime: number | null = null;
  private errorHistory: { timestamp: number; error: string }[] = [];

  constructor(
    private config: CircuitBreakerConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('[CircuitBreaker] Initialized', {
      errorThreshold: config.errorThreshold,
      cooldownMs: config.cooldownMs,
    });
  }

  /**
   * Check if circuit allows operations
   * @returns true if operations are allowed (CLOSED or HALF_OPEN)
   */
  isOpen(): boolean {
    // If circuit is OPEN, check if cooldown period has passed
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const timeSinceTrip = this.tripTime ? now - this.tripTime : 0;

      if (timeSinceTrip >= this.config.cooldownMs) {
        // Cooldown period passed, move to HALF_OPEN
        this.logger.info('[CircuitBreaker] Moving to HALF_OPEN state', {
          timeSinceTrip,
        });
        this.state = CircuitState.HALF_OPEN;
        return false; // HALF_OPEN still blocks (will allow one test)
      }

      return true; // Still OPEN
    }

    return false; // CLOSED or HALF_OPEN
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.consecutiveErrors = 0; // Reset consecutive error count

    if (this.state === CircuitState.HALF_OPEN && this.config.autoReset) {
      // Successful call in HALF_OPEN state → close circuit
      this.logger.info('[CircuitBreaker] Recovery successful, closing circuit', {
        totalSuccesses: this.totalSuccesses,
      });
      this.state = CircuitState.CLOSED;
    } else if (this.state === CircuitState.CLOSED) {
      this.logger.debug('[CircuitBreaker] Success recorded', {
        totalSuccesses: this.totalSuccesses,
      });
    }
  }

  /**
   * Record a failed operation
   */
  recordError(error: string | Error): void {
    this.totalErrors++;
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();

    const errorMessage = error instanceof Error ? error.message : error;

    // Add to error history
    this.errorHistory.push({
      timestamp: Date.now(),
      error: errorMessage,
    });

    // Limit error history size
    if (this.errorHistory.length > MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }

    this.logger.warn('[CircuitBreaker] Error recorded', {
      consecutiveErrors: this.consecutiveErrors,
      error: errorMessage,
    });

    // Check if threshold reached
    if (this.consecutiveErrors >= this.config.errorThreshold) {
      this.trip();
    }
  }

  /**
   * Trip the circuit (move to OPEN state)
   */
  private trip(): void {
    if (this.state === CircuitState.OPEN) {
      return; // Already open
    }

    this.state = CircuitState.OPEN;
    this.tripCount++;
    this.tripTime = Date.now();

    this.logger.error('[CircuitBreaker] ⚠️ CIRCUIT TRIPPED - Operations paused', {
      consecutiveErrors: this.consecutiveErrors,
      tripCount: this.tripCount,
      cooldownMs: this.config.cooldownMs,
    });
  }

  /**
   * Manually close the circuit (reset)
   */
  reset(): void {
    this.logger.info('[CircuitBreaker] Manual reset');
    this.state = CircuitState.CLOSED;
    this.consecutiveErrors = 0;
    this.tripTime = null;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      consecutiveErrors: this.consecutiveErrors,
      totalErrors: this.totalErrors,
      totalSuccesses: this.totalSuccesses,
      lastErrorTime: this.lastErrorTime,
      lastSuccessTime: this.lastSuccessTime,
      tripCount: this.tripCount,
      tripTime: this.tripTime,
    };
  }

  /**
   * Get error history
   */
  getErrorHistory(): { timestamp: number; error: string }[] {
    return [...this.errorHistory];
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if cooldown period has passed (circuit can move to HALF_OPEN)
   */
  canAttemptRecovery(): boolean {
    if (this.state !== CircuitState.OPEN) {
      return false;
    }

    const now = Date.now();
    const timeSinceTrip = this.tripTime ? now - this.tripTime : 0;
    return timeSinceTrip >= this.config.cooldownMs;
  }
}
