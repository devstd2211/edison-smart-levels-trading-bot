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

import { LoggerService } from './logger.service';
import { TIME_INTERVALS, MAX_ERROR_HISTORY } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy } from '../errors'; // Phase 8.9.34: ErrorHandler integration
import { ICONS } from '../cli/cli-runtime';

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
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.34: Optional ErrorHandler for resilience
  ) {
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
        // Phase 8.9.34: SKIP logging failures
        try {
          this.logger.info('[CircuitBreaker] Moving to HALF_OPEN state', {
            timeSinceTrip,
          });
        } catch (logError) {
          if (this.errorHandler) {
            this.errorHandler.handle(logError as Error, {
              strategy: RecoveryStrategy.SKIP,
              context: 'CircuitBreakerService.isOpen.stateTransitionLog',
            }).catch(() => {
              // Silently ignore error handling failures
            });
          }
        }
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
      // Successful call in HALF_OPEN state -> close circuit
      // Phase 8.9.34: SKIP logging failures
      try {
        this.logger.info('[CircuitBreaker] Recovery successful, closing circuit', {
          totalSuccesses: this.totalSuccesses,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'CircuitBreakerService.recordSuccess.recoveryLog',
          }).catch(() => {
            // Silently ignore error handling failures
          });
        }
      }
      this.state = CircuitState.CLOSED;
    } else if (this.state === CircuitState.CLOSED) {
      // Phase 8.9.34: SKIP logging failures
      try {
        this.logger.debug('[CircuitBreaker] Success recorded', {
          totalSuccesses: this.totalSuccesses,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'CircuitBreakerService.recordSuccess.debugLog',
          }).catch(() => {
            // Silently ignore error handling failures
          });
        }
      }
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

    // Phase 8.9.34: GRACEFUL_DEGRADE for error history management
    try {
      // Add to error history
      this.errorHistory.push({
        timestamp: Date.now(),
        error: errorMessage,
      });

      // Limit error history size
      if (this.errorHistory.length > MAX_ERROR_HISTORY) {
        this.errorHistory.shift();
      }
    } catch (historyError) {
      if (this.errorHandler) {
        this.errorHandler.handle(historyError as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'CircuitBreakerService.recordError.historyManagement',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Continue despite history failure - circuit breaker must function
    }

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger.warn('[CircuitBreaker] Error recorded', {
        consecutiveErrors: this.consecutiveErrors,
        error: errorMessage,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'CircuitBreakerService.recordError.errorLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }

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

    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger.error(`[CircuitBreaker] ${ICONS.warning} CIRCUIT TRIPPED - Operations paused`, {
        consecutiveErrors: this.consecutiveErrors,
        tripCount: this.tripCount,
        cooldownMs: this.config.cooldownMs,
      });
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'CircuitBreakerService.trip.circuitTripLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
  }

  /**
   * Manually close the circuit (reset)
   */
  reset(): void {
    // Phase 8.9.34: SKIP logging failures
    try {
      this.logger.info('[CircuitBreaker] Manual reset');
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'CircuitBreakerService.reset.resetLog',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
    }
    this.state = CircuitState.CLOSED;
    this.consecutiveErrors = 0;
    this.tripTime = null;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    // Phase 8.9.34: GRACEFUL_DEGRADE for stats retrieval
    try {
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
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'CircuitBreakerService.getStats.statsConstruction',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Return partial stats with safe defaults
      return {
        state: this.state,
        consecutiveErrors: this.consecutiveErrors,
        totalErrors: this.totalErrors,
        totalSuccesses: this.totalSuccesses,
        lastErrorTime: null,
        lastSuccessTime: null,
        tripCount: 0,
        tripTime: null,
      };
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(): { timestamp: number; error: string }[] {
    // Phase 8.9.34: GRACEFUL_DEGRADE for history retrieval
    try {
      return [...this.errorHistory];
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'CircuitBreakerService.getErrorHistory.historyCopy',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Return empty history on error
      return [];
    }
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

    // Phase 8.9.34: GRACEFUL_DEGRADE for time calculation
    try {
      const now = Date.now();
      const timeSinceTrip = this.tripTime ? now - this.tripTime : 0;
      return timeSinceTrip >= this.config.cooldownMs;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'CircuitBreakerService.canAttemptRecovery.timeCalculation',
        }).catch(() => {
          // Silently ignore error handling failures
        });
      }
      // Return false (conservative default) on error
      return false;
    }
  }
}
