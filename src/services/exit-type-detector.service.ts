/**
 * Exit Type Detector Service
 * Determines position exit type from order history and TP levels
 *
 * Responsibilities:
 * - Analyze order history to determine if exit was SL/TP/Trailing/Manual
 * - Identify which TP level was hit based on price
 * - Return structured exit information for journal
 */

import { BybitOrder, ExitType, Position, PositionSide, LoggerService } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors';

/**
 * Exit Type Detector Service
 * Analyzes order history to determine position exit reason
 *
 * Phase 8.9.18: ErrorHandler integration for robust data validation
 * - SKIP strategy for missing/malformed order data
 * - THROW strategy for missing Position object
 * - Comprehensive logging for debugging
 */
export class ExitTypeDetectorService {
  constructor(
    private readonly logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  /**
   * Determine position exit type from order history
   * Analyzes filled orders to identify SL/TP/Trailing/Manual close
   *
   * Phase 8.9.18: ErrorHandler integration with SKIP strategy
   * - SKIP on empty order history (use MANUAL fallback)
   * - SKIP on malformed price parsing (use TP1 default)
   *
   * @param orderHistory - Order history from exchange
   * @param position - Position being analyzed
   * @returns Exit type (SL, TP1/TP2/TP3, TRAILING, MANUAL)
   */
  public determineExitTypeFromHistory(orderHistory: BybitOrder[], position: Position): ExitType {
    // Phase 8.9.18: Validate input
    if (!position) {
      const error = new Error('Position object is required for exit type determination');
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExitTypeDetectorService.determineExitTypeFromHistory.missingPosition',
        });
      }
      throw error;
    }

    // Find filled orders for this symbol
    const filledOrders = orderHistory
      .filter((o) => o.symbol === position.symbol && o.orderStatus === 'Filled')
      .sort((a, b) => {
        const aTime = (a as Record<string, unknown>).updatedTime as number;
        const bTime = (b as Record<string, unknown>).updatedTime as number;
        return bTime - aTime;
      }); // Most recent first

    if (filledOrders.length === 0) {
      // Phase 8.9.18: SKIP strategy for missing order history
      if (this.errorHandler) {
        const error = new Error('No filled orders found in history');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'ExitTypeDetectorService.determineExitTypeFromHistory.noFilledOrders',
          onRecover: () => {
            this.logger.warn('No filled orders found, assuming MANUAL close (fallback)');
          },
        });
      }
      this.logger.warn('No filled orders found in history, assuming MANUAL close');
      return ExitType.MANUAL;
    }

    // Check last filled order
    const lastOrder = filledOrders[0];

    // Stop Loss: triggerPrice exists + reduceOnly + side matches close direction
    if (lastOrder.stopOrderType === 'Stop' || lastOrder.stopOrderType === 'StopLoss') {
      return ExitType.STOP_LOSS;
    }

    // Trailing Stop
    if (lastOrder.stopOrderType === 'TrailingStop') {
      return ExitType.TRAILING_STOP;
    }

    // Take Profit: Limit order + reduceOnly
    if (lastOrder.orderType === 'Limit' && lastOrder.reduceOnly === true) {
      // Try to determine TP level from price
      const tpLevel = this.identifyTPLevel(parseFloat(lastOrder.price), position);
      if (tpLevel === 1) {
        return ExitType.TAKE_PROFIT_1;
      }
      if (tpLevel === 2) {
        return ExitType.TAKE_PROFIT_2;
      }
      if (tpLevel === 3) {
        return ExitType.TAKE_PROFIT_3;
      }
      return ExitType.TAKE_PROFIT_1; // Fallback
    }

    // Market order + reduceOnly = likely manual close
    if (lastOrder.orderType === 'Market' && lastOrder.reduceOnly === true) {
      return ExitType.MANUAL;
    }

    this.logger.warn('Could not determine exitType from order history', {
      lastOrderType: lastOrder.orderType,
      stopOrderType: lastOrder.stopOrderType,
      reduceOnly: lastOrder.reduceOnly,
    });

    return ExitType.MANUAL; // Fallback
  }

  /**
   * Identify TP level from execution price
   * Returns 1, 2, or 3 based on which TP level price is closest to
   *
   * Phase 8.9.18: ErrorHandler integration with SKIP strategy
   * - SKIP on NaN price (use TP1 default)
   * - SKIP on empty takeProfits array (use TP1 default)
   *
   * @param price - Execution price
   * @param position - Position with TP levels
   * @returns TP level (1, 2, or 3)
   */
  public identifyTPLevel(price: number, position: Position): number {
    // Phase 8.9.18: Validate price (NaN check)
    if (isNaN(price)) {
      if (this.errorHandler) {
        const error = new Error('Invalid execution price (NaN) for TP identification');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'ExitTypeDetectorService.identifyTPLevel.invalidPrice',
          onRecover: () => {
            this.logger.warn('Invalid TP price detected, defaulting to TP1');
          },
        });
      }
      return 1; // Fallback for NaN
    }

    const tpLevels = position.takeProfits;

    if (tpLevels.length === 0) {
      // Phase 8.9.18: SKIP strategy for missing TP levels
      if (this.errorHandler) {
        const error = new Error('No TP levels defined in position');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'ExitTypeDetectorService.identifyTPLevel.noTPLevels',
          onRecover: () => {
            this.logger.warn('No TP levels defined, defaulting to TP1');
          },
        });
      }
      return 1; // Fallback if no TP levels defined
    }

    // Find closest TP level to execution price
    let closestIndex = 0;
    let minDifference = Math.abs(price - tpLevels[0].price);

    for (let i = 1; i < tpLevels.length; i++) {
      const difference = Math.abs(price - tpLevels[i].price);
      if (difference < minDifference) {
        minDifference = difference;
        closestIndex = i;
      }
    }

    return closestIndex + 1; // Return 1-based index
  }
}
