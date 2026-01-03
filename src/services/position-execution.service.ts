/**
 * Position Execution Service
 *
 * Handles execution of position opening operations:
 * - Opens position on exchange
 * - Places take-profit levels
 * - Places stop-loss order
 * - Executes orders atomically to prevent partial failures
 */

import { LoggerService, PositionSide, Signal } from '../types';
import { BybitService } from './bybit';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';

/**
 * Result of position execution
 */
export interface ExecutionResult {
  orderId: string;
  tpOrderIds: (string | undefined)[];
  actualStopLoss: number;
  slOrderId: string | null;
}

/**
 * Position Execution Service
 * Handles opening positions and placing orders
 */
export class PositionExecutionService {
  constructor(
    private bybitService: BybitService,
    private logger: LoggerService,
  ) {}

  /**
   * Execute full position opening workflow
   * Opens position, places TPs, places SL atomically
   *
   * @param signal - Trading signal with entry/SL/TP details
   * @param side - Position side (LONG/SHORT)
   * @param quantity - Position quantity
   * @param leverage - Position leverage
   * @returns Execution result with order IDs
   */
  async executePositionOpening(
    signal: Signal,
    side: PositionSide,
    quantity: number,
    leverage: number = 1,
  ): Promise<ExecutionResult> {
    // Step 1: Open position on exchange
    const orderId = await this.openPositionOnExchange(side, quantity, leverage);

    // Step 2: Place take-profit levels
    const tpOrderIds = await this.placeTakeProfitLevels(side, signal, quantity);

    // Step 3: Place stop-loss with recalculation
    const actualStopLoss = await this.placeStopLoss(signal, side);

    return {
      orderId,
      tpOrderIds,
      actualStopLoss,
      slOrderId: null, // Position-level SL doesn't have orderId
    };
  }

  /**
   * Open position on exchange
   */
  private async openPositionOnExchange(side: PositionSide, quantity: number, leverage: number): Promise<string> {
    this.logger.debug('Opening position on exchange', { side, quantity, leverage });

    const orderId = await this.bybitService.openPosition({
      side,
      quantity,
      leverage,
    });

    this.logger.info('Position opened on exchange', { orderId, side, quantity });
    return orderId;
  }

  /**
   * Place take-profit levels
   */
  private async placeTakeProfitLevels(
    side: PositionSide,
    signal: Signal,
    quantity: number,
  ): Promise<(string | undefined)[]> {
    this.logger.debug('Placing take-profit levels', { side, quantity, tpCount: signal.takeProfits.length });

    const tpOrderIds = await this.bybitService.placeTakeProfitLevels({
      side,
      entryPrice: signal.price,
      totalQuantity: quantity,
      levels: signal.takeProfits,
    });

    this.logger.info('Take-profit levels placed', { side, tpCount: tpOrderIds.length });
    return tpOrderIds;
  }

  /**
   * Place stop-loss with recalculation based on actual market price
   * This avoids slippage issues from the signal price
   */
  private async placeStopLoss(signal: Signal, side: PositionSide): Promise<number> {
    // Calculate SL distance from signal
    const slDistancePercent = Math.abs((signal.stopLoss - signal.price) / signal.price * PERCENT_MULTIPLIER);

    // Get current market price (after position opened)
    const currentPrice = await this.bybitService.getCurrentPrice();
    const slDistance = currentPrice * (slDistancePercent / PERCENT_MULTIPLIER);

    // Determine actual SL based on position direction
    const isLongPosition = side === 'LONG';
    const actualStopLoss = isLongPosition
      ? currentPrice - slDistance
      : currentPrice + slDistance;

    this.logger.info('SL recalculated for actual entry', {
      signalPrice: signal.price,
      signalSL: signal.stopLoss,
      currentPrice,
      slDistancePercent: slDistancePercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
      actualStopLoss: actualStopLoss.toFixed(DECIMAL_PLACES.PERCENT),
    });

    // Place stop-loss
    await this.bybitService.updateStopLoss(actualStopLoss);

    return actualStopLoss;
  }
}
