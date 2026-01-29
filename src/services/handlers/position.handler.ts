/**
 * Position Event Handler
 *
 * Handles all position-related events:
 * - Stop Loss hits (backup price detection)
 * - Take Profit hits (TP level tracking)
 * - Position closed externally (fallback recovery)
 * - Time-based exit (duration limits)
 * - Position monitor errors
 *
 * Extracted from bot.ts setupMonitorHandlers() lines 502-599
 */

import { LoggerService, Position, ExitType, PositionSide } from '../../types';
import type { IExchange } from '../../interfaces/IExchange';
import { PositionLifecycleService } from '../position-lifecycle.service';
import { PositionExitingService } from '../position-exiting.service';
import { TelegramService } from '../telegram.service';
import { StopLossHitEvent, TakeProfitHitEvent, TimeBasedExitEvent } from '../../types';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { PositionMonitoringError } from '../../errors/DomainErrors';

const DECIMAL_PLACES = {
  PERCENT: 2,
};

/**
 * Handles position-related events from PositionMonitor service
 *
 * Responsibilities:
 * - Log stop loss hits (backup detection)
 * - Log take profit hits
 * - Handle external position closures (fallback recovery)
 * - Handle time-based exits
 * - Log monitor errors
 */
export class PositionEventHandler {
  constructor(
    private positionManager: PositionLifecycleService,
    private positionExitingService: PositionExitingService,
    private bybitService: IExchange,
    private telegram: TelegramService,
    private logger: LoggerService,
  ) {}

  /**
   * Handle stop loss hit event
   *
   * NOTE: This is a BACKUP DETECTION (price-based)
   * Real SL is triggered on exchange via WebSocket 'positionClosed'
   *
   * Strategy: SKIP (non-critical informational event)
   * - Continue monitoring if logging fails
   * - Backup detection, not primary trading flow
   *
   * @param event - Stop loss hit event
   */
  async handleStopLossHit(event: StopLossHitEvent): Promise<void> {
    try {
      this.logger.warn('🛑 STOP LOSS HIT (backup price detection)', {
        reason: event.reason,
        positionId: event.position.id,
        loss: event.position.unrealizedPnL,
      });

      // Don't call recordPositionClose() here - let positionClosed event handle it
      // This avoids duplicate recording if both price-check and WebSocket fire

      // Just log that SL was detected
      this.logger.info('SL hit detected via price check - waiting for WebSocket confirmation');
    } catch (error) {
      await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: 'PositionEventHandler.handleStopLossHit',
        onRecover: () => {
          this.logger.warn('⚠️ SL hit logging failed, continuing monitoring', {
            positionId: event.position?.id,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    }
  }

  /**
   * Handle take profit hit event
   *
   * Strategy: SKIP (non-critical informational event)
   * - Continue monitoring if logging fails
   * - Primary TP handling via WebSocket events
   *
   * @param event - Take profit hit event
   */
  async handleTakeProfitHit(event: TakeProfitHitEvent): Promise<void> {
    try {
      this.logger.info(`TAKE PROFIT ${event.tpLevel} HIT`, {
        reason: event.reason,
        positionId: event.position.id,
        profit: event.position.unrealizedPnL,
      });
    } catch (error) {
      await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: 'PositionEventHandler.handleTakeProfitHit',
        onRecover: () => {
          this.logger.warn('⚠️ TP hit logging failed, continuing monitoring', {
            positionId: event.position?.id,
            tpLevel: event.tpLevel,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    }
  }

  /**
   * Handle position closed externally event
   *
   * NOTE: FALLBACK ONLY - syncClosedPosition() handles recording + cleanup automatically
   * This handler only triggers if syncClosedPosition() throws and emits fallback event
   *
   * Strategy: GRACEFUL_DEGRADE + SKIP
   * - GRACEFUL_DEGRADE for clearPosition (continue if fails, don't retry)
   * - SKIP for Telegram notifications (non-blocking)
   *
   * @param position - Position that was closed
   */
  async handlePositionClosedExternally(position: Position): Promise<void> {
    this.logger.warn('⚠️ FALLBACK: Position closed externally (syncClosedPosition failed)', {
      positionId: position.id,
      finalPnL: position.unrealizedPnL,
    });

    // GRACEFUL_DEGRADE: Try to clear position, continue if fails
    try {
      // Only clearPosition - recordPositionClose already called by syncClosedPosition
      // or will be called by positionClosed WebSocket event
      await this.positionManager.clearPosition();
    } catch (error) {
      await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        logger: this.logger,
        context: 'PositionEventHandler.handlePositionClosedExternally.clearPosition',
        onRecover: () => {
          this.logger.warn('⚠️ Failed to clear position memory, continuing with degraded state', {
            positionId: position.id,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    }

    // SKIP: Send basic Telegram notification (non-blocking)
    try {
      await this.telegram.sendAlert(
        '⚠️ FALLBACK: Position closed externally\n' +
        `Position: ${position.id}\n` +
        `Entry: ${position.entryPrice}\n` +
        'Reason: Sync failed, manual cleanup triggered',
      );
    } catch (error) {
      await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: 'PositionEventHandler.handlePositionClosedExternally.telegram',
        onRecover: () => {
          this.logger.warn('⚠️ Telegram notification failed, continuing', {
            positionId: position.id,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    }
  }

  /**
   * Handle time-based exit event
   *
   * NOTE: BOT INITIATED CLOSE
   * Records close only if exchange close fails (fallback)
   *
   * Strategy: RETRY + FALLBACK
   * - RETRY on transient exchange API failures (3 attempts, exponential backoff)
   * - FALLBACK to PositionExitingService if exchange close exhausts retries
   * - Critical path: must close position
   *
   * @param event - Time-based exit event
   */
  async handleTimeBasedExit(event: TimeBasedExitEvent): Promise<void> {
    this.logger.warn('⏰ TIME-BASED EXIT triggered', {
      reason: event.reason,
      openedMinutes: event.openedMinutes?.toFixed(1),
      pnlPercent: event.pnlPercent?.toFixed(DECIMAL_PLACES.PERCENT) + '%',
      positionId: event.position.id,
    });

    // RETRY: Close position on exchange with exponential backoff
    try {
      // Use IExchange interface to close position (100% close) with RETRY strategy
      const result = await ErrorHandler.executeAsync(
        async () => {
          await this.bybitService.closePosition({
            positionId: event.position.id,
            percentage: 100,
          });
        },
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: {
            maxAttempts: 3,
            initialDelayMs: 200,
            backoffMultiplier: 2,
            maxDelayMs: 5000,
          },
          logger: this.logger,
          context: 'PositionEventHandler.handleTimeBasedExit.exchangeClose',
          onRetry: (attempt, error) => {
            this.logger.warn(`⚠️ Retry ${attempt}/3: Failed to close position on exchange`, {
              positionId: event.position.id,
              error: error instanceof Error ? error.message : String(error),
            });
          },
          onFailure: () => {
            this.logger.error('❌ Exchange close failed after 3 retries, using fallback', {
              positionId: event.position.id,
            });
          },
        },
      );

      if (!result.success) {
        throw result.error;
      }

      this.logger.info('⏰ Time-based exit: Position closed on exchange', {
        positionId: event.position.id,
        reason: event.reason,
      });

      // WebSocket 'positionClosed' will trigger and record the close automatically
      // No need to call recordPositionClose() here - avoid duplicates
    } catch (error) {
      this.logger.error('Exchange close failed, activating FALLBACK strategy', {
        error: error instanceof Error ? error.message : String(error),
        positionId: event.position.id,
      });

      // FALLBACK: Use PositionExitingService as alternate close method
      try {
        const currentPrice = event.position.currentPrice || 0;
        const exitReason = `Time-based exit: ${event.reason} (fallback - exchange close failed after retries)`;

        await this.positionExitingService.closeFullPosition(
          event.position as unknown as Position,
          currentPrice,
          exitReason,
          ExitType.TIME_BASED_EXIT,
        );

        await this.positionManager.clearPosition();

        this.logger.info('✅ Position closed via fallback PositionExitingService', {
          positionId: event.position.id,
        });
      } catch (fallbackError) {
        await ErrorHandler.handle(fallbackError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          logger: this.logger,
          context: 'PositionEventHandler.handleTimeBasedExit.fallback',
          onRecover: () => {
            this.logger.error('⚠️ Both exchange close and fallback failed, position may remain open', {
              positionId: event.position.id,
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
          },
        });
      }
    }
  }

  /**
   * Handle position monitor error
   *
   * Strategy: THROW
   * - Position monitor errors are critical
   * - Must propagate to ErrorRegistry for diagnostics
   * - Requires manual intervention
   *
   * @param error - Error that occurred in position monitor
   */
  async handleMonitorError(error: Error): Promise<void> {
    const monitorError = new PositionMonitoringError(
      'Critical error in PositionMonitor',
      {
        operation: 'handleMonitorError',
        positionId: 'unknown',
        reason: error instanceof Error ? error.message : String(error),
      },
    );

    try {
      const result = await ErrorHandler.handle(monitorError, {
        strategy: RecoveryStrategy.THROW,
        logger: this.logger,
        context: 'PositionEventHandler.handleMonitorError',
        onFailure: () => {
          this.logger.error('🚨 Position Monitor error - manual intervention required', {
            originalError: error instanceof Error ? error.message : String(error),
          });
        },
      });

      // THROW strategy should always fail/throw
      if (!result.success) {
        throw result.error;
      }
    } catch (err) {
      // Re-throw the error so it propagates to caller
      throw err;
    }
  }
}
