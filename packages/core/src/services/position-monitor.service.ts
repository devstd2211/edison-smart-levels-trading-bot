import { DECIMAL_PLACES } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  POSITION_MONITOR_INTERVAL_MS,
  TIME_MULTIPLIERS,
} from '../constants/technical.constants';
/**
 * Position Monitor Service
 * Monitors open positions for TP/SL hits via WebSocket events
 *
 * Responsibilities:
 * 1. Listen to WebSocket order execution events
 * 2. Detect TP hits and trigger breakeven/trailing logic
 * 3. Periodic sync check with exchange
 *
 * Single Responsibility: Position monitoring and TP/SL event handling
 */

import { EventEmitter } from 'events';
import type { ILifecycle } from '../interfaces/ILifecycle';
import type { IExchange } from '../interfaces/IExchange';
import { PositionLifecycleService } from './position-lifecycle.service';
import type { LoggerService, Position, ProtectionVerification, RiskManagementConfig } from '../types/legacy';
import { isCriticalApiError } from '../utils/error-helper';
import { TelegramService } from './telegram.service';
import { ExitTypeDetectorService } from './exit-type-detector.service';
import { PositionPnLCalculatorService } from './position-pnl-calculator.service';
import { PositionSyncService } from './position-sync.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';
import {
  buildTimeBasedExitDecision,
  buildUnprotectedPositionDetails,
  isClosedPosition,
  isExchangePositionClosed,
  isStopLossHit,
  markProtectionVerified,
  toProtectionVerificationSide,
  type TimeBasedExitDecision,
} from './position-monitor/position-monitor-state.utils';

const DEEP_SYNC_INTERVAL_MS =
  TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND * INTEGER_MULTIPLIERS.THIRTY;

type PositionCloseRecorder = {
  closeFullPosition(
    position: Position | null | undefined,
    exitPrice: number,
    exitReason: string,
    exitType: import('../types/legacy').ExitType,
  ): Promise<boolean>;
};

export class PositionMonitorService extends EventEmitter implements ILifecycle {
  private monitorInterval: NodeJS.Timeout | null = null;
  private deepSyncInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private criticalErrorEmitted = false;

  constructor(
    private readonly bybitService: IExchange,
    private readonly positionManager: PositionLifecycleService,
    private readonly riskConfig: RiskManagementConfig,
    private readonly telegram: TelegramService,
    private readonly logger: LoggerService,
    private readonly exitTypeDetectorService: ExitTypeDetectorService,
    private readonly pnlCalculator: PositionPnLCalculatorService,
    private readonly positionSyncService: PositionSyncService,
    private readonly positionExitingService?: PositionCloseRecorder,
    private readonly errorHandler?: ErrorHandler,
  ) {
    super();
  }

  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      void this.monitorPosition();
    }, POSITION_MONITOR_INTERVAL_MS);
    this.deepSyncInterval = setInterval(() => {
      void this.deepSyncCheck();
    }, DEEP_SYNC_INTERVAL_MS);

    this.emit('started');
  }

  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitorInterval !== null) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.deepSyncInterval !== null) {
      clearInterval(this.deepSyncInterval);
      this.deepSyncInterval = null;
    }

    this.emit('stopped');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  private async monitorPosition(): Promise<void> {
    try {
      const currentPosition = this.positionManager.getCurrentPosition();

      if (currentPosition === null) {
        return;
      }

      if (isClosedPosition(currentPosition)) {
        this.logger.debug('Position already closed, skipping monitor check');
        return;
      }

      const exchangePosition = await this.getExchangePosition(currentPosition);
      if (isExchangePositionClosed(exchangePosition)) {
        const syncedClosedPosition = await this.syncClosedPositionIfNeeded(currentPosition);
        if (syncedClosedPosition) {
          return;
        }
      }

      if (!currentPosition.protectionVerifiedOnce) {
        this.logger.debug('Initial protection verification check');
        const protection = await this.verifyInitialProtection(currentPosition);
        if (!protection.verified) {
          await this.handleUnprotectedPosition(currentPosition, protection);
          return;
        }
      }

      const currentPrice = await this.getCurrentPriceSafely();
      if (currentPrice === null) {
        return;
      }

      if (this.positionManager.getCurrentPosition() === null) {
        this.logger.debug('Position closed during price fetch, skipping checks');
        return;
      }

      if (isStopLossHit(currentPosition, currentPrice)) {
        this.emit('stopLossHit', {
          position: currentPosition,
          currentPrice,
          reason: `Stop Loss hit at ${currentPrice}`,
        });
      }

      let timeBasedExit: TimeBasedExitDecision;
      try {
        timeBasedExit = this.checkTimeBasedExit(currentPosition, currentPrice);
      } catch (timeExitError) {
        this.logger.warn('Failed to check time-based exit', {
          error: getErrorMessage(timeExitError),
        });
        return;
      }

      if (timeBasedExit.shouldExit) {
        this.emit('timeBasedExit', {
          position: currentPosition,
          currentPrice,
          reason: timeBasedExit.reason,
          openedMinutes: timeBasedExit.openedMinutes,
          pnlPercent: timeBasedExit.pnlPercent,
        });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorStack = getErrorStack(error);

      if (isCriticalApiError(error)) {
        this.handleCriticalMonitoringError(
          error,
          'CRITICAL: API error requires immediate shutdown',
          'Position monitor stopped immediately',
          `CRITICAL: API Authentication Failed\nError: ${errorMessage}\nBot will shutdown immediately.`,
          { message: errorMessage, stack: errorStack, isCritical: true },
        );
        return;
      }

      this.logger.error('Position Monitor caught error', {
        message: errorMessage,
        stack: errorStack,
      });
      this.emit('error', error);
    }
  }

  private checkTimeBasedExit(position: Position, currentPrice: number): TimeBasedExitDecision {
    const timeBasedExit = buildTimeBasedExitDecision(
      position,
      currentPrice,
      this.riskConfig,
      (price) => this.pnlCalculator.calculatePnL(position, price),
    );

    if (this.riskConfig.timeBasedExitEnabled !== true) {
      return timeBasedExit;
    }

    const maxMinutes = this.riskConfig.timeBasedExitMinutes ?? INTEGER_MULTIPLIERS.THIRTY;
    const minPnlPercent = this.riskConfig.timeBasedExitMinPnl ?? 0.2;
    const openedMinutes =
      timeBasedExit.openedMinutes ??
      (Date.now() - position.openedAt) /
        TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND /
        INTEGER_MULTIPLIERS.SIXTY;
    const pnlPercent =
      timeBasedExit.pnlPercent ?? this.pnlCalculator.calculatePnL(position, currentPrice);

    if (openedMinutes > maxMinutes / INTEGER_MULTIPLIERS.TWO) {
      this.logger.debug('Time-based exit check', {
        openedMinutes: openedMinutes.toFixed(1),
        maxMinutes,
        pnlPercent: pnlPercent.toFixed(DECIMAL_PLACES.PERCENT),
        minPnlPercent,
      });
    }

    return timeBasedExit;
  }

  private async deepSyncCheck(): Promise<void> {
    try {
      const position = this.positionManager.getCurrentPosition();

      if (this.errorHandler) {
        await this.errorHandler.executeAsync(
          async () => await this.positionSyncService.deepSyncCheck(position),
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'PositionMonitorService.deepSyncCheck',
            onRecover: () => {
              this.logger.debug('Deep sync check completed with degradation');
            },
            onFailure: (error) => {
              this.logger.warn('Deep sync check failed, continuing with normal monitoring', {
                error: error.message,
              });
            },
          },
        );
        return;
      }

      await this.positionSyncService.deepSyncCheck(position);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      if (isCriticalApiError(error)) {
        this.handleCriticalMonitoringError(
          error,
          'CRITICAL: API error during deep sync check - immediate shutdown',
          'Position monitor stopped immediately (deep sync)',
          `CRITICAL: API Authentication Failed (Deep Sync)\nError: ${errorMessage}\nBot will shutdown immediately.`,
          { error: errorMessage, isCritical: true },
        );
        return;
      }

      this.logger.error('Deep sync check failed', {
        error: errorMessage,
      });
    }
  }

  private async getExchangePosition(currentPosition: Position): Promise<Position | null> {
    if (this.errorHandler) {
      const syncResult = await this.errorHandler.executeAsync(
        async () => await this.bybitService.getPosition(currentPosition.id),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PositionMonitorService.getPosition',
          onRecover: () => {
            this.logger.warn('Position sync failed, using cached position data');
          },
          onFailure: (error) => {
            this.logger.error('Position exchange sync failed', {
              positionId: currentPosition.id,
              error: error.message,
            });
          },
        },
      );

      return syncResult.success ? syncResult.value ?? null : currentPosition;
    }

    try {
      return await this.bybitService.getPosition(currentPosition.id);
    } catch {
      this.logger.warn('Failed to fetch position from exchange, using cached data');
      return currentPosition;
    }
  }

  private async syncClosedPositionIfNeeded(currentPosition: Position): Promise<boolean> {
    const livePosition = this.positionManager.getCurrentPosition();
    if (isClosedPosition(livePosition)) {
      this.logger.debug('Position closed by WebSocket during monitor check, skipping external event');
      return true;
    }

    if (this.errorHandler) {
      const closeResult = await this.errorHandler.executeAsync(
        async () => await this.positionSyncService.syncClosedPosition(currentPosition),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PositionMonitorService.syncClosedPosition',
          onFailure: (error) => {
            this.logger.error('Failed to sync closed position', {
              positionId: currentPosition.id,
              error: error.message,
            });
          },
        },
      );

      return closeResult.success;
    }

    try {
      await this.positionSyncService.syncClosedPosition(currentPosition);
      return true;
    } catch (syncError) {
      this.logger.error('Failed to sync closed position', { error: syncError });
      return false;
    }
  }

  private async verifyInitialProtection(currentPosition: Position): Promise<ProtectionVerification> {
    if (!this.bybitService.verifyProtectionSet) {
      this.logger.warn('verifyProtectionSet not available, skipping protection check');
      return {
        verified: true,
        hasStopLoss: true,
        hasTakeProfit: true,
        hasTrailingStop: false,
        activeOrders: 0,
      };
    }

    const protection = await this.bybitService.verifyProtectionSet(
      toProtectionVerificationSide(currentPosition.side),
    );

    if (protection.verified) {
      markProtectionVerified(currentPosition);
      this.logger.info('Protection verified - no further checks needed', {
        positionId: currentPosition.id,
        hasTrailingStop: protection.hasTrailingStop,
      });
    }

    return protection;
  }

  private async handleUnprotectedPosition(
    currentPosition: Position,
    protection: ProtectionVerification,
  ): Promise<void> {
    this.logger.error(
      'UNPROTECTED POSITION DETECTED - CLOSING IMMEDIATELY',
      buildUnprotectedPositionDetails(currentPosition, protection),
    );

    try {
      await this.bybitService.closePosition({ positionId: currentPosition.id, percentage: 100 });
      await this.sendAlertSafely(
        'UNPROTECTED POSITION CLOSED @ market price!\n' +
          `Side: ${currentPosition.side}\n` +
          `Entry: ${currentPosition.entryPrice}\n` +
          'Reason: No SL/TP protection detected',
        'PositionMonitorService.sendUnprotectedAlert',
      );

      this.emit('positionClosedEmergency', currentPosition);
      await this.positionManager.clearPosition();
      this.logger.warn('Unprotected position closed successfully');
    } catch (closeError) {
      this.logger.error('CRITICAL: Failed to close unprotected position', {
        error: getErrorMessage(closeError),
      });

      await this.sendAlertSafely(
        'CRITICAL ALERT\n' +
          `Position ${currentPosition.id} is UNPROTECTED and CANNOT BE CLOSED!\n` +
          'MANUAL INTERVENTION REQUIRED IMMEDIATELY!\n' +
          `Side: ${currentPosition.side}\n` +
          `Entry: ${currentPosition.entryPrice}\n` +
          `Quantity: ${currentPosition.quantity}`,
        'PositionMonitorService.sendCriticalUnprotectedAlert',
      );
    }
  }

  private async getCurrentPriceSafely(): Promise<number | null> {
    if (this.errorHandler) {
      const priceResult = await this.errorHandler.executeAsync(
        async () => await this.bybitService.getCurrentPrice(),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PositionMonitorService.getCurrentPrice',
          onFailure: (error) => {
            this.logger.warn('Failed to fetch current price, skipping price-based checks', {
              error: error.message,
            });
          },
        },
      );

      return priceResult.success && priceResult.value !== undefined ? priceResult.value : null;
    }

    try {
      return await this.bybitService.getCurrentPrice();
    } catch (priceError) {
      this.logger.warn('Failed to get current price', {
        error: getErrorMessage(priceError),
      });
      return null;
    }
  }

  private async sendAlertSafely(message: string, context: string): Promise<void> {
    if (this.errorHandler) {
      await this.errorHandler.executeAsync(
        async () => await this.telegram.sendAlert(message),
        {
          strategy: RecoveryStrategy.SKIP,
          context,
        },
      );
      return;
    }

    await this.telegram.sendAlert(message);
  }

  private handleCriticalMonitoringError(
    error: unknown,
    logMessage: string,
    stopMessage: string,
    alertMessage: string,
    details: Record<string, unknown>,
  ): void {
    if (this.criticalErrorEmitted) {
      return;
    }

    this.criticalErrorEmitted = true;
    this.logger.error(logMessage, details);
    this.stop();
    this.logger.error(stopMessage);

    this.telegram.sendAlert(alertMessage).catch((telegramError) => {
      this.logger.error('Failed to send Telegram alert', {
        error: getErrorMessage(telegramError),
      });
    });

    setImmediate(() => {
      this.emit('critical-error', error);
    });
  }
}
