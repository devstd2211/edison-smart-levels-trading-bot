/**
 * Position PnL Calculator Service
 * Calculates unrealized P&L for open positions
 *
 * Responsibilities:
 * - Calculate percentage P&L based on position side and current price
 * - Support both LONG and SHORT positions
 * - Return normalized P&L percentage
 */

import { Position, PositionSide } from '../types';
import { PERCENT_MULTIPLIER } from '../constants';

/**
 * Position PnL Calculator Service
 * Calculates unrealized P&L for positions
 */
export class PositionPnLCalculatorService {
  /**
   * Calculate unrealized P&L percentage for a position
   *
   * Formula:
   * - LONG: ((currentPrice - entryPrice) / entryPrice) * 100
   * - SHORT: ((entryPrice - currentPrice) / entryPrice) * 100
   *
   * @param position - The position to calculate P&L for
   * @param currentPrice - Current market price
   * @returns P&L as percentage (positive = profit, negative = loss)
   */
  public calculatePnL(position: Position, currentPrice: number): number {
    if (position.side === PositionSide.LONG) {
      return ((currentPrice - position.entryPrice) / position.entryPrice) * PERCENT_MULTIPLIER;
    } else {
      return ((position.entryPrice - currentPrice) / position.entryPrice) * PERCENT_MULTIPLIER;
    }
  }
}
