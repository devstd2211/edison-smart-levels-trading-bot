/**
 * Position Protection Service
 *
 * Handles placement and verification of Stop Loss and Take Profit orders
 * - Places SL/TP orders on the exchange
 * - Verifies protection is actually set (with retries)
 * - Emergency closes position if protection fails
 */

import { LoggerService, PositionSide, Signal } from '../types';
import { BybitService } from './bybit';
import { TelegramService } from './telegram.service';

const MAX_VERIFICATION_RETRIES = 3;
const VERIFICATION_WAIT_MS = 1000;

interface ProtectionSetup {
  slOrderId: string | null;
  tpOrderIds: (string | undefined)[];
  actualStopLoss: number;
  verified: boolean;
}

/**
 * Position Protection Service
 * Manages SL/TP placement and verification
 */
export class PositionProtectionService {
  constructor(
    private bybitService: BybitService,
    private telegram: TelegramService,
    private logger: LoggerService,
  ) {}

  /**
   * Place and verify position protection (SL/TP)
   *
   * @param signal - Entry signal with SL/TP data
   * @param side - Position side (LONG/SHORT)
   * @param quantity - Position quantity
   * @param entryPrice - Signal entry price
   * @param currentPrice - Current market price (for SL recalculation)
   * @returns Protection setup with verification status
   */
  async setAndVerifyProtection(
    signal: Signal,
    side: PositionSide,
    quantity: number,
    entryPrice: number,
    currentPrice: number,
  ): Promise<ProtectionSetup> {
    const isLongPosition = side === PositionSide.LONG;

    // Calculate actual SL based on current market price (to avoid slippage)
    const slDistancePercent = Math.abs((signal.stopLoss - entryPrice) / entryPrice * 100);
    const slDistance = currentPrice * (slDistancePercent / 100);
    const actualStopLoss = isLongPosition
      ? currentPrice - slDistance
      : currentPrice + slDistance;

    this.logger.info('📊 SL recalculated for actual entry', {
      signalPrice: entryPrice,
      signalSL: signal.stopLoss,
      currentPrice,
      slDistancePercent: slDistancePercent.toFixed(2) + '%',
      actualStopLoss: actualStopLoss.toFixed(4),
    });

    // Place take-profit levels
    const tpOrderIds = await this.bybitService.placeTakeProfitLevels({
      side,
      entryPrice,
      totalQuantity: quantity,
      levels: signal.takeProfits,
    });

    // Set stop-loss
    await this.bybitService.updateStopLoss(actualStopLoss);
    const slOrderId = null; // No orderId for position-level SL

    // Verify protection is actually set
    const verified = await this.verifyProtectionWithRetries(side, actualStopLoss, signal, quantity, entryPrice);

    if (!verified) {
      this.logger.error('🚨 CRITICAL: Failed to verify protection after retries!', {
        side,
        entryPrice,
        quantity,
      });

      // Emergency close
      await this.emergencyClosePosition(side, quantity);
    }

    return {
      slOrderId,
      tpOrderIds,
      actualStopLoss,
      verified,
    };
  }

  /**
   * Verify protection with retries
   */
  private async verifyProtectionWithRetries(
    side: PositionSide,
    actualStopLoss: number,
    signal: Signal,
    quantity: number,
    entryPrice: number,
  ): Promise<boolean> {
    // 🚨 CRITICAL: Verify protection is actually set (double-check)
    let verificationAttempt = 0;
    let protectionVerified = false;

    while (verificationAttempt < MAX_VERIFICATION_RETRIES && !protectionVerified) {
      verificationAttempt++;

      // Wait before verification to allow orders to propagate
      await this.sleep(VERIFICATION_WAIT_MS);

      this.logger.debug(`🔍 Verifying protection (attempt ${verificationAttempt}/${MAX_VERIFICATION_RETRIES})...`);

      const verification = await this.bybitService.verifyProtectionSet(side);

      if (verification.verified) {
        protectionVerified = true;
        this.logger.info('✅ Protection verified successfully', {
          hasStopLoss: verification.hasStopLoss,
          hasTakeProfit: verification.hasTakeProfit,
          stopLossPrice: verification.stopLossPrice,
          takeProfitCount: verification.takeProfitPrices?.length,
          activeOrders: verification.activeOrders,
          hasTrailingStop: verification.hasTrailingStop,
        });
      } else {
        this.logger.warn(`⚠️ Protection verification failed (attempt ${verificationAttempt})`, {
          hasStopLoss: verification.hasStopLoss,
          hasTakeProfit: verification.hasTakeProfit,
          activeOrders: verification.activeOrders,
        });

        // Retry setting protection if missing
        if (!verification.hasStopLoss && verificationAttempt < MAX_VERIFICATION_RETRIES) {
          this.logger.warn('🔄 Retrying SL placement...');
          try {
            await this.bybitService.updateStopLoss(actualStopLoss);
          } catch (error) {
            this.logger.error('Failed to retry SL placement', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (!verification.hasTakeProfit && verificationAttempt < MAX_VERIFICATION_RETRIES) {
          this.logger.warn('🔄 Retrying TP placement...');
          try {
            await this.bybitService.placeTakeProfitLevels({
              side,
              entryPrice,
              totalQuantity: quantity,
              levels: signal.takeProfits,
            });
          } catch (error) {
            this.logger.error('Failed to retry TP placement', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    return protectionVerified;
  }

  /**
   * Emergency close position if protection fails
   */
  private async emergencyClosePosition(side: PositionSide, quantity: number): Promise<void> {
    this.logger.error('🚨 EMERGENCY: Closing position without protection!');
    try {
      await this.bybitService.closePosition(side, quantity);
      await this.telegram.sendAlert('🚨 EMERGENCY: Position closed due to missing TP/SL protection!');
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
   * Sleep helper for async delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
