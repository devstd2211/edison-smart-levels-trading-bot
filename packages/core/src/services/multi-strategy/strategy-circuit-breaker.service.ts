/**
 * STRATEGY CIRCUIT BREAKER SERVICE
 *
 * Implements circuit breaker pattern for per-strategy resilience.
 * Prevents cascade failures - one failing strategy won't crash others.
 *
 * State Machine:
 * CLOSED → OPEN (on failure threshold) → HALF_OPEN (on timeout) → CLOSED/OPEN
 *
 * Phase 11: Per-Strategy Circuit Breakers
 */

import { LoggerService } from '../../types/legacy';
import {
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerState,
  CircuitBreakerError,
  CircuitBreakerEvent,
  CircuitBreakerMetrics,
  CircuitBreakerServiceConfig,
  CircuitBreakerServiceStats,
} from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors'; // Phase 8.9.34: ErrorHandler integration

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  timeout: 30000,  // 30 seconds
  backoffBase: 2,
  maxBackoff: 300000,  // 5 minutes
  halfOpenAttempts: 3,
};

export class StrategyCircuitBreakerService {
  private breakers: Map<string, CircuitBreakerState> = new Map();
  private configs: Map<string, CircuitBreakerConfig> = new Map();
  private errors: Map<string, CircuitBreakerError[]> = new Map();
  private eventCallbacks: Set<(event: CircuitBreakerEvent) => void> = new Set();
  private config: CircuitBreakerServiceConfig;
  private metricsCache: Map<string, CircuitBreakerMetrics> = new Map();

  constructor(
    private logger?: LoggerService,
    config?: CircuitBreakerServiceConfig,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.34: Optional ErrorHandler for resilience
  ) {
    this.config = {
      defaultConfig: DEFAULT_CONFIG,
      metricsEnabled: true,
      maxBreakers: 100,
      ...config,
    };
  }

  /**
   * Check if strategy can execute (circuit is not OPEN)
   */
  canExecute(strategyId: string): boolean {
    const breaker = this.ensureBreaker(strategyId);

    if (breaker.status === CircuitBreakerStatus.CLOSED) {
      return true;
    }

    if (breaker.status === CircuitBreakerStatus.OPEN) {
      // Check if timeout expired
      if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime) {
        // Time to try recovery
        this.transitionToHalfOpen(strategyId);
        return true;  // Allow one attempt
      }
      return false;  // Still in open state
    }

    // HALF_OPEN: allow attempt
    return true;
  }

  /**
   * Record successful execution
   */
  recordSuccess(strategyId: string): void {
    const breaker = this.ensureBreaker(strategyId);

    breaker.successCount++;
    breaker.totalSuccesses++;
    breaker.lastSuccessTime = Date.now();

    if (breaker.status === CircuitBreakerStatus.HALF_OPEN) {
      // In half-open: count successes toward closing
      if (breaker.successCount >= this.getConfig(strategyId).halfOpenAttempts) {
        this.transitionToClosed(strategyId);
      }
    } else if (breaker.status === CircuitBreakerStatus.CLOSED) {
      // Normal operation: reset failure counter
      breaker.failureCount = 0;
    }

    // Invalidate metrics cache
    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.debug('[CircuitBreaker] Success recorded', {
        strategyId,
        status: breaker.status,
        totalSuccesses: breaker.totalSuccesses,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.recordSuccess.successLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(strategyId: string, error: Error): void {
    const breaker = this.ensureBreaker(strategyId);

    breaker.failureCount++;
    breaker.totalFailures++;
    breaker.lastFailureTime = Date.now();
    breaker.successCount = 0;  // Reset success counter

    // Phase 8.9.34: GRACEFUL_DEGRADE for error storage
    try {
      // Store error information
      const cbError: CircuitBreakerError = {
        message: error.message,
        code: this.getErrorCode(error),
        timestamp: Date.now(),
        stackTrace: error.stack,
      };

      if (!this.errors.has(strategyId)) {
        this.errors.set(strategyId, []);
      }
      const errorList = this.errors.get(strategyId)!;
      errorList.push(cbError);

      // Keep only last 10 errors
      if (errorList.length > 10) {
        errorList.shift();
      }
    } catch (storageError) {
      if (this.errorHandler) {
        this.errorHandler.handle(storageError as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'StrategyCircuitBreakerService.recordFailure.errorStorage',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Continue despite storage failure - circuit breaker must function
    }

    // Check if should open circuit
    const threshold = this.getConfig(strategyId).failureThreshold;
    if (breaker.failureCount >= threshold && breaker.status === CircuitBreakerStatus.CLOSED) {
      this.transitionToOpen(strategyId);
    } else if (breaker.status === CircuitBreakerStatus.HALF_OPEN) {
      // Failure in half-open: reopen
      this.transitionToOpen(strategyId);
    }

    // Invalidate metrics cache
    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.warn('[CircuitBreaker] Failure recorded', {
        strategyId,
        status: breaker.status,
        failureCount: breaker.failureCount,
        error: error.message,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.recordFailure.failureLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  /**
   * Get current state of circuit breaker
   */
  getState(strategyId: string): CircuitBreakerState {
    return this.ensureBreaker(strategyId);
  }

  /**
   * Get metrics for circuit breaker
   */
  getMetrics(strategyId: string): CircuitBreakerMetrics {
    // Phase 8.9.34: GRACEFUL_DEGRADE for cache retrieval
    try {
      // Check cache
      if (this.metricsCache.has(strategyId)) {
        return this.metricsCache.get(strategyId)!;
      }
    } catch (cacheError) {
      if (this.errorHandler) {
        this.errorHandler.handle(cacheError as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'StrategyCircuitBreakerService.getMetrics.cacheRetrieval',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Continue without cache - recalculate metrics
    }

    const breaker = this.ensureBreaker(strategyId);
    const errorList = this.errors.get(strategyId) || [];
    const lastError = errorList.length > 0 ? errorList[errorList.length - 1] : null;

    const totalOps = breaker.totalSuccesses + breaker.totalFailures;
    const failureRate = totalOps > 0 ? breaker.totalFailures / totalOps : 0;

    const metrics: CircuitBreakerMetrics = {
      strategyId,
      currentStatus: breaker.status,
      totalFailures: breaker.totalFailures,
      totalSuccesses: breaker.totalSuccesses,
      failureRate,
      lastFailure: lastError || null,
      lastFailureTime: breaker.lastFailureTime,
      lastSuccessTime: breaker.lastSuccessTime,
      timeInCurrentState: Date.now() - (breaker.lastFailureTime || breaker.lastSuccessTime || 0),
      recoveryAttempts: breaker.recoveryAttempts,
      averageRecoveryTime: 0,  // Would need more tracking
    };

    // Phase 8.9.34: GRACEFUL_DEGRADE for cache storage
    if (this.config.metricsEnabled) {
      try {
        this.metricsCache.set(strategyId, metrics);
      } catch (cacheError) {
        if (this.errorHandler) {
          this.errorHandler.handle(cacheError as Error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'StrategyCircuitBreakerService.getMetrics.cacheStorage',
          }).catch(() => {
            // Silently ignore error handling failures
          });
        }
        // Continue without caching - return metrics anyway
      }
    }

    return metrics;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.breakers.keys()).map(strategyId => this.getMetrics(strategyId));
  }

  /**
   * Register callback for circuit breaker events
   */
  onStateChange(callback: (event: CircuitBreakerEvent) => void): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Unregister callback
   */
  offStateChange(callback: (event: CircuitBreakerEvent) => void): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Manually reset a circuit breaker
   */
  reset(strategyId: string): void {
    const breaker = this.ensureBreaker(strategyId);
    const oldStatus = breaker.status;

    breaker.status = CircuitBreakerStatus.CLOSED;
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.nextRetryTime = null;
    breaker.recoveryAttempts = 0;

    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] Reset', {
        strategyId,
        previousStatus: oldStatus,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.reset.resetLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }

    this.emitEvent({
      strategyId,
      type: 'CLOSED',
      previousStatus: oldStatus,
      currentStatus: CircuitBreakerStatus.CLOSED,
      timestamp: Date.now(),
    });
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const strategyId of this.breakers.keys()) {
      this.reset(strategyId);
    }

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] Reset all breakers');
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.resetAll.resetAllLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  /**
   * Get service-wide statistics
   */
  getStats(): CircuitBreakerServiceStats {
    let open = 0;
    let halfOpen = 0;
    let closed = 0;
    let totalFailures = 0;
    let totalSuccesses = 0;
    let oldestBreaker: { strategyId: string; createdAt: number } | null = null;
    let oldestTime = Infinity;

    for (const [strategyId, breaker] of this.breakers) {
      switch (breaker.status) {
        case CircuitBreakerStatus.OPEN:
          open++;
          break;
        case CircuitBreakerStatus.HALF_OPEN:
          halfOpen++;
          break;
        case CircuitBreakerStatus.CLOSED:
          closed++;
          break;
      }

      totalFailures += breaker.totalFailures;
      totalSuccesses += breaker.totalSuccesses;

      // Track oldest breaker (first failure time or creation)
      const time = breaker.lastFailureTime || breaker.lastSuccessTime || Date.now();
      if (time < oldestTime) {
        oldestTime = time;
        oldestBreaker = { strategyId, createdAt: time };
      }
    }

    const totalOps = totalSuccesses + totalFailures;
    const averageFailureRate = totalOps > 0 ? totalFailures / totalOps : 0;

    return {
      totalBreakers: this.breakers.size,
      breakersOpen: open,
      breakersHalfOpen: halfOpen,
      breakersClosed: closed,
      totalFailures,
      totalSuccesses,
      averageFailureRate,
      breakersByStatus: {
        [CircuitBreakerStatus.OPEN]: open,
        [CircuitBreakerStatus.HALF_OPEN]: halfOpen,
        [CircuitBreakerStatus.CLOSED]: closed,
      },
      oldestCircuitBreaker: oldestBreaker,
    };
  }

  /**
   * Get configuration for strategy
   */
  getConfig(strategyId: string): CircuitBreakerConfig {
    if (this.configs.has(strategyId)) {
      return this.configs.get(strategyId)!;
    }

    const baseConfig = { ...DEFAULT_CONFIG, ...this.config.defaultConfig };
    const overrides = this.config.overrides?.[strategyId] || {};

    const finalConfig: CircuitBreakerConfig = {
      ...baseConfig,
      ...overrides,
    };

    this.configs.set(strategyId, finalConfig);
    return finalConfig;
  }

  /**
   * Set configuration for strategy
   */
  setConfig(strategyId: string, config: Partial<CircuitBreakerConfig>): void {
    const currentConfig = this.getConfig(strategyId);
    const newConfig = { ...currentConfig, ...config };

    this.configs.set(strategyId, newConfig);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] Config updated', {
        strategyId,
        config: newConfig,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.setConfig.configLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  /**
   * Clear all breakers and data
   */
  clear(): void {
    this.breakers.clear();
    this.configs.clear();
    this.errors.clear();
    this.metricsCache.clear();

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] Cleared all breakers');
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.clear.clearLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private ensureBreaker(strategyId: string): CircuitBreakerState {
    if (this.breakers.has(strategyId)) {
      return this.breakers.get(strategyId)!;
    }

    // Create new breaker
    if (this.breakers.size >= (this.config.maxBreakers || 100)) {
      this.logger?.warn('[CircuitBreaker] Max breakers reached', {
        max: this.config.maxBreakers,
      });
    }

    const breaker: CircuitBreakerState = {
      strategyId,
      status: CircuitBreakerStatus.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextRetryTime: null,
      recoveryAttempts: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };

    this.breakers.set(strategyId, breaker);
    return breaker;
  }

  private transitionToOpen(strategyId: string): void {
    const breaker = this.breakers.get(strategyId)!;
    const oldStatus = breaker.status;
    const config = this.getConfig(strategyId);

    breaker.status = CircuitBreakerStatus.OPEN;
    breaker.nextRetryTime = Date.now() + config.timeout;
    breaker.recoveryAttempts = 0;
    breaker.successCount = 0;

    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.error('[CircuitBreaker] OPENED', {
        strategyId,
        failureCount: breaker.failureCount,
        retryAfter: config.timeout,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.transitionToOpen.openLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }

    this.emitEvent({
      strategyId,
      type: 'OPENED',
      previousStatus: oldStatus,
      currentStatus: CircuitBreakerStatus.OPEN,
      failureCount: breaker.failureCount,
      timestamp: Date.now(),
    });
  }

  private transitionToHalfOpen(strategyId: string): void {
    const breaker = this.breakers.get(strategyId)!;
    const oldStatus = breaker.status;

    breaker.status = CircuitBreakerStatus.HALF_OPEN;
    breaker.successCount = 0;
    breaker.recoveryAttempts++;
    breaker.nextRetryTime = null;

    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] HALF-OPEN (attempting recovery)', {
        strategyId,
        recoveryAttempt: breaker.recoveryAttempts,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.transitionToHalfOpen.halfOpenLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }

    this.emitEvent({
      strategyId,
      type: 'HALF_OPEN',
      previousStatus: oldStatus,
      currentStatus: CircuitBreakerStatus.HALF_OPEN,
      timestamp: Date.now(),
    });
  }

  private transitionToClosed(strategyId: string): void {
    const breaker = this.breakers.get(strategyId)!;
    const oldStatus = breaker.status;

    breaker.status = CircuitBreakerStatus.CLOSED;
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.recoveryAttempts = 0;
    breaker.nextRetryTime = null;

    this.metricsCache.delete(strategyId);

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger?.info('[CircuitBreaker] CLOSED (recovered)', {
        strategyId,
        recoveryAttempts: breaker.recoveryAttempts,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'StrategyCircuitBreakerService.transitionToClosed.closedLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }

    this.emitEvent({
      strategyId,
      type: 'CLOSED',
      previousStatus: oldStatus,
      currentStatus: CircuitBreakerStatus.CLOSED,
      timestamp: Date.now(),
    });
  }

  private emitEvent(event: CircuitBreakerEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        // Phase 8.9.34: GRACEFUL_DEGRADE for callback execution
        if (this.errorHandler) {
          this.errorHandler.handle(error as Error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'StrategyCircuitBreakerService.emitEvent.callbackExecution',
          }).catch(() => {
            // Even error handling failure should not interrupt event emission
            // Fallback to basic logging if available
            try {
              this.logger?.error('[CircuitBreaker] Error in event callback', {
                error: String(error),
              });
            } catch {
              // Silent failure - never interrupt event loop
            }
          });
        } else {
          // Fallback when ErrorHandler is not available
          try {
            this.logger?.error('[CircuitBreaker] Error in event callback', {
              error: String(error),
            });
          } catch {
            // Silent failure - never interrupt event loop
          }
        }
      }
    }
  }

  private getErrorCode(error: Error): string {
    const maybeCode = (error as Error & { code?: unknown }).code;
    return typeof maybeCode === 'string' || typeof maybeCode === 'number'
      ? String(maybeCode)
      : 'UNKNOWN';
  }
}
