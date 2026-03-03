/**
 * Phase 9: Trading Lifecycle Manager Service
 *
 * Orchestrates the full position lifecycle with:
 * - Position timeout detection and handling
 * - Holding time tracking from open → close
 * - Emergency close triggers
 * - State validation before transitions
 *
 * Subscribes to EventBus events:
 * - position-opened: Track new positions
 * - position-closed: Stop tracking closed positions
 *
 * Emits EventBus events:
 * - position-timeout-warning: Position approaching timeout
 * - position-timeout-critical: Position at timeout threshold
 * - position-timeout-triggered: Emergency close initiated
 */

import { BotEventBus } from './event-bus';
import {
  LoggerService,
  PositionSide,
  ActionType,
  PositionLifecycleConfig,
  TrackedPosition,
  TimeoutCheckResult,
  TimeoutAlert,
  EmergencyCloseRequest,
  EmergencyCloseReason,
  PositionLifecycleState,
  ITradingLifecycleManager,
  LiveTradingEventType,
  PositionTimeoutWarningEvent,
  Position,
  IAction,
} from '../types/legacy';
import { ActionQueueService } from './action-queue.service';
import type { ILifecycle } from '../interfaces/ILifecycle';
import { ErrorHandler, RecoveryStrategy } from '../errors';

/**
 * TradingLifecycleManager: Orchestrates position lifecycle with timeout detection
 *
 * Responsibilities:
 * 1. Track all open positions with timing metadata
 * 2. Detect positions approaching/exceeding timeout thresholds
 * 3. Emit warnings before emergency close
 * 4. Execute emergency closes via ActionQueue
 * 5. Validate state transitions
 *
 * Architecture:
 * - Subscribes to position lifecycle events
 * - Maintains in-memory map of tracked positions
 * - Checks timeouts on each candle or explicit call
 * - Delegates emergency close execution to ActionQueue
 */
export class TradingLifecycleManager implements ITradingLifecycleManager, ILifecycle {
  private config: PositionLifecycleConfig;
  private trackedPositions: Map<string, TrackedPosition>;
  private warningEmittedFor: Set<string>; // Track which positions we've warned about
  private logger: LoggerService;
  private eventBus: BotEventBus;
  private actionQueue: ActionQueueService;
  private errorHandler?: ErrorHandler;
  private started = false;
  private unsubscribeHandlers: Array<() => void> = [];

  // State machine: Valid transitions for position lifecycle
  private readonly VALID_STATE_TRANSITIONS: Map<PositionLifecycleState, PositionLifecycleState[]> = new Map([
    [PositionLifecycleState.OPEN, [PositionLifecycleState.WARNING, PositionLifecycleState.CLOSING, PositionLifecycleState.CLOSED]],
    [PositionLifecycleState.WARNING, [PositionLifecycleState.CRITICAL, PositionLifecycleState.CLOSING, PositionLifecycleState.CLOSED]],
    [PositionLifecycleState.CRITICAL, [PositionLifecycleState.CLOSING, PositionLifecycleState.CLOSED]],
    [PositionLifecycleState.CLOSING, [PositionLifecycleState.CLOSED]],
    [PositionLifecycleState.CLOSED, []],
  ]);

  constructor(
    config: PositionLifecycleConfig,
    logger: LoggerService,
    eventBus: BotEventBus,
    actionQueue: ActionQueueService,
    errorHandler?: ErrorHandler
  ) {
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;
    this.actionQueue = actionQueue;
    this.errorHandler = errorHandler;
    this.trackedPositions = new Map();
    this.warningEmittedFor = new Set();
  }

  /**
   * Subscribe to position lifecycle events
   */
  private initializeEventSubscriptions(): void {
    this.unsubscribeHandlers = [];
    // Listen for position opens
    const unsubscribeOpened = this.eventBus.subscribe('position-opened', (event: unknown) => {
      const position = this.getOpenedPosition(event);
      if (position && position.id) {
        this.trackPosition({
          positionId: position.id,
          symbol: position.symbol,
          direction: position.side as 'LONG' | 'SHORT',
          entryPrice: position.entryPrice,
          entryTime: position.openedAt || Date.now(),
          quantity: position.quantity,
          totalExposureUsdt: position.marginUsed || position.quantity * position.entryPrice,
          state: PositionLifecycleState.OPEN,
          lastUpdateTime: Date.now(),
        });
        this.logger.info(`[TradingLifecycleManager] Tracking position: ${position.id} (${position.symbol})`);
      }
    });

    // Listen for position closes
    const unsubscribeClosed = this.eventBus.subscribe('position-closed', (event: unknown) => {
      const positionId = this.getClosedPositionId(event);
      if (positionId) {
        this.untrackPosition(positionId);
        this.logger.info(`[TradingLifecycleManager] Untracking closed position: ${positionId}`);
      }
    });

    if (typeof unsubscribeOpened === 'function') {
      this.unsubscribeHandlers.push(unsubscribeOpened);
    }
    if (typeof unsubscribeClosed === 'function') {
      this.unsubscribeHandlers.push(unsubscribeClosed);
    }
  }

  private getOpenedPosition(event: unknown): Position | null {
    if (typeof event !== 'object' || event === null) {
      return null;
    }
    const candidate = event as { position?: unknown };
    if (typeof candidate.position !== 'object' || candidate.position === null) {
      return null;
    }
    return candidate.position as Position;
  }

  private getClosedPositionId(event: unknown): string | null {
    if (typeof event !== 'object' || event === null) {
      return null;
    }
    const candidate = event as { positionId?: unknown; position?: { id?: unknown } };
    if (typeof candidate.positionId === 'string' && candidate.positionId.length > 0) {
      return candidate.positionId;
    }
    if (typeof candidate.position?.id === 'string' && candidate.position.id.length > 0) {
      return candidate.position.id;
    }
    return null;
  }

  /**
   * Start lifecycle (subscribe to EventBus)
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.initializeEventSubscriptions();
  }

  /**
   * Stop lifecycle (unsubscribe from EventBus)
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    for (const unsubscribe of this.unsubscribeHandlers) {
      try {
        unsubscribe();
      } catch {
        // Ignore unsubscribe failures
      }
    }
    this.unsubscribeHandlers = [];
    this.started = false;
  }

  /**
   * Track a position for timeout monitoring
   */
  public trackPosition(position: TrackedPosition): void {
    if (!position.positionId) {
      this.logger.warn('[TradingLifecycleManager] Cannot track position without ID');
      return;
    }

    this.trackedPositions.set(position.positionId, {
      ...position,
      lastUpdateTime: Date.now(),
    });

    this.logger.debug(`[TradingLifecycleManager] Tracking position: ${position.positionId}`, {
      symbol: position.symbol,
      quantity: position.quantity,
      maxHoldingMinutes: this.config.maxHoldingTimeMinutes,
    });
  }

  /**
   * Stop tracking a closed position
   */
  public untrackPosition(positionId: string): void {
    const existed = this.trackedPositions.delete(positionId);
    if (existed) {
      this.warningEmittedFor.delete(positionId);
      this.logger.debug(`[TradingLifecycleManager] Untracked position: ${positionId}`);
    }
  }

  /**
   * Check all tracked positions for timeout conditions
   * Returns comprehensive timeout detection result
   */
  public async checkPositionTimeouts(): Promise<TimeoutCheckResult> {
    const now = Date.now();
    const alerts: TimeoutAlert[] = [];
    let anyWarnings = false;
    let anyCritical = false;

    for (const [positionId, position] of this.trackedPositions.entries()) {
      const holdingTimeMs = now - position.entryTime;
      const holdingTimeMinutes = holdingTimeMs / 1000 / 60;

      const maxHoldingMinutes = this.config.maxHoldingTimeMinutes;
      const warningThresholdMinutes = this.config.warningThresholdMinutes;

      let newState = position.state;
      let isWarning = false;
      let isCritical = false;

      // Check timeout thresholds
      if (holdingTimeMinutes >= maxHoldingMinutes) {
        // Position has exceeded maximum holding time
        newState = PositionLifecycleState.CRITICAL;
        isCritical = true;
        anyCritical = true;

        // Emit critical alert
        const criticalAlert: TimeoutAlert = {
          positionId: position.positionId,
          symbol: position.symbol,
          holdingTimeMinutes: Math.round(holdingTimeMinutes),
          state: newState,
          minutesUntilTimeout: Math.round(holdingTimeMinutes - maxHoldingMinutes) * -1,
        };
        alerts.push(criticalAlert);

        this.logger.warn(
          `[TradingLifecycleManager] CRITICAL TIMEOUT: ${position.symbol} position has exceeded max holding time (${holdingTimeMinutes.toFixed(1)} minutes)`
        );

        // Trigger emergency close if enabled
        if (this.config.enableAutomaticTimeout) {
          await this.handlePositionTimeout(position);
        }
      } else if (holdingTimeMinutes >= warningThresholdMinutes) {
        // Position is approaching timeout threshold
        newState = PositionLifecycleState.WARNING;
        isWarning = true;
        anyWarnings = true;

        // Emit warning alert only once per position
        if (!this.warningEmittedFor.has(positionId)) {
          const warningAlert: TimeoutAlert = {
            positionId: position.positionId,
            symbol: position.symbol,
            holdingTimeMinutes: Math.round(holdingTimeMinutes),
            state: newState,
            minutesUntilTimeout: Math.round(maxHoldingMinutes - holdingTimeMinutes),
          };
          alerts.push(warningAlert);

          // RETRY Strategy: Emit warning event with error recovery
          if (this.errorHandler) {
            try {
              await this.errorHandler.executeAsync(
                async () => {
                  this.eventBus.publishSync({
                    type: LiveTradingEventType.POSITION_TIMEOUT_WARNING,
                    data: {
                      positionId: position.positionId,
                      symbol: position.symbol,
                      holdingTimeMinutes: Math.round(holdingTimeMinutes),
                      minutesUntilTimeout: Math.round(maxHoldingMinutes - holdingTimeMinutes),
                    } as PositionTimeoutWarningEvent,
                    timestamp: now,
                  });
                },
                {
                  strategy: RecoveryStrategy.RETRY,
                  context: `TradingLifecycleManager.emitWarningEvent[${position.positionId}]`,
                  retryConfig: {
                    maxAttempts: 2,
                    initialDelayMs: 100,
                    backoffMultiplier: 2,
                    maxDelayMs: 400,
                  },
                }
              );
            } catch (error) {
              // SKIP: Event publishing failure doesn't block timeout detection
              this.logger.warn(
                `[TradingLifecycleManager] Failed to emit warning event for ${position.positionId}: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          } else {
            // Fallback without ErrorHandler
            this.eventBus.publishSync({
              type: LiveTradingEventType.POSITION_TIMEOUT_WARNING,
              data: {
                positionId: position.positionId,
                symbol: position.symbol,
                holdingTimeMinutes: Math.round(holdingTimeMinutes),
                minutesUntilTimeout: Math.round(maxHoldingMinutes - holdingTimeMinutes),
              } as PositionTimeoutWarningEvent,
              timestamp: now,
            });
          }

          this.warningEmittedFor.add(positionId);
          this.logger.warn(
            `[TradingLifecycleManager] WARNING TIMEOUT: ${position.symbol} position approaching max holding time (${holdingTimeMinutes.toFixed(1)} minutes)`
          );
        }
      } else {
        // Position is safe
        newState = PositionLifecycleState.OPEN;
      }

      // GRACEFUL_DEGRADE Strategy: Update position state despite validation errors
      if (newState !== position.state) {
        if (this.validateStateTransition(position.state, newState)) {
          try {
            position.state = newState;
            position.lastUpdateTime = now;
          } catch (error) {
            // GRACEFUL_DEGRADE: Log error but continue with old state
            if (this.errorHandler) {
              await this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
                context: `TradingLifecycleManager.updatePositionState[${position.positionId}]`,
              });
            }
            this.logger.warn(
              `[TradingLifecycleManager] Failed to update state for ${position.positionId}, continuing with old state`
            );
          }
        }
      }
    }

    return {
      positions: alerts,
      anyWarnings,
      anyCritical,
    };
  }

  /**
   * Handle a position timeout by initiating emergency close
   */
  public async handlePositionTimeout(position: TrackedPosition): Promise<void> {
    this.logger.warn(`[TradingLifecycleManager] Initiating emergency close for ${position.symbol} position: ${position.positionId}`);

    // Create emergency close request
    const request: EmergencyCloseRequest = {
      positionId: position.positionId,
      reason: EmergencyCloseReason.POSITION_TIMEOUT,
      priority: 'CRITICAL',
      details: {
        holdingTimeMinutes: (Date.now() - position.entryTime) / 1000 / 60,
        maxHoldingMinutes: this.config.maxHoldingTimeMinutes,
        symbol: position.symbol,
        quantity: position.quantity,
      },
    };

    // Delegate to triggerEmergencyClose
    await this.triggerEmergencyClose(request);
  }

  /**
   * Trigger emergency close via ActionQueue
   * Closes entire position (100%)
   */
  public async triggerEmergencyClose(request: EmergencyCloseRequest): Promise<void> {
    const position = this.trackedPositions.get(request.positionId);
    if (!position) {
      this.logger.warn(
        `[TradingLifecycleManager] Position not found for emergency close: ${request.positionId}`
      );
      return;
    }

    try {
      // Update position state to CLOSING
      if (this.validateStateTransition(position.state, PositionLifecycleState.CLOSING)) {
        try {
          position.state = PositionLifecycleState.CLOSING;
          position.lastUpdateTime = Date.now();
        } catch (stateError) {
          // GRACEFUL_DEGRADE: State update failure doesn't block emergency close
          if (this.errorHandler) {
            await this.errorHandler.handle(stateError, {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
              context: `TradingLifecycleManager.setClosingState[${request.positionId}]`,
            });
          }
          this.logger.warn(
            `[TradingLifecycleManager] Failed to update state to CLOSING, proceeding with emergency close`
          );
        }
      }

      // RETRY Strategy: Emit emergency close event with error recovery
      try {
        if (this.errorHandler) {
          await this.errorHandler.executeAsync(
            async () => {
              this.eventBus.publishSync({
                type: LiveTradingEventType.POSITION_TIMEOUT_TRIGGERED,
                data: {
                  positionId: request.positionId,
                  reason: request.reason,
                  priority: request.priority,
                  details: request.details,
                },
                timestamp: Date.now(),
              });
            },
            {
              strategy: RecoveryStrategy.RETRY,
              context: `TradingLifecycleManager.emitEmergencyCloseEvent[${request.positionId}]`,
              retryConfig: {
                maxAttempts: 2,
                initialDelayMs: 100,
                backoffMultiplier: 2,
                maxDelayMs: 400,
              },
            }
          );
        } else {
          // Fallback without ErrorHandler
          this.eventBus.publishSync({
            type: LiveTradingEventType.POSITION_TIMEOUT_TRIGGERED,
            data: {
              positionId: request.positionId,
              reason: request.reason,
              priority: request.priority,
              details: request.details,
            },
            timestamp: Date.now(),
          });
        }
      } catch (eventError) {
        // SKIP: Event publishing failure doesn't block action queueing
        this.logger.warn(
          `[TradingLifecycleManager] Failed to emit emergency close event: ${eventError instanceof Error ? eventError.message : String(eventError)}`
        );
      }

      // FALLBACK Strategy: Queue close action with error recovery
      try {
        const closeAction: IAction = {
          id: `action-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          type: ActionType.CLOSE_PERCENT,
          timestamp: Date.now(),
          priority: 'HIGH' as const,
          metadata: {
            positionId: request.positionId,
            percent: 100,
            reason: request.reason,
          },
        };

        if (this.errorHandler) {
          await this.errorHandler.executeAsync(
            async () => {
              this.actionQueue.enqueue(closeAction);
            },
            {
              strategy: RecoveryStrategy.FALLBACK,
              context: `TradingLifecycleManager.enqueueEmergencyClose[${request.positionId}]`,
              onFailure: () => {
                // FALLBACK: Log fallback action if queueing fails
                this.logger.error(
                  `[TradingLifecycleManager] Fallback: Emergency close action queued with potential delays for ${position.symbol}`
                );
              },
            }
          );
        } else {
          // Fallback without ErrorHandler
          this.actionQueue.enqueue(closeAction);
        }
      } catch (queueError) {
        // FALLBACK: Log detailed error but continue
        this.logger.error(
          `[TradingLifecycleManager] Fallback: Failed to queue emergency close, attempting direct notification`
        );
        if (this.errorHandler) {
          await this.errorHandler.handle(queueError, {
            strategy: RecoveryStrategy.FALLBACK,
            context: `TradingLifecycleManager.emergencyCloseFallback[${request.positionId}]`,
          });
        }
      }

      this.logger.info(
        `[TradingLifecycleManager] Emergency close queued for ${position.symbol} (${request.reason})`
      );
    } catch (error) {
      this.logger.error(`[TradingLifecycleManager] Error triggering emergency close: ${error}`, {
        positionId: request.positionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate state transition according to state machine
   */
  public validateStateTransition(from: PositionLifecycleState, to: PositionLifecycleState): boolean {
    const allowedTransitions = this.VALID_STATE_TRANSITIONS.get(from);
    if (!allowedTransitions) {
      this.logger.warn(`[TradingLifecycleManager] Unknown state: ${from}`);
      return false;
    }

    const isValid = allowedTransitions.includes(to);
    if (!isValid) {
      this.logger.warn(`[TradingLifecycleManager] Invalid state transition: ${from} → ${to}`);
    }
    return isValid;
  }

  /**
   * Get all currently tracked positions
   */
  public getTrackedPositions(): TrackedPosition[] {
    return Array.from(this.trackedPositions.values());
  }

  /**
   * Get a specific tracked position
   */
  public getTrackedPosition(positionId: string): TrackedPosition | undefined {
    return this.trackedPositions.get(positionId);
  }

  /**
   * Get count of tracked positions
   */
  public getTrackedPositionCount(): number {
    return this.trackedPositions.size;
  }

  /**
   * Clear all tracked positions (used during shutdown)
   */
  public clearAllTrackedPositions(): void {
    this.trackedPositions.clear();
    this.warningEmittedFor.clear();
    this.logger.info('[TradingLifecycleManager] Cleared all tracked positions');
  }

  /**
   * Get lifecycle statistics
   */
  public getStatistics(): {
    totalTracked: number;
    byState: Record<string, number>;
    earliestOpenTime: number | null;
    averageHoldingMinutes: number;
  } {
    const now = Date.now();
    const positions = Array.from(this.trackedPositions.values());

    const byState: Record<string, number> = {
      [PositionLifecycleState.OPEN]: 0,
      [PositionLifecycleState.WARNING]: 0,
      [PositionLifecycleState.CRITICAL]: 0,
      [PositionLifecycleState.CLOSING]: 0,
      [PositionLifecycleState.CLOSED]: 0,
    };

    for (const pos of positions) {
      byState[pos.state]++;
    }

    const holdingTimes = positions.map((p) => (now - p.entryTime) / 1000 / 60);
    const averageHoldingMinutes = holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;

    const earliestOpenTime = positions.length > 0 ? Math.min(...positions.map((p) => p.entryTime)) : null;

    return {
      totalTracked: positions.length,
      byState,
      earliestOpenTime,
      averageHoldingMinutes: Math.round(averageHoldingMinutes * 10) / 10,
    };
  }
}

