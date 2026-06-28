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
import type {
  PositionClosedEventPayload,
  PositionOpenedEventPayload,
} from '../types/bot-events';
import { ActionQueueService } from './action-queue.service';
import type { ILifecycle } from '../interfaces/ILifecycle';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { evaluatePositionTimeout } from './trading-lifecycle/trading-lifecycle-timeout.utils';
import { tryUpdatePositionState } from './trading-lifecycle/trading-lifecycle-state.utils';
import { publishEventWithRetryOrWarn } from './trading-lifecycle/trading-lifecycle-event.utils';
import { getErrorMessage, normalizeError } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

export class TradingLifecycleManager implements ITradingLifecycleManager, ILifecycle {
  private config: PositionLifecycleConfig;
  private trackedPositions: Map<string, TrackedPosition>;
  private warningEmittedFor: Set<string>;
  private logger: LoggerService;
  private eventBus: BotEventBus;
  private actionQueue: ActionQueueService;
  private errorHandler?: ErrorHandler;
  private started = false;
  private unsubscribeHandlers: Array<() => void> = [];

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

  private async handleRecoveryError(error: unknown, strategy: RecoveryStrategy, context: string): Promise<void> {
    if (!this.errorHandler) {
      return;
    }

    await this.errorHandler.handle(normalizeError(error), {
      strategy,
      context,
    });
  }

  private initializeEventSubscriptions(): void {
    this.unsubscribeHandlers = [];
    const unsubscribeOpened = this.eventBus.subscribe('position-opened', (event: PositionOpenedEventPayload) => {
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
        this.logger.info(`${ICONS.note} [TradingLifecycleManager] Tracking position: ${position.id} (${position.symbol})`);
      }
    });

    const unsubscribeClosed = this.eventBus.subscribe('position-closed', (event: PositionClosedEventPayload) => {
      const positionId = this.getClosedPositionId(event);
      if (positionId) {
        this.untrackPosition(positionId);
        this.logger.info(`${ICONS.note} [TradingLifecycleManager] Untracking closed position: ${positionId}`);
      }
    });

    if (typeof unsubscribeOpened === 'function') {
      this.unsubscribeHandlers.push(unsubscribeOpened);
    }
    if (typeof unsubscribeClosed === 'function') {
      this.unsubscribeHandlers.push(unsubscribeClosed);
    }
  }

  private getOpenedPosition(event: PositionOpenedEventPayload): Position | null {
    if (this.isPosition(event)) {
      return event;
    }
    return this.isPosition(event.position) ? event.position : null;
  }

  private getClosedPositionId(event: PositionClosedEventPayload): string | null {
    if (this.isPosition(event)) {
      return event.id;
    }
    if (typeof event.positionId === 'string' && event.positionId.length > 0) {
      return event.positionId;
    }
    if (this.isPosition(event.position) && event.position.id.length > 0) {
      return event.position.id;
    }
    if (this.isPosition(event.closedPosition) && event.closedPosition.id.length > 0) {
      return event.closedPosition.id;
    }
    return null;
  }

  private isPosition(value: unknown): value is Position {
    return typeof value === 'object'
      && value !== null
      && typeof (value as Position).id === 'string'
      && typeof (value as Position).symbol === 'string';
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.initializeEventSubscriptions();
  }

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

  public trackPosition(position: TrackedPosition): void {
    if (!position.positionId) {
      this.logger.warn(`${ICONS.warning} [TradingLifecycleManager] Cannot track position without ID`);
      return;
    }

    this.trackedPositions.set(position.positionId, {
      ...position,
      lastUpdateTime: Date.now(),
    });

    this.logger.debug(`${ICONS.note} [TradingLifecycleManager] Tracking position: ${position.positionId}`, {
      symbol: position.symbol,
      quantity: position.quantity,
      maxHoldingMinutes: this.config.maxHoldingTimeMinutes,
    });
  }

  public untrackPosition(positionId: string): void {
    const existed = this.trackedPositions.delete(positionId);
    if (existed) {
      this.warningEmittedFor.delete(positionId);
      this.logger.debug(`${ICONS.note} [TradingLifecycleManager] Untracked position: ${positionId}`);
    }
  }

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

      const timeout = evaluatePositionTimeout({
        position,
        holdingTimeMinutes,
        maxHoldingMinutes,
        warningThresholdMinutes,
      });
      let newState = timeout.newState;
      if (timeout.isCritical) {
        anyCritical = true;
        if (timeout.alert) {
          alerts.push(timeout.alert);
        }

        this.logger.warn(
          `${ICONS.alarm} [TradingLifecycleManager] CRITICAL TIMEOUT: ${position.symbol} position has exceeded max holding time (${holdingTimeMinutes.toFixed(1)} minutes)`
        );

        if (this.config.enableAutomaticTimeout) {
          await this.handlePositionTimeout(position);
        }
      } else if (timeout.isWarning) {
        anyWarnings = true;

        if (!this.warningEmittedFor.has(positionId)) {
          if (timeout.alert) {
            alerts.push(timeout.alert);
          }
          const roundedHoldingMinutes = timeout.alert?.holdingTimeMinutes ?? Math.round(holdingTimeMinutes);
          const minutesUntilTimeout = timeout.alert?.minutesUntilTimeout ?? Math.round(maxHoldingMinutes - holdingTimeMinutes);

          await this.emitWarningTimeoutEvent({
            positionId: position.positionId,
            symbol: position.symbol,
            holdingTimeMinutes: roundedHoldingMinutes,
            minutesUntilTimeout,
            timestamp: now,
          });

          this.warningEmittedFor.add(positionId);
          this.logger.warn(
            `${ICONS.warning} [TradingLifecycleManager] WARNING TIMEOUT: ${position.symbol} position approaching max holding time (${holdingTimeMinutes.toFixed(1)} minutes)`
          );
        }
      }

      await tryUpdatePositionState({
        position,
        nextState: newState,
        validateTransition: (from, to) => this.validateStateTransition(from, to),
        errorHandler: this.errorHandler,
        logger: this.logger,
        context: `TradingLifecycleManager.updatePositionState[${position.positionId}]`,
        warnMessage: `[TradingLifecycleManager] Failed to update state for ${position.positionId}, continuing with old state`,
        timestamp: now,
      });
    }

    return {
      positions: alerts,
      anyWarnings,
      anyCritical,
    };
  }

  private async emitWarningTimeoutEvent(payload: {
    positionId: string;
    symbol: string;
    holdingTimeMinutes: number;
    minutesUntilTimeout: number;
    timestamp: number;
  }): Promise<void> {
    const eventData: PositionTimeoutWarningEvent = {
      positionId: payload.positionId,
      symbol: payload.symbol,
      holdingTimeMinutes: payload.holdingTimeMinutes,
      minutesUntilTimeout: payload.minutesUntilTimeout,
    };

    await publishEventWithRetryOrWarn({
      eventBus: this.eventBus,
      errorHandler: this.errorHandler,
      type: LiveTradingEventType.POSITION_TIMEOUT_WARNING,
      data: eventData,
      timestamp: payload.timestamp,
      context: `TradingLifecycleManager.emitWarningEvent[${payload.positionId}]`,
      onFailure: (error) => {
        this.logger.warn(
          `${ICONS.warning} [TradingLifecycleManager] Failed to emit warning event for ${payload.positionId}: ${getErrorMessage(error)}`
        );
      },
    });
  }

  private async emitEmergencyCloseEvent(request: EmergencyCloseRequest): Promise<void> {
    const eventData = {
      positionId: request.positionId,
      reason: request.reason,
      priority: request.priority,
      details: request.details,
    };

    const timestamp = Date.now();
    await publishEventWithRetryOrWarn({
      eventBus: this.eventBus,
      errorHandler: this.errorHandler,
      type: LiveTradingEventType.POSITION_TIMEOUT_TRIGGERED,
      data: eventData,
      timestamp,
      context: `TradingLifecycleManager.emitEmergencyCloseEvent[${request.positionId}]`,
      onFailure: (error) => {
        this.logger.warn(
          `${ICONS.warning} [TradingLifecycleManager] Failed emergency close event publication for ${request.positionId}: ${getErrorMessage(error)}`
        );
      },
    });
  }

  private buildEmergencyCloseAction(request: EmergencyCloseRequest): IAction {
    return {
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
  }

  public async handlePositionTimeout(position: TrackedPosition): Promise<void> {
    this.logger.warn(`${ICONS.alarm} [TradingLifecycleManager] Initiating emergency close for ${position.symbol} position: ${position.positionId}`);

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

    await this.triggerEmergencyClose(request);
  }

  public async triggerEmergencyClose(request: EmergencyCloseRequest): Promise<void> {
    const position = this.trackedPositions.get(request.positionId);
    if (!position) {
      this.logger.warn(
        `${ICONS.warning} [TradingLifecycleManager] Position not found for emergency close: ${request.positionId}`
      );
      return;
    }

    try {
      await tryUpdatePositionState({
        position,
        nextState: PositionLifecycleState.CLOSING,
        validateTransition: (from, to) => this.validateStateTransition(from, to),
        errorHandler: this.errorHandler,
        logger: this.logger,
        context: `TradingLifecycleManager.setClosingState[${request.positionId}]`,
        warnMessage: '[TradingLifecycleManager] Failed to update state to CLOSING, proceeding with emergency close',
        timestamp: Date.now(),
      });

      await this.emitEmergencyCloseEvent(request);

      try {
        const closeAction = this.buildEmergencyCloseAction(request);

        if (this.errorHandler) {
          await this.errorHandler.executeAsync(
            async () => {
              this.actionQueue.enqueue(closeAction);
            },
            {
              strategy: RecoveryStrategy.FALLBACK,
              context: `TradingLifecycleManager.enqueueEmergencyClose[${request.positionId}]`,
              onFailure: () => {
                this.logger.error(
                  `${ICONS.warning} [TradingLifecycleManager] Fallback: Emergency close action queued with potential delays for ${position.symbol}`
                );
              },
            }
          );
        } else {
          this.actionQueue.enqueue(closeAction);
        }
      } catch (queueError) {
        this.logger.error(
          `${ICONS.warning} [TradingLifecycleManager] Fallback: Failed to queue emergency close, attempting direct notification`
        );
        if (this.errorHandler) {
          await this.handleRecoveryError(
            queueError,
            RecoveryStrategy.FALLBACK,
            `TradingLifecycleManager.emergencyCloseFallback[${request.positionId}]`,
          );
        }
      }

      this.logger.info(
        `${ICONS.success} [TradingLifecycleManager] Emergency close queued for ${position.symbol} (${request.reason})`
      );
    } catch (error) {
      this.logger.error(`${ICONS.error} [TradingLifecycleManager] Error triggering emergency close: ${error}`, {
        positionId: request.positionId,
        error: getErrorMessage(error),
      });
    }
  }

  public validateStateTransition(from: PositionLifecycleState, to: PositionLifecycleState): boolean {
    const allowedTransitions = this.VALID_STATE_TRANSITIONS.get(from);
    if (!allowedTransitions) {
      this.logger.warn(`${ICONS.warning} [TradingLifecycleManager] Unknown state: ${from}`);
      return false;
    }

    const isValid = allowedTransitions.includes(to);
    if (!isValid) {
      this.logger.warn(`${ICONS.warning} [TradingLifecycleManager] Invalid state transition from ${from} to ${to}`);
    }
    return isValid;
  }

  public getTrackedPositions(): TrackedPosition[] {
    return Array.from(this.trackedPositions.values());
  }

  public getTrackedPosition(positionId: string): TrackedPosition | undefined {
    return this.trackedPositions.get(positionId);
  }

  public getTrackedPositionCount(): number {
    return this.trackedPositions.size;
  }

  public clearAllTrackedPositions(): void {
    this.trackedPositions.clear();
    this.warningEmittedFor.clear();
    this.logger.info(`${ICONS.broom} [TradingLifecycleManager] Cleared all tracked positions`);
  }

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

