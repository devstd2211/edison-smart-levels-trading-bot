/**
 * Position PnL Calculator Service
 * Calculates unrealized P&L for open positions
 *
 * Responsibilities:
 * - Calculate percentage P&L based on position side and current price
 * - Support both LONG and SHORT positions
 * - Return normalized P&L percentage
 * - Handle errors with ErrorHandler integration (THROW for validation, GRACEFUL_DEGRADE for calc failures)
 */

import { Position, PositionSide } from '../types';
import { PERCENT_MULTIPLIER } from '../constants';
import { ErrorHandler } from '../errors/ErrorHandler';
import { RecoveryStrategy } from '../errors/ErrorHandler';

/**
 * Position PnL Calculator Service
 * Calculates unrealized P&L for positions
 */
export class PositionPnLCalculatorService {
  constructor(private errorHandler?: ErrorHandler) {}

  /**
   * Validate position and current price inputs
   * THROW on invalid inputs to fail fast
   *
   * @param position - The position to validate
   * @param currentPrice - The current price to validate
   * @throws If validation fails
   */
  private validateInputs(position: Position, currentPrice: number): void {
    // THROW: null/undefined position
    if (!position) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('Position cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('Position cannot be null or undefined');
    }

    // THROW: NaN/Infinity currentPrice
    if (!Number.isFinite(currentPrice)) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Current price must be a finite number, got ${currentPrice}`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Current price must be a finite number, got ${currentPrice}`);
    }

    // THROW: NaN/Infinity/non-positive entryPrice
    if (!Number.isFinite(position.entryPrice) || position.entryPrice <= 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Entry price must be a positive finite number, got ${position.entryPrice}`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Entry price must be a positive finite number, got ${position.entryPrice}`);
    }

    // THROW: invalid position side
    if (!position.side || (position.side !== PositionSide.LONG && position.side !== PositionSide.SHORT)) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Position side must be LONG or SHORT, got ${position.side}`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Position side must be LONG or SHORT, got ${position.side}`);
    }
  }

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
   * @throws If position or currentPrice is invalid
   */
  public calculatePnL(position: Position, currentPrice: number): number {
    // Validation happens outside try-catch to propagate THROW errors
    this.validateInputs(position, currentPrice);

    // Calculate with GRACEFUL_DEGRADE for extremely rare calculation failures
    try {
      if (position.side === PositionSide.LONG) {
        return ((currentPrice - position.entryPrice) / position.entryPrice) * PERCENT_MULTIPLIER;
      } else {
        return ((position.entryPrice - currentPrice) / position.entryPrice) * PERCENT_MULTIPLIER;
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: calculation failed, return 0 P&L as safe default
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return 0; // Safe default: no profit, no loss
    }
  }
}
