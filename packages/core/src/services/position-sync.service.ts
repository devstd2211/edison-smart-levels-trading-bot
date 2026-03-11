/**
 * Position Sync Service
 * Handles position synchronization with exchange
 *
 * Responsibilities:
 * - Detect and handle missed WebSocket close events
 * - Deep sync check for protection verification
 * - Handle emergency position closes
 * - ErrorHandler integration for resilient recovery
 */

import { Position, PositionSide, LoggerService, BybitOrder, isStopLossOrder, isTakeProfitOrder, ExitType } from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { PositionLifecycleService } from './position-lifecycle.service';
import { ExitTypeDetectorService } from './exit-type-detector.service';
import { TelegramService } from './telegram.service';
import { ErrorHandler, RecoveryStrategy, type ErrorHandlingConfig } from '../errors/ErrorHandler';
import { getErrorMessage } from '../utils/error.utils';
import {
  PositionExchangeSyncError,
  PositionProtectionError,
  PositionPriceFetchError,
  TelegramNetworkError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
} from '../errors/DomainErrors';
import { DECIMAL_PLACES, TIME_UNITS } from '../constants';
import { INTEGER_MULTIPLIERS } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const POSITION_SIZE_ZERO = INTEGER_MULTIPLIERS.ZERO;
const DEEP_SYNC_MIN_AGE_MS = 120000; // 2 minutes

type PositionCloseRecorder = {
  closeFullPosition(
    position: Position | null | undefined,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<boolean>;
};

// ============================================================================
// POSITION SYNC SERVICE
// ============================================================================

export class PositionSyncService {
  private readonly errorHandler: ErrorHandler;

  constructor(
    private readonly bybitService: IExchange,
    private readonly positionManager: PositionLifecycleService,
    private readonly exitTypeDetectorService: ExitTypeDetectorService,
    private readonly telegram: TelegramService,
    private readonly logger: LoggerService,
    private readonly positionExitingService: PositionCloseRecorder,
    errorHandler?: ErrorHandler,
  ) {
    // If no errorHandler provided, create one with the logger
    this.errorHandler = errorHandler || new ErrorHandler(logger);
  }

  private hasCorrectCloseSide(position: Position, order: BybitOrder): boolean {
    return position.side === PositionSide.LONG
      ? order.side === 'Sell'
      : order.side === 'Buy';
  }

  /**
   * Sync closed position state when WebSocket event was missed
   * Queries order history to determine correct exitType
   * ErrorHandler strategies:
   * - RETRY for order history & current price (network transients)
   * - GRACEFUL_DEGRADE for closeFullPosition (continue if recording fails)
   * - SKIP for telegram alerts (non-critical notifications)
   */
  public async syncClosedPosition(position: Position): Promise<void> {
    this.logger.warn('⚠️ Position closed on exchange but WebSocket event missed', {
      positionId: position.id,
      entryPrice: position.entryPrice,
      side: position.side,
    });

    try {
      // 1. Get order history with RETRY strategy (3x attempts)
      let orderHistory: BybitOrder[] = [];
      if (this.bybitService.getOrderHistory) {
        const orderHistoryResult = await this.errorHandler.executeAsync(
          () => this.bybitService.getOrderHistory!(20),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: { maxAttempts: 3, initialDelayMs: 100, backoffMultiplier: 2 },
            context: 'PositionSyncService.getOrderHistory',
            onRetry: (attempt, error, delayMs) => {
              this.logger.warn(`Retrying order history fetch (attempt ${attempt}/3)`, {
                positionId: position.id,
                delayMs,
                error: error.message,
              });
            },
          },
        );

        if (orderHistoryResult.success && orderHistoryResult.value) {
          orderHistory = this.toBybitOrders(orderHistoryResult.value);
        }
      }

      const exitType = this.exitTypeDetectorService.determineExitTypeFromHistory(orderHistory, position);

      // 2. Get current price with RETRY strategy (3x attempts)
      let currentPrice = position.entryPrice; // Fallback to entry price
      const priceResult = await this.errorHandler.executeAsync(
        () => this.bybitService.getCurrentPrice(),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 3, initialDelayMs: 100, backoffMultiplier: 2 },
          context: 'PositionSyncService.getCurrentPrice',
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn(`Retrying current price fetch (attempt ${attempt}/3)`, {
              positionId: position.id,
              delayMs,
              error: error.message,
            });
          },
        },
      );

      if (priceResult.success && priceResult.value !== undefined) {
        currentPrice = priceResult.value;
      } else if (priceResult.error) {
        // Log price fetch error but continue with fallback
        const syncError = new PositionPriceFetchError(
          'Failed to fetch current price, using entry price as fallback',
          {
            positionId: position.id,
            reason: 'Network/API error',
            lastSuccessfulPrice: position.entryPrice,
          },
          priceResult.error,
        );
        this.logger.warn('Price fetch failed, using fallback', {
          syncError: syncError.message,
          fallbackPrice: currentPrice,
        });
      }

      // Record close with correct exitType (NOT MANUAL unless truly manual)
      const exitReason = `Position closed on exchange (WebSocket event missed) - ${exitType}`;

      // 3. Close position with GRACEFUL_DEGRADE strategy (continue even if fails)
      const closeResult = await this.errorHandler.executeAsync(
        () =>
          this.positionExitingService.closeFullPosition(
            position,
            currentPrice,
            exitReason,
            exitType,
          ),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PositionSyncService.closeFullPosition',
          onRecover: (strategy) => {
            this.logger.warn('Position close record failed, degrading to fallback', {
              strategy,
              positionId: position.id,
            });
          },
        },
      );

      if (!closeResult.success && closeResult.error) {
        const syncError = new PositionExchangeSyncError(
          'Failed to record position close',
          {
            positionId: position.id,
            syncType: 'closed',
            reason: closeResult.error.message,
          },
          closeResult.error,
        );
        this.logger.error('Position close recording failed', {
          syncError: syncError.message,
        });
      }

      // 4. Send alert with SKIP strategy (non-blocking)
      const alertResult = await this.errorHandler.executeAsync(
        () =>
          this.telegram.sendAlert(
            '⚠️ SYNC: Position closed on exchange\n' +
            `Exit Type: ${exitType}\n` +
            `Entry: ${position.entryPrice}\n` +
            `Exit: ${currentPrice.toFixed(DECIMAL_PLACES.PRICE)}\n` +
            'Reason: WebSocket event missed',
          ),
        {
          strategy: RecoveryStrategy.SKIP,
          context: 'PositionSyncService.telegramAlert',
          onRecover: () => {
            this.logger.debug('Telegram alert skipped due to error');
          },
        },
      );

      if (!alertResult.success && alertResult.error) {
        this.logger.warn('Failed to send Telegram alert (non-critical)', {
          error: alertResult.error.message,
        });
      }

      // Clear position
      await this.positionManager.clearPosition();

      this.logger.info('✅ Position state synced with exchange', {
        positionId: position.id,
        exitType,
        priceUsed: currentPrice,
      });
    } catch (error) {
      this.logger.error('Failed to sync closed position', {
        positionId: position.id,
        error: getErrorMessage(error),
      });

      // Fallback: clear position anyway
      try {
        await this.positionManager.clearPosition();
      } catch (clearError) {
        this.logger.error('Failed to clear position in fallback', {
          error: getErrorMessage(clearError),
        });
      }
    }
  }

  /**
   * Deep sync check - verifies protection is still active
   * Checks:
   * 1. TP/SL orders still active on exchange
   * 2. Stop Loss not missing (emergency close if missing)
   * 3. Position quantity matches exchange
   *
   * Only runs for positions > 2 minutes old
   *
   * ErrorHandler strategies:
   * - RETRY for position fetch & active orders (network transients)
   * - GRACEFUL_DEGRADE for missing TP orders (continue with SL only)
   * - GRACEFUL_DEGRADE for quantity sync (fallback to local value)
   * - THROW for missing SL (critical - must close or fail hard)
   * - SKIP for telegram alerts (non-critical notifications)
   */
  public async deepSyncCheck(position: Position | null): Promise<void> {
    try {
      // No position or already closed
      if (position === null || position.status === 'CLOSED') {
        return;
      }

      const positionAgeMs = Date.now() - position.openedAt;

      // Only run deep check if position > 2 minutes old
      if (positionAgeMs < DEEP_SYNC_MIN_AGE_MS) {
        return;
      }

      this.logger.debug('🔍 Running deep sync check', {
        positionId: position.id,
        ageMinutes: Math.floor(positionAgeMs / TIME_UNITS.MINUTE),
      });

      // 1. Verify position still exists on exchange with RETRY strategy (2x)
      let exchangePos = null;
      const positionResult = await this.errorHandler.executeAsync(
        () => this.bybitService.getPosition(position.id),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
          context: 'PositionSyncService.getPosition',
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn(`Retrying position fetch (attempt ${attempt}/2)`, {
              positionId: position.id,
              delayMs,
              error: error.message,
            });
          },
        },
      );

      if (positionResult.success && positionResult.value) {
        exchangePos = positionResult.value;
      } else if (positionResult.error) {
        // Log error but continue (position may have been closed)
        this.logger.warn('Position fetch failed (will assume closed)', {
          positionId: position.id,
          error: positionResult.error.message,
        });
        return;
      } else {
        // No success, no error, no value - assume position closed
        this.logger.debug('Position not found on exchange (will be handled by monitor)');
        return;
      }

      if (!exchangePos || exchangePos.quantity === POSITION_SIZE_ZERO) {
        // Position closed on exchange - already handled by syncClosedPosition
        this.logger.debug('Deep sync: Position closed on exchange (will be handled by monitor)');
        return;
      }

      // 2. Verify TP/SL orders still active with RETRY strategy (2x)
      if (!this.bybitService.getActiveOrders) {
        this.logger.warn('⚠️ getActiveOrders not available, skipping protection check');
        return;
      }

      let activeOrders: BybitOrder[] = [];
      const ordersResult = await this.errorHandler.executeAsync(
        () => this.bybitService.getActiveOrders!(),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
          context: 'PositionSyncService.getActiveOrders',
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn(`Retrying active orders fetch (attempt ${attempt}/2)`, {
              positionId: position.id,
              delayMs,
              error: error.message,
            });
          },
        },
      );

      if (ordersResult.success && ordersResult.value) {
        activeOrders = this.toBybitOrders(ordersResult.value);
      } else if (ordersResult.error) {
        // GRACEFUL_DEGRADE: Continue with assumption that orders exist
        this.logger.warn('Failed to fetch active orders, assuming protection exists (degraded mode)', {
          positionId: position.id,
          error: ordersResult.error.message,
        });
        return;
      }

      // Check for Stop Loss order
      const hasStopLoss = activeOrders.some((order: BybitOrder) => {
        const isSL = isStopLossOrder(order);
        const correctSide = this.hasCorrectCloseSide(position, order);
        return isSL && correctSide;
      });

      // Check for Take Profit orders
      const hasTakeProfit = activeOrders.some((order: BybitOrder) => {
        const isTP = isTakeProfitOrder(order);
        const correctSide = this.hasCorrectCloseSide(position, order);
        return isTP && correctSide;
      });

      // Check for Trailing Stop via position info
      let hasTrailingStop = false;
      if (position.stopLoss.isTrailing) {
        hasTrailingStop = true;
        this.logger.debug('Deep sync: Trailing stop active (position flag set)');
      }

      // 🚨 CRITICAL: Stop Loss missing! - THROW strategy (no recovery)
      if (!hasStopLoss && !hasTrailingStop) {
        this.logger.error('🚨 CRITICAL: Stop Loss order missing!', {
          positionId: position.id,
          hasTrailing: hasTrailingStop,
          activeOrders: activeOrders.length,
        });

        // FIX: Verify position still exists before emergency close (race condition)
        const preClosePosResult = await this.errorHandler.executeAsync(
          () => this.bybitService.getPosition(position.id),
          {
            strategy: RecoveryStrategy.SKIP, // Non-critical verification
            context: 'PositionSyncService.preCloseVerification',
          },
        );

        if (
          preClosePosResult.success &&
          preClosePosResult.value &&
          preClosePosResult.value.quantity > POSITION_SIZE_ZERO
        ) {
          // Position still exists - attempt emergency close
          const protectionError = new PositionProtectionError(
            'Stop Loss order missing - emergency close initiated',
            {
              positionId: position.id,
              protectionType: 'stopLoss',
              hasStopLoss: false,
              hasTrailingStop,
              reason: 'SL order not found after 2 retries',
            },
          );

          // Send CRITICAL alert - SKIP strategy
          await this.errorHandler.executeAsync(
            () =>
              this.telegram.sendAlert(
                '🚨 CRITICAL: Stop Loss missing!\n' +
                `Position: ${position.id}\n` +
                `Side: ${position.side}\n` +
                `Entry: ${position.entryPrice}\n` +
                `Age: ${Math.floor(positionAgeMs / TIME_UNITS.MINUTE)} minutes\n` +
                'Action: Closing position immediately',
              ),
            {
              strategy: RecoveryStrategy.SKIP,
              context: 'PositionSyncService.criticalAlert',
            },
          );

          // Emergency close with THROW strategy (must succeed or error out)
          const closeResult = await this.errorHandler.executeAsync(
            () => this.bybitService.closePosition({ positionId: position.id, percentage: 100 }),
            {
              strategy: RecoveryStrategy.THROW,
              context: 'PositionSyncService.emergencyClose',
            },
          );

          if (closeResult.success) {
            this.logger.warn('✅ Unprotected position closed successfully (deep sync)');
          } else if (closeResult.error) {
            const errorMsg = closeResult.error.message;

            // Check if error is due to zero position (race condition)
            if (
              errorMsg.includes('current position is zero') ||
              errorMsg.includes('zero position')
            ) {
              this.logger.warn('⚠️ Position became zero during close attempt (race condition)', {
                positionId: position.id,
                error: errorMsg,
              });
              return;
            }

            // CRITICAL failure - cannot close unprotected position
            this.logger.error('🚨🚨🚨 CRITICAL: Failed to close unprotected position!', {
              error: errorMsg,
              positionId: position.id,
            });

            // Last-ditch alert
            await this.errorHandler.executeAsync(
              () =>
                this.telegram.sendAlert(
                  '🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨\n' +
                  `Position ${position.id} is UNPROTECTED and CANNOT BE CLOSED!\n` +
                  'MANUAL INTERVENTION REQUIRED IMMEDIATELY!',
                ),
              {
                strategy: RecoveryStrategy.SKIP,
                context: 'PositionSyncService.criticalAlertFailedClose',
              },
            );

            // Throw critical protection error
            throw protectionError;
          }
        } else {
          // Position already closed during check (race condition avoided)
          this.logger.warn('⚠️ Position already closed on exchange (race condition avoided)', {
            positionId: position.id,
          });
        }
        return;
      }

      // 3. Sync position quantity mismatch with GRACEFUL_DEGRADE
      if (exchangePos && Math.abs(exchangePos.quantity - position.quantity) > 0.01) {
        this.logger.warn('Position quantity mismatch - syncing', {
          local: position.quantity,
          exchange: exchangePos.quantity,
          difference: Math.abs(exchangePos.quantity - position.quantity),
        });

        try {
          // Try to sync, but gracefully degrade if it fails
          this.positionManager.syncWithWebSocket(exchangePos);

          // Send update alert with SKIP strategy
          await this.errorHandler.executeAsync(
            () =>
              this.telegram.sendAlert(
                '⚠️ Position quantity synced\n' +
                `Position: ${position.id}\n` +
                `Local: ${position.quantity}\n` +
                `Exchange: ${exchangePos?.quantity}\n` +
                'Updated to match exchange',
              ),
            {
              strategy: RecoveryStrategy.SKIP,
              context: 'PositionSyncService.quantitySyncAlert',
            },
          );
        } catch (syncError) {
          const syncErr = syncError instanceof Error ? syncError.message : String(syncError);
          this.logger.warn('Position sync failed, using local value (degraded)', {
            positionId: position.id,
            error: syncErr,
          });
        }
      }

      this.logger.debug('✅ Deep sync check passed', {
        hasStopLoss,
        hasTakeProfit,
        hasTrailingStop,
        quantityMatch: exchangePos ? Math.abs(exchangePos.quantity - position.quantity) < 0.01 : undefined,
      });
    } catch (error) {
      this.logger.error('Deep sync check failed', {
        positionId: position?.id,
        error: getErrorMessage(error),
      });
      // Re-throw to let caller handle (preserves critical protection errors)
      throw error;
    }
  }

  private toBybitOrders(value: unknown): BybitOrder[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((order) => this.isBybitOrder(order));
  }

  private isBybitOrder(value: unknown): value is BybitOrder {
    const order = this.asRecord(value);
    if (!order) {
      return false;
    }
    return typeof order.orderId === 'string'
      && typeof order.side === 'string';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
