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
import type { ILifecycle } from '../interfaces/ILifecycle';
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
import {
  applyStateTransition,
  createBlockedStateTransitionRecord,
  createStateTransitionRecord,
} from './advanced-order-state-machine/advanced-order-state-machine-transition.utils';
import {
  invokeErrorCallback,
  invokeStateChangeCallback,
  invokeTimeoutCallback,
} from './advanced-order-state-machine/advanced-order-state-machine-callback.utils';
import { handleSkippableError } from './advanced-order-state-machine/advanced-order-state-machine-error.utils';
import {
  markLockAcquired,
  markLockReleased,
} from './advanced-order-state-machine/advanced-order-state-machine-lock.utils';
import {
  clearStateMachineResources,
  getStateMachineCurrentState,
  getStateMachineHistorySnapshot,
  getStateMachineSnapshot,
  isStateMachineTerminal,
} from './advanced-order-state-machine/advanced-order-state-machine-state.utils';
import {
  requireErrorObject,
  requireOrderId,
  requirePositiveFillSizes,
  requireStateMachine,
  requireTargetState,
} from './advanced-order-state-machine/advanced-order-state-machine-guards.utils';
import { shouldProcessTimeout } from './advanced-order-state-machine/advanced-order-state-machine-timeout.utils';
import { safeLogWithRecovery } from './advanced-order-state-machine/advanced-order-state-machine-logging.utils';
import { buildInitialStateMachine } from './advanced-order-state-machine/advanced-order-state-machine-factory.utils';

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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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

export class AdvancedOrderStateMachineService implements ILifecycle {
  private readonly stateMachines: Map<string, OrderStateMachine> = new Map();
  private readonly locks: Map<string, boolean> = new Map();
  private timeoutCheckInterval?: NodeJS.Timeout;
  private started = false;
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
  }

  /**
   * Start background timeout checker
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startTimeoutChecker();
  }

  /**
   * Stop background timeout checker
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = undefined;
    }
    this.started = false;
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
    requireOrderId(orderId, 'Order ID is required for state machine creation');

    if (this.stateMachines.has(orderId)) {
      throw new Error(`State machine already exists for order ${orderId}`);
    }

    const now = Date.now();
    const stateMachine = buildInitialStateMachine(orderId, now, options);

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
    requireOrderId(orderId, 'Order ID is required for state transition');
    requireTargetState(toState);
    const stateMachine = requireStateMachine(this.stateMachines.get(orderId), orderId);

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
          return createBlockedStateTransitionRecord(
            TRANSITION_ID_PREFIX,
            stateMachine.currentState,
            Date.now()
          );
        }
      }

      // Fallback without ErrorHandler
      return createBlockedStateTransitionRecord(
        TRANSITION_ID_PREFIX,
        stateMachine.currentState,
        Date.now()
      );
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
            `Invalid state transition: ${stateMachine.currentState} -> ${toState}`
          );
        }
      }

      const transition = createStateTransitionRecord({
        transitionIdPrefix: TRANSITION_ID_PREFIX,
        orderId,
        fromState: stateMachine.currentState,
        toState,
        reason: options.reason,
        triggeredBy: options.triggeredBy,
        metadata: options.metadata,
        timestamp: Date.now(),
      });
      applyStateTransition({
        stateMachine,
        transition,
        maxTransitionHistory: MAX_TRANSITION_HISTORY,
        stateTimeouts: STATE_TIMEOUTS,
      });

      // Update stats
      this.stats.totalTransitions++;

      invokeStateChangeCallback(stateMachine.onStateChange, transition, {
        errorHandler: this.errorHandler,
        context: 'AdvancedOrderStateMachineService.transitionState.callback',
        onLogFailure: (message) => this.safeLog(message),
        failureMessage: `State change callback failed for order ${orderId}`,
      });

      this.safeLog(
        `State transition: ${transition.from} -> ${transition.to} (${orderId})`
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
    requireOrderId(orderId, 'Order ID is required for timeout handling');
    const stateMachine = requireStateMachine(this.stateMachines.get(orderId), orderId);

    // Check if order has timed out
    const now = Date.now();
    if (!stateMachine.timeoutAt || now < stateMachine.timeoutAt) {
      return null; // Not timed out yet
    }

    this.safeLog(`Order ${orderId} timed out in state ${stateMachine.currentState}`);
    this.stats.timeoutCount++;

    invokeTimeoutCallback(stateMachine.onTimeout, {
      errorHandler: this.errorHandler,
      context: 'AdvancedOrderStateMachineService.handleTimeout.callback',
      onLogFailure: (message) => this.safeLog(message),
      failureMessage: `Timeout callback failed for order ${orderId}`,
    });

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
    requireOrderId(orderId, 'Order ID is required for partial fill handling');
    requirePositiveFillSizes(filledSize, totalSize);
    requireStateMachine(this.stateMachines.get(orderId), orderId);

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
    requireOrderId(orderId, 'Order ID is required for cancellation');
    requireStateMachine(this.stateMachines.get(orderId), orderId);

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
    requireOrderId(orderId, 'Order ID is required for error handling');
    requireErrorObject(error);
    const stateMachine = requireStateMachine(this.stateMachines.get(orderId), orderId);

    this.safeLog(`Error occurred for order ${orderId}: ${error.message}`);
    this.stats.errorCount++;

    invokeErrorCallback(stateMachine.onError, error, {
      errorHandler: this.errorHandler,
      context: 'AdvancedOrderStateMachineService.handleError.callback',
      onLogFailure: (message) => this.safeLog(message),
      failureMessage: `Error callback failed for order ${orderId}`,
    });

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
    requireOrderId(orderId, 'Order ID is required to get history');
    const stateMachine = requireStateMachine(this.stateMachines.get(orderId), orderId);
    return getStateMachineHistorySnapshot(stateMachine);
  }

  /**
   * Get a detached snapshot of the tracked state machine for observational reads.
   */
  getStateMachineSnapshot(orderId: string): OrderStateMachine | undefined {
    return getStateMachineSnapshot(this.stateMachines.get(orderId));
  }

  /**
   * Get the live mutable state machine for an order.
   * Use getStateMachineSnapshot for read-only inspection.
   */
  getStateMachine(orderId: string): OrderStateMachine | undefined {
    return this.stateMachines.get(orderId);
  }

  /**
   * Get current state for an order
   */
  getCurrentState(orderId: string): OrderState | undefined {
    return getStateMachineCurrentState(this.stateMachines.get(orderId));
  }

  /**
   * Check if order is in terminal state
   */
  isTerminalState(orderId: string): boolean {
    return isStateMachineTerminal(this.stateMachines.get(orderId), TERMINAL_STATES);
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
    requireOrderId(orderId, 'Order ID is required for removal');

    clearStateMachineResources(this.stateMachines, this.locks, orderId);
    this.safeLog(`State machine removed for order ${orderId}`);
  }

  /**
   * Cleanup service (stop timeout checker)
   */
  cleanup(): void {
    this.stop();
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
        markLockAcquired(this.stateMachines.get(orderId), Date.now());
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
    markLockReleased(this.stateMachines.get(orderId));
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
      handleSkippableError({
        error: rollbackError,
        errorHandler: this.errorHandler,
        context: 'AdvancedOrderStateMachineService.rollbackState',
        logMessage: `Rollback failed for order ${orderId}: ${rollbackError}`,
        safeLog: (message) => this.safeLog(message),
      });
    }
  }

  /**
   * Start timeout checker (runs every second)
   */
  private startTimeoutChecker(): void {
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        handleSkippableError({
          error,
          errorHandler: this.errorHandler,
          context: 'AdvancedOrderStateMachineService.startTimeoutChecker',
          logMessage: `Timeout checker error: ${error}`,
          safeLog: (message) => this.safeLog(message),
        });
      });
    }, STATE_CHECK_INTERVAL_MS);
  }

  /**
   * Check all state machines for timeouts
   */
  private async checkTimeouts(): Promise<void> {
    const now = Date.now();

    for (const [orderId, stateMachine] of this.stateMachines) {
      if (!shouldProcessTimeout(stateMachine, now)) {
        continue;
      }

      try {
        await this.handleTimeout(orderId);
      } catch (error) {
        handleSkippableError({
          error,
          errorHandler: this.errorHandler,
          context: 'AdvancedOrderStateMachineService.checkTimeouts',
          logMessage: `Failed to handle timeout for order ${orderId}: ${error}`,
          safeLog: (message) => this.safeLog(message),
        });
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
    safeLogWithRecovery({
      logger: this.logger,
      errorHandler: this.errorHandler,
      message,
      level,
      context: { service: 'AdvancedOrderStateMachineService' },
      errorContext: 'AdvancedOrderStateMachineService.safeLog',
    });
  }
}
