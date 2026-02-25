/**
 * Advanced Order State Machine Service
 *
 * Manages complex order lifecycles with:
 * - State validation and transition control
 * - Automatic timeout handling
 * - Complete state history tracking
 * - Concurrent safety with locks
 * - Rollback support on errors
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 13.2 - Order State Machine
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  OrderState,
  DEFAULT_ORDER_TIMEOUT_MS,
  STATE_LOCK_TIMEOUT_MS,
  MAX_TRANSITION_HISTORY,
  MAX_CONCURRENT_TRANSITIONS,
  STATE_CHECK_INTERVAL_MS,
  MAX_ROLLBACK_RETRIES,
  TERMINAL_STATES,
  STATE_TRANSITIONS,
  STATE_TIMEOUTS,
  TransitionTrigger,
  TRANSITION_ID_PREFIX,
  STATE_MACHINE_ORDER_ID_PREFIX,
} from '../constants/phase-13-constants';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * State transition record
 */
export interface StateTransition {
  id: string;
  from: OrderState;
  to: OrderState;
  timestamp: number;
  reason: string;
  triggeredBy: TransitionTrigger;
  metadata?: Record<string, any>;
}

/**
 * Order state machine
 */
export interface OrderStateMachine {
  orderId: string;
  currentState: OrderState;
  previousState?: OrderState;

  // State history
  transitions: StateTransition[];
  createdAt: number;
  updatedAt: number;

  // Timeouts
  timeoutMs: number;
  timeoutAt?: number;

  // Locking
  locked: boolean;
  lockAcquiredAt?: number;

  // Callbacks
  onStateChange?: (transition: StateTransition) => void;
  onTimeout?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Transition options
 */
export interface TransitionOptions {
  reason: string;
  triggeredBy: TransitionTrigger;
  metadata?: Record<string, any>;
  skipValidation?: boolean; // For emergency rollbacks
}

/**
 * State machine statistics
 */
export interface StateMachineStats {
  totalTransitions: number;
  averageTransitionTime: number;
  timeoutCount: number;
  rollbackCount: number;
  errorCount: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class AdvancedOrderStateMachineService {
  private readonly stateMachines: Map<string, OrderStateMachine> = new Map();
  private readonly locks: Map<string, boolean> = new Map();
  private timeoutCheckInterval?: NodeJS.Timeout;
  private stats: StateMachineStats = {
    totalTransitions: 0,
    averageTransitionTime: 0,
    timeoutCount: 0,
    rollbackCount: 0,
    errorCount: 0,
  };

  constructor(
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    this.safeLog('AdvancedOrderStateMachineService initialized');
    this.startTimeoutChecker();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Create a new order state machine
   */
  createStateMachine(
    orderId: string,
    options?: {
      timeoutMs?: number;
      onStateChange?: (transition: StateTransition) => void;
      onTimeout?: () => void;
      onError?: (error: Error) => void;
    }
  ): OrderStateMachine {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for state machine creation');
    }

    if (this.stateMachines.has(orderId)) {
      throw new Error(`State machine already exists for order ${orderId}`);
    }

    const now = Date.now();
    const stateMachine: OrderStateMachine = {
      orderId,
      currentState: OrderState.PENDING,
      previousState: undefined,
      transitions: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: options?.timeoutMs ?? DEFAULT_ORDER_TIMEOUT_MS,
      timeoutAt: now + (options?.timeoutMs ?? DEFAULT_ORDER_TIMEOUT_MS),
      locked: false,
      onStateChange: options?.onStateChange,
      onTimeout: options?.onTimeout,
      onError: options?.onError,
    };

    this.stateMachines.set(orderId, stateMachine);
    this.safeLog(`State machine created for order ${orderId}`);

    return stateMachine;
  }

  /**
   * Transition state with validation
   */
  async transitionState(
    orderId: string,
    toState: OrderState,
    options: TransitionOptions
  ): Promise<StateTransition> {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for state transition');
    }

    if (!toState) {
      throw new Error('Target state is required for transition');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    // Acquire lock (GRACEFUL_DEGRADE: if can't acquire, return gracefully)
    const lockAcquired = await this.acquireLock(orderId);
    if (!lockAcquired) {
      this.safeLog(`Failed to acquire lock for order ${orderId}, transition blocked`);

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => {
            throw new Error(`Concurrent transition detected for order ${orderId}`);
          },
          { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
        );

        if (!result.success) {
          // Return dummy transition to indicate failure
          return {
            id: `${TRANSITION_ID_PREFIX}failed_${Date.now()}`,
            from: stateMachine.currentState,
            to: stateMachine.currentState, // Stay in same state
            timestamp: Date.now(),
            reason: 'Lock acquisition failed',
            triggeredBy: TransitionTrigger.ERROR,
          };
        }
      }

      // Fallback without ErrorHandler
      return {
        id: `${TRANSITION_ID_PREFIX}failed_${Date.now()}`,
        from: stateMachine.currentState,
        to: stateMachine.currentState,
        timestamp: Date.now(),
        reason: 'Lock acquisition failed',
        triggeredBy: TransitionTrigger.ERROR,
      };
    }

    try {
      // Validate transition (THROW strategy if validation disabled)
      if (!options.skipValidation) {
        const isValid = this.validateTransition(
          stateMachine.currentState,
          toState
        );

        if (!isValid) {
          throw new Error(
            `Invalid state transition: ${stateMachine.currentState} → ${toState}`
          );
        }
      }

      // Create transition record
      const transition: StateTransition = {
        id: `${TRANSITION_ID_PREFIX}${orderId}_${Date.now()}`,
        from: stateMachine.currentState,
        to: toState,
        timestamp: Date.now(),
        reason: options.reason,
        triggeredBy: options.triggeredBy,
        metadata: options.metadata,
      };

      // Update state machine
      stateMachine.previousState = stateMachine.currentState;
      stateMachine.currentState = toState;
      stateMachine.updatedAt = transition.timestamp;
      stateMachine.transitions.push(transition);

      // Trim history if needed
      if (stateMachine.transitions.length > MAX_TRANSITION_HISTORY) {
        stateMachine.transitions = stateMachine.transitions.slice(-MAX_TRANSITION_HISTORY);
      }

      // Update timeout for new state
      const stateTimeout = STATE_TIMEOUTS[toState];
      if (stateTimeout > 0) {
        stateMachine.timeoutAt = transition.timestamp + stateTimeout;
      } else {
        stateMachine.timeoutAt = undefined; // Terminal state, no timeout
      }

      // Update stats
      this.stats.totalTransitions++;

      // Trigger callback (SKIP strategy: don't fail if callback throws)
      if (stateMachine.onStateChange) {
        try {
          stateMachine.onStateChange(transition);
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handle(error, {
              strategy: RecoveryStrategy.SKIP,
              context: 'AdvancedOrderStateMachineService.transitionState.callback',
            });
          }
          this.safeLog(`State change callback failed for order ${orderId}: ${error}`);
        }
      }

      this.safeLog(
        `State transition: ${transition.from} → ${transition.to} (${orderId})`
      );

      return transition;
    } catch (error) {
      // GRACEFUL_DEGRADE: Rollback on error
      this.safeLog(`State transition failed for order ${orderId}: ${error}`);
      this.stats.errorCount++;

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => {
            throw error;
          },
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'AdvancedOrderStateMachineService.transitionState',
          }
        );

        if (!result.success) {
          // Attempt rollback
          await this.rollbackState(orderId, String(error));
        }
      }

      throw error;
    } finally {
      // Always release lock
      this.releaseLock(orderId);
    }
  }

  /**
   * Validate if transition is allowed
   */
  validateTransition(fromState: OrderState, toState: OrderState): boolean {
    // Validation (returns boolean, no THROW)
    if (!fromState || !toState) {
      return false;
    }

    // Check if from state is terminal
    if (TERMINAL_STATES.has(fromState)) {
      return false;
    }

    // Check if transition is allowed
    const allowedTransitions = STATE_TRANSITIONS[fromState];
    return allowedTransitions?.includes(toState) ?? false;
  }

  /**
   * Handle timeout for an order
   */
  async handleTimeout(orderId: string): Promise<StateTransition | null> {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for timeout handling');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    // Check if order has timed out
    const now = Date.now();
    if (!stateMachine.timeoutAt || now < stateMachine.timeoutAt) {
      return null; // Not timed out yet
    }

    this.safeLog(`Order ${orderId} timed out in state ${stateMachine.currentState}`);
    this.stats.timeoutCount++;

    // Trigger timeout callback (SKIP strategy)
    if (stateMachine.onTimeout) {
      try {
        stateMachine.onTimeout();
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'AdvancedOrderStateMachineService.handleTimeout.callback',
          });
        }
        this.safeLog(`Timeout callback failed for order ${orderId}: ${error}`);
      }
    }

    // Transition to EXPIRED state
    return this.transitionState(orderId, OrderState.EXPIRED, {
      reason: 'Order timed out',
      triggeredBy: TransitionTrigger.TIMEOUT,
      metadata: { timeoutAt: stateMachine.timeoutAt, now },
    });
  }

  /**
   * Handle partial fill
   */
  async handlePartialFill(
    orderId: string,
    filledSize: number,
    totalSize: number
  ): Promise<StateTransition> {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for partial fill handling');
    }

    if (filledSize <= 0 || totalSize <= 0) {
      throw new Error('Invalid fill sizes: both must be positive');
    }

    if (filledSize >= totalSize) {
      throw new Error('Filled size >= total size, use handleFilled() instead');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    const fillPercentage = (filledSize / totalSize) * 100;

    return this.transitionState(orderId, OrderState.PARTIAL_FILL, {
      reason: `Partial fill: ${fillPercentage.toFixed(1)}% (${filledSize}/${totalSize})`,
      triggeredBy: TransitionTrigger.EXCHANGE,
      metadata: { filledSize, totalSize, fillPercentage },
    });
  }

  /**
   * Handle cancellation
   */
  async handleCancellation(
    orderId: string,
    reason: string,
    triggeredBy: TransitionTrigger = TransitionTrigger.USER
  ): Promise<StateTransition> {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for cancellation');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    return this.transitionState(orderId, OrderState.CANCELLED, {
      reason: reason || 'Order cancelled',
      triggeredBy,
    });
  }

  /**
   * Handle error
   */
  async handleError(
    orderId: string,
    error: Error,
    failState: OrderState = OrderState.FAILED
  ): Promise<StateTransition> {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required for error handling');
    }

    if (!error) {
      throw new Error('Error object is required');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    this.safeLog(`Error occurred for order ${orderId}: ${error.message}`);
    this.stats.errorCount++;

    // Trigger error callback (SKIP strategy)
    if (stateMachine.onError) {
      try {
        stateMachine.onError(error);
      } catch (callbackError) {
        if (this.errorHandler) {
          this.errorHandler.handle(callbackError, {
            strategy: RecoveryStrategy.SKIP,
            context: 'AdvancedOrderStateMachineService.handleError.callback',
          });
        }
        this.safeLog(`Error callback failed for order ${orderId}: ${callbackError}`);
      }
    }

    return this.transitionState(orderId, failState, {
      reason: `Error: ${error.message}`,
      triggeredBy: TransitionTrigger.ERROR,
      metadata: { errorName: error.name, errorStack: error.stack },
    });
  }

  /**
   * Get complete order history
   */
  getOrderHistory(orderId: string): StateTransition[] {
    // Validation (THROW strategy)
    if (!orderId) {
      throw new Error('Order ID is required to get history');
    }

    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine) {
      throw new Error(`State machine not found for order ${orderId}`);
    }

    return [...stateMachine.transitions]; // Return copy
  }

  /**
   * Get state machine for an order
   */
  getStateMachine(orderId: string): OrderStateMachine | undefined {
    return this.stateMachines.get(orderId);
  }

  /**
   * Get current state for an order
   */
  getCurrentState(orderId: string): OrderState | undefined {
    return this.stateMachines.get(orderId)?.currentState;
  }

  /**
   * Check if order is in terminal state
   */
  isTerminalState(orderId: string): boolean {
    const state = this.getCurrentState(orderId);
    return state ? TERMINAL_STATES.has(state) : false;
  }

  /**
   * Get service statistics
   */
  getStats(): StateMachineStats {
    return { ...this.stats };
  }

  /**
   * Remove state machine (cleanup)
   */
  removeStateMachine(orderId: string): void {
    if (!orderId) {
      throw new Error('Order ID is required for removal');
    }

    this.stateMachines.delete(orderId);
    this.locks.delete(orderId);
    this.safeLog(`State machine removed for order ${orderId}`);
  }

  /**
   * Cleanup service (stop timeout checker)
   */
  cleanup(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = undefined;
    }
    this.stateMachines.clear();
    this.locks.clear();
    this.safeLog('AdvancedOrderStateMachineService cleaned up');
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Acquire lock for state transition
   */
  private async acquireLock(orderId: string): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < STATE_LOCK_TIMEOUT_MS) {
      if (!this.locks.get(orderId)) {
        this.locks.set(orderId, true);
        const stateMachine = this.stateMachines.get(orderId);
        if (stateMachine) {
          stateMachine.locked = true;
          stateMachine.lockAcquiredAt = Date.now();
        }
        return true;
      }

      // Wait a bit before retrying
      await this.sleep(10);
    }

    return false;
  }

  /**
   * Release lock for state transition
   */
  private releaseLock(orderId: string): void {
    this.locks.set(orderId, false);
    const stateMachine = this.stateMachines.get(orderId);
    if (stateMachine) {
      stateMachine.locked = false;
      stateMachine.lockAcquiredAt = undefined;
    }
  }

  /**
   * Rollback state to previous state
   */
  private async rollbackState(orderId: string, reason: string): Promise<void> {
    const stateMachine = this.stateMachines.get(orderId);
    if (!stateMachine || !stateMachine.previousState) {
      return; // Nothing to rollback
    }

    this.safeLog(`Rolling back state for order ${orderId}: ${reason}`);
    this.stats.rollbackCount++;

    try {
      // Force transition back to previous state (skip validation)
      await this.transitionState(orderId, stateMachine.previousState, {
        reason: `Rollback: ${reason}`,
        triggeredBy: TransitionTrigger.SYSTEM,
        skipValidation: true, // Emergency rollback, skip normal validation
      });
    } catch (rollbackError) {
      this.safeLog(`Rollback failed for order ${orderId}: ${rollbackError}`);

      if (this.errorHandler) {
        this.errorHandler.handle(rollbackError, {
          strategy: RecoveryStrategy.SKIP,
          context: 'AdvancedOrderStateMachineService.rollbackState',
        });
      }
    }
  }

  /**
   * Start timeout checker (runs every second)
   */
  private startTimeoutChecker(): void {
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        this.safeLog(`Timeout checker error: ${error}`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
          });
        }
      });
    }, STATE_CHECK_INTERVAL_MS);
  }

  /**
   * Check all state machines for timeouts
   */
  private async checkTimeouts(): Promise<void> {
    const now = Date.now();

    for (const [orderId, stateMachine] of this.stateMachines) {
      // Skip if locked (transition in progress)
      if (stateMachine.locked) {
        continue;
      }

      // Skip if already in terminal state
      if (TERMINAL_STATES.has(stateMachine.currentState)) {
        continue;
      }

      // Check timeout
      if (stateMachine.timeoutAt && now >= stateMachine.timeoutAt) {
        try {
          await this.handleTimeout(orderId);
        } catch (error) {
          this.safeLog(`Failed to handle timeout for order ${orderId}: ${error}`);
          if (this.errorHandler) {
            this.errorHandler.handle(error, {
              strategy: RecoveryStrategy.SKIP,
              context: 'AdvancedOrderStateMachineService.checkTimeouts',
            });
          }
        }
      }
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safe logging wrapper (SKIP strategy)
   */
  private safeLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.logger) return;

    try {
      const context = { service: 'AdvancedOrderStateMachineService' };
      if (level === 'warn') {
        this.logger.warn(message, context);
      } else if (level === 'error') {
        this.logger.error(message, context);
      } else {
        this.logger.info(message, context);
      }
    } catch (error) {
      // SKIP: Silently ignore logging errors
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'AdvancedOrderStateMachineService.safeLog',
        });
      }
    }
  }
}
