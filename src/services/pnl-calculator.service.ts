import { PERCENT_MULTIPLIER, BYBIT_FEES } from '../constants';
/**
 * PnL Calculator Service
 *
 * Calculates profit/loss for trades with correct fees.
 * Separated for testability and reusability.
 *
 * Formula:
 * - pnlGross = (exitPrice - entryPrice) × quantity × directionMultiplier
 * - fees = (entryValue + exitValue) × feeRate
 * - pnlNet = pnlGross - fees
 *
 * Where directionMultiplier:
 * - LONG: +1 (profit when price goes up)
 * - SHORT: -1 (profit when price goes down)
 */

import { PositionSide } from '../types';

// ============================================================================
// CONSTANTS (Re-exported from src/constants.ts for backwards compatibility)
// ============================================================================

export const BYBIT_TAKER_FEE = BYBIT_FEES.TAKER;
export const BYBIT_MAKER_FEE = BYBIT_FEES.MAKER;

// ============================================================================
// TYPES
// ============================================================================

export interface PnLResult {
  pnlGross: number; // PnL before fees
  fees: number; // Trading fees
  pnlNet: number; // PnL after fees
  pnlPercent: number; // PnL as percentage of entry value
}

// ============================================================================
// PNL CALCULATOR SERVICE
// ============================================================================

export class PnLCalculatorService {
  /**
   * Calculate PnL for a trade
   * @param side - Position side (LONG or SHORT)
   * @param entryPrice - Entry price
   * @param exitPrice - Exit price
   * @param quantity - Quantity traded
   * @param feeRate - Fee rate (default: taker fee 0.055%)
   */
  static calculate(
    side: PositionSide,
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    feeRate: number = BYBIT_TAKER_FEE,
  ): PnLResult {
    // Calculate gross PnL
    const priceDiff = exitPrice - entryPrice;
    const directionMultiplier = side === PositionSide.LONG ? 1 : -1;
    const pnlGross = priceDiff * quantity * directionMultiplier;

    // Calculate fees
    const entryValue = entryPrice * quantity;
    const exitValue = exitPrice * quantity;
    const fees = (entryValue + exitValue) * feeRate;

    // Calculate net PnL
    const pnlNet = pnlGross - fees;

    // Calculate percentage
    const pnlPercent = (priceDiff / entryPrice) * PERCENT_MULTIPLIER * directionMultiplier;

    return {
      pnlGross,
      fees,
      pnlNet,
      pnlPercent,
    };
  }

  /**
   * Calculate total PnL from multiple partial closes
   */
  static calculatePartialCloses(
    side: PositionSide,
    entryPrice: number,
    closes: Array<{ quantity: number; exitPrice: number }>,
    feeRate: number = BYBIT_TAKER_FEE,
  ): PnLResult {
    let totalPnlGross = 0;
    let totalFees = 0;

    closes.forEach((close) => {
      const result = this.calculate(side, entryPrice, close.exitPrice, close.quantity, feeRate);
      totalPnlGross += result.pnlGross;
      totalFees += result.fees;
    });

    const totalPnlNet = totalPnlGross - totalFees;

    // Calculate weighted average percentage
    const totalQuantity = closes.reduce((sum, c) => sum + c.quantity, 0);
    const weightedAvgExitPrice =
      closes.reduce((sum, c) => sum + c.exitPrice * c.quantity, 0) / totalQuantity;
    const priceDiff = weightedAvgExitPrice - entryPrice;
    const directionMultiplier = side === PositionSide.LONG ? 1 : -1;
    const pnlPercent = (priceDiff / entryPrice) * PERCENT_MULTIPLIER * directionMultiplier;

    return {
      pnlGross: totalPnlGross,
      fees: totalFees,
      pnlNet: totalPnlNet,
      pnlPercent,
    };
  }

  /**
   * Calculate break-even price (price at which PnL = 0 after fees)
   */
  static calculateBreakeven(
    side: PositionSide,
    entryPrice: number,
    feeRate: number = BYBIT_TAKER_FEE,
  ): number {
    // Break-even: pnlGross = fees
    // (exitPrice - entryPrice) × qty × mult = (entryPrice × qty + exitPrice × qty) × feeRate
    // Simplify (divide by qty):
    // (exitPrice - entryPrice) × mult = (entryPrice + exitPrice) × feeRate

    const directionMultiplier = side === PositionSide.LONG ? 1 : -1;

    // For LONG: exitPrice - entryPrice = (entryPrice + exitPrice) × feeRate
    // For SHORT: -(exitPrice - entryPrice) = (entryPrice + exitPrice) × feeRate

    // Solve for exitPrice:
    // LONG: exitPrice × (1 - feeRate) = entryPrice × (1 + feeRate)
    // SHORT: exitPrice × (1 + feeRate) = entryPrice × (1 - feeRate)

    if (side === PositionSide.LONG) {
      return (entryPrice * (1 + feeRate)) / (1 - feeRate);
    } else {
      return (entryPrice * (1 - feeRate)) / (1 + feeRate);
    }
  }
}
