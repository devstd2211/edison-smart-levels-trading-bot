/**
 * Position Opening Service
 * Single Responsibility: Execute position opening with all protections
 *
 * PURE EXECUTOR - Does not make ANY assumptions about signal origin or metadata
 * - Doesn't care about signal.type (WHALE_HUNTER, SCALPING, etc.)
 * - Doesn't care about signal.reason or signal.confidence
 * - Only cares about: direction, price, stopLoss, takeProfits
 *
 * Responsibilities:
 * - Cancel hanging conditional orders
 * - Open position on exchange (limit order)
 * - Place take-profit levels
 * - Set stop-loss with market price recalculation
 * - CRITICAL: Verify protection set (with retry logic)
 * - Create minimal Position object (no metadata)
 * - Send Telegram notifications
 * - Record in trading journal
 * - Record in session stats (if provided)
 *
 * Dependencies:
 * - PositionSizingService (for quantity calculation)
 * - BybitService (for exchange operations)
 * - Other: TelegramService, TradingJournalService, SessionStatsService
 */

import {
  LoggerService,
  Signal,
  Position,
  PositionSide,
  SignalDirection,
  RiskDecision,
  TradingConfig,
  RiskManagementConfig,
  ExitType,
  SessionTradeRecord,
  Config,
} from '../types';
import { BybitService } from './bybit';
import { TelegramService } from './telegram.service';
import { TradingJournalService } from './trading-journal.service';
import { TakeProfitManagerService } from './take-profit-manager.service';
import { SessionStatsService } from './session-stats.service';
import { PositionSizingService, PositionSizingResult } from './position-sizing.service';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS, TIMING_CONSTANTS } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_VERIFICATION_RETRIES = TIMING_CONSTANTS.MAX_VERIFICATION_RETRIES;
const VERIFICATION_RETRY_DELAY_MS = INTEGER_MULTIPLIERS.ONE_THOUSAND; // 1 second between retries

// ============================================================================
// POSITION OPENING SERVICE
// ============================================================================

export class PositionOpeningService {
  constructor(
    private readonly bybitService: BybitService,
    private readonly tradingConfig: TradingConfig,
    private readonly riskConfig: RiskManagementConfig,
    private readonly telegram: TelegramService,
    private readonly logger: LoggerService,
    private readonly journal: TradingJournalService,
    private readonly positionSizing: PositionSizingService,
    private readonly fullConfig: Config,
    private readonly takeProfitManager?: TakeProfitManagerService,
    private readonly sessionStats?: SessionStatsService,
  ) {}

  /**
   * Open position with all validations and protections
   * CRITICAL: This is a SAFE operation - includes protection verification with retries
   *
   * @param signal - Trading signal with entry/SL/TP levels
   * @param riskDecision - Risk assessment from RiskManager (optional, for logging)
   * @param entrySnapshot - Session entry snapshot for stats (optional)
   * @returns Position object if successful
   * @throws Error if position already exists or protection fails
   */
  async openPosition(
    signal: Signal,
    riskDecision?: RiskDecision | null,
    entrySnapshot?: any, // SessionEntryCondition
  ): Promise<Position> {
    // =========================================================================
    // STEP 1: Calculate position size using PositionSizingService
    // =========================================================================
    const sizingResult = await this.positionSizing.calculatePositionSize(signal);

    this.logger.info('📐 Position sizing completed', {
      quantity: sizingResult.quantity,
      roundedQuantity: sizingResult.roundedQuantity,
      marginUsed: sizingResult.marginUsed.toFixed(DECIMAL_PLACES.PERCENT),
      notionalValue: sizingResult.notionalValue.toFixed(DECIMAL_PLACES.PERCENT),
      sizingChain: sizingResult.sizingChain.join(' → '),
    });

    // =========================================================================
    // STEP 2: Cancel any hanging conditional orders from previous position
    // =========================================================================
    this.logger.debug('🧹 Cancelling any hanging conditional orders before opening...');
    try {
      await this.bybitService.cancelAllConditionalOrders();
    } catch (error) {
      this.logger.warn('Failed to cancel hanging orders', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway - don't fail the position opening
    }

    // =========================================================================
    // STEP 3: Determine position side and execute opening
    // =========================================================================
    const isLong = signal.direction === SignalDirection.LONG;
    const side = isLong ? PositionSide.LONG : PositionSide.SHORT;

    this.logger.info('🚀 Opening position on exchange', {
      side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
      quantity: sizingResult.quantity,
      entry: signal.price,
      sl: signal.stopLoss,
      leverage: this.tradingConfig.leverage,
    });

    // =========================================================================
    // STEP 4: Execute exchange operations
    // =========================================================================
    let orderId: string | undefined;
    let tpOrderIds: (string | undefined)[] = [];

    try {
      // 4a. Open position with limit order
      orderId = await this.bybitService.openPosition({
        side,
        quantity: sizingResult.quantity,
        leverage: this.tradingConfig.leverage,
      });

      this.logger.info('✅ Position order placed', {
        orderId,
        side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
        quantity: sizingResult.quantity,
      });

      // 4b. Place take-profit levels
      tpOrderIds = await this.bybitService.placeTakeProfitLevels({
        side,
        entryPrice: signal.price,
        totalQuantity: sizingResult.quantity,
        levels: signal.takeProfits,
      });

      this.logger.info('✅ Take-profit levels placed', {
        count: tpOrderIds.length,
        orderIds: tpOrderIds,
      });
    } catch (error) {
      this.logger.error('❌ Failed to execute exchange operations', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // =========================================================================
    // STEP 5: Set stop-loss with price recalculation
    // =========================================================================
    const slDistance = this.calculateSLDistance(signal.price, signal.stopLoss);
    const currentPrice = await this.bybitService.getCurrentPrice();
    const actualStopLoss = this.calculateActualStopLoss(
      isLong,
      currentPrice,
      slDistance,
    );

    this.logger.info('📊 Stop-loss calculated', {
      signalPrice: signal.price,
      signalSL: signal.stopLoss,
      currentPrice,
      slDistancePercent: (slDistance / currentPrice * PERCENT_MULTIPLIER).toFixed(2) + '%',
      actualStopLoss: actualStopLoss.toFixed(DECIMAL_PLACES.PERCENT),
    });

    try {
      await this.bybitService.updateStopLoss(actualStopLoss);
      this.logger.info('✅ Stop-loss set', { stopLoss: actualStopLoss.toFixed(DECIMAL_PLACES.PERCENT) });
    } catch (error) {
      this.logger.error('❌ Failed to set stop-loss', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // =========================================================================
    // STEP 6: CRITICAL - Verify protection is actually set (with retries)
    // =========================================================================
    const protectionVerified = await this.verifyProtectionWithRetries(
      side,
      signal.price,
      sizingResult.quantity,
      actualStopLoss,
      tpOrderIds,
    );

    if (!protectionVerified) {
      this.logger.error('🚨 CRITICAL: Failed to verify protection after retries!');
      throw new Error('Failed to set protection for position - position emergency closed for safety');
    }

    // =========================================================================
    // STEP 7: Create Position object
    // =========================================================================
    const timestamp = Date.now();
    const sideName = side === PositionSide.LONG ? 'Buy' : 'Sell';
    const exchangeId = `${this.bybitService['symbol']}_${sideName}`;
    const journalId = `${exchangeId}_${timestamp}`;

    const position: Position = {
      id: exchangeId,
      journalId,
      symbol: this.bybitService['symbol'],
      side,
      quantity: sizingResult.quantity,
      entryPrice: signal.price,
      leverage: this.tradingConfig.leverage,
      marginUsed: sizingResult.marginUsed,
      stopLoss: {
        price: actualStopLoss,
        initialPrice: actualStopLoss,
        orderId: undefined,
        isBreakeven: false,
        isTrailing: false,
        updatedAt: Date.now(),
      },
      takeProfits: signal.takeProfits.map((tp, i) => ({
        ...tp,
        orderId: tpOrderIds[i] || undefined,
        hit: false,
      })),
      openedAt: timestamp,
      unrealizedPnL: 0,
      orderId,
      reason: 'Position opened', // Generic reason - doesn't depend on signal origin
      protectionVerifiedOnce: true,
      status: 'OPEN' as const,
    };

    // =========================================================================
    // STEP 8: Initialize Take Profit Manager
    // =========================================================================
    // Note: TakeProfitManager should be initialized separately
    // This service doesn't manage TakeProfitManager state

    // =========================================================================
    // STEP 9: Send notifications and record
    // =========================================================================
    try {
      await this.telegram.notifyPositionOpened(position);
    } catch (error) {
      this.logger.warn('Failed to send Telegram notification', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Record trade opening in journal
    // Note: Only record core trade data. Metadata (strategy, signals, etc.) should be handled by caller
    this.journal.recordTradeOpen({
      id: journalId,
      symbol: position.symbol,
      side,
      entryPrice: signal.price,
      quantity: sizingResult.quantity,
      leverage: this.tradingConfig.leverage,
      entryCondition: {
        signal, // Raw signal data is preserved for analysis
      },
    });

    this.logger.info('✅ Trade recorded in journal', { journalId });

    // Record in session stats
    if (this.sessionStats && entrySnapshot) {
      const sessionTrade: SessionTradeRecord = {
        tradeId: journalId,
        timestamp: new Date(timestamp).toISOString(),
        direction: signal.direction,
        entryPrice: signal.price,
        exitPrice: 0,
        quantity: sizingResult.quantity,
        pnl: 0,
        pnlPercent: 0,
        exitType: ExitType.MANUAL,
        tpHitLevels: [],
        holdingTimeMs: 0,
        entryCondition: entrySnapshot,
        stopLoss: {
          initial: actualStopLoss,
          final: actualStopLoss,
          movedToBreakeven: false,
          trailingActivated: false,
        },
      };

      this.sessionStats.recordTradeEntry(sessionTrade);
      this.logger.debug('📊 Trade recorded in session stats', { tradeId: journalId });
    }

    this.logger.info('✅ Position opened successfully', {
      positionId: position.id,
      side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
      entry: position.entryPrice,
      quantity: position.quantity,
    });

    return position;
  }

  /**
   * Verify protection is set with retry logic
   * CRITICAL: This ensures SL/TP are actually active before considering trade safe
   *
   * @param side - Position side (LONG/SHORT)
   * @param entryPrice - Entry price
   * @param quantity - Position quantity
   * @param actualStopLoss - Calculated SL price
   * @param tpOrderIds - Take-profit order IDs
   * @returns true if protection verified, false if failed after retries
   */
  private async verifyProtectionWithRetries(
    side: PositionSide,
    entryPrice: number,
    quantity: number,
    actualStopLoss: number,
    tpOrderIds: (string | undefined)[],
  ): Promise<boolean> {
    let verificationAttempt = 0;

    while (verificationAttempt < MAX_VERIFICATION_RETRIES) {
      verificationAttempt++;

      // Wait before verification to allow orders to propagate
      await this.sleep(VERIFICATION_RETRY_DELAY_MS);

      this.logger.debug(`🔍 Verifying protection (attempt ${verificationAttempt}/${MAX_VERIFICATION_RETRIES})...`);

      try {
        const verification = await this.bybitService.verifyProtectionSet(side);

        if (verification.verified) {
          this.logger.info('✅ Protection verified successfully', {
            hasStopLoss: verification.hasStopLoss,
            hasTakeProfit: verification.hasTakeProfit,
            stopLossPrice: verification.stopLossPrice?.toFixed(DECIMAL_PLACES.PERCENT),
            takeProfitCount: verification.takeProfitPrices?.length,
            activeOrders: verification.activeOrders,
            hasTrailingStop: verification.hasTrailingStop,
          });
          return true;
        }

        this.logger.warn(`⚠️ Protection verification failed (attempt ${verificationAttempt})`, {
          hasStopLoss: verification.hasStopLoss,
          hasTakeProfit: verification.hasTakeProfit,
          activeOrders: verification.activeOrders,
        });

        // Retry if not verified and more attempts available
        if (verificationAttempt < MAX_VERIFICATION_RETRIES) {
          await this.retryFailedProtection(
            side,
            entryPrice,
            quantity,
            actualStopLoss,
            tpOrderIds,
            verification,
          );
        }
      } catch (error) {
        this.logger.error(`❌ Verification attempt ${verificationAttempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });

        if (verificationAttempt >= MAX_VERIFICATION_RETRIES) {
          break;
        }
      }
    }

    // Protection verification failed after all retries
    this.logger.error('🚨 CRITICAL: Failed to verify protection after all retries!', {
      maxRetries: MAX_VERIFICATION_RETRIES,
      side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
    });

    // Emergency close position
    await this.emergencyClosePosition(side, quantity);

    return false;
  }

  /**
   * Retry failed protection placement
   *
   * @param side - Position side
   * @param entryPrice - Entry price
   * @param quantity - Position quantity
   * @param actualStopLoss - Stop-loss price
   * @param tpOrderIds - Take-profit order IDs
   * @param verification - Verification result indicating what failed
   */
  private async retryFailedProtection(
    side: PositionSide,
    entryPrice: number,
    quantity: number,
    actualStopLoss: number,
    tpOrderIds: (string | undefined)[],
    verification: any,
  ): Promise<void> {
    // Retry SL placement if missing
    if (!verification.hasStopLoss) {
      this.logger.warn('🔄 Retrying SL placement...');
      try {
        await this.bybitService.updateStopLoss(actualStopLoss);
      } catch (error) {
        this.logger.error('Failed to retry SL placement', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Retry TP placement if missing
    if (!verification.hasTakeProfit) {
      this.logger.warn('🔄 Retrying TP placement...');
      try {
        // Note: We would need to pass the TP levels again
        // This is a limitation - we only have orderIds, not the original TP config
        // For now, just log the issue
        this.logger.warn('⚠️ Cannot retry TP placement - original TP levels not available in this context');
      } catch (error) {
        this.logger.error('Failed to retry TP placement', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Emergency close position if protection verification fails
   * This is a safety mechanism to prevent leaving unprotected positions open
   *
   * @param side - Position side
   * @param quantity - Position quantity
   */
  private async emergencyClosePosition(side: PositionSide, quantity: number): Promise<void> {
    this.logger.error('🚨 EMERGENCY: Closing position without protection!');
    try {
      await this.bybitService.closePosition(side, quantity);
      await this.telegram.sendAlert(
        '🚨 EMERGENCY: Position closed due to missing TP/SL protection!',
      );
      this.logger.info('✅ Emergency close completed successfully');
    } catch (closeError) {
      this.logger.error('Failed to emergency close position!', {
        error: closeError instanceof Error ? closeError.message : String(closeError),
      });
      await this.telegram.sendAlert(
        '🚨🚨🚨 CRITICAL: Position open WITHOUT PROTECTION - MANUAL INTERVENTION REQUIRED!',
      );
    }
  }

  /**
   * Calculate stop-loss distance in absolute price
   *
   * @param entryPrice - Entry price
   * @param signalStopLoss - Signal's stop-loss price
   * @returns SL distance in price points
   */
  private calculateSLDistance(entryPrice: number, signalStopLoss: number): number {
    return Math.abs(signalStopLoss - entryPrice);
  }

  /**
   * Calculate actual stop-loss price accounting for market movement
   *
   * @param isLong - true for LONG, false for SHORT
   * @param currentPrice - Current market price
   * @param slDistance - SL distance in price points
   * @returns Actual SL price to set
   */
  private calculateActualStopLoss(
    isLong: boolean,
    currentPrice: number,
    slDistance: number,
  ): number {
    return isLong ? currentPrice - slDistance : currentPrice + slDistance;
  }

  /**
   * Sleep utility for delays
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
