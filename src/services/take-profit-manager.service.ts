import { DECIMAL_PLACES, BYBIT_FEES } from '../constants';
import { EPSILON } from '../constants/technical.constants';
/**
 * Take Profit Manager Service
 *
 * Manages partial take-profit closes and tracks PnL for each TP level.
 *
 * Features:
 * - Track multiple TP levels (TP1, TP2, TP3)
 * - Calculate PnL for each partial close
 * - Accumulate total PnL across all closes
 * - Handle fees calculation per close
 *
 * Usage:
 * 1. Initialize with position details
 * 2. Call recordPartialClose() for each TP hit
 * 3. Get totalPnL() at any time
 */

import { LoggerService, PositionSide } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Use centralized fee constant from src/constants.ts
const BYBIT_TAKER_FEE = BYBIT_FEES.TAKER;

// ============================================================================
// TYPES
// ============================================================================

export interface PartialClose {
  level: number; // TP level (1, 2, 3)
  quantity: number; // Quantity closed
  exitPrice: number; // Price at which closed
  pnlGross: number; // PnL before fees
  fees: number; // Trading fees
  pnlNet: number; // PnL after fees
  timestamp: number; // When closed
}

export interface TakeProfitManagerConfig {
  positionId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  totalQuantity: number;
  leverage: number; // Leverage multiplier for PnL calculation
}

// ============================================================================
// TAKE PROFIT MANAGER SERVICE
// ============================================================================

export class TakeProfitManagerService {
  private config: TakeProfitManagerConfig;
  private partialCloses: PartialClose[] = [];
  private totalQuantityClosed: number = 0;

  constructor(
    config: TakeProfitManagerConfig,
    private readonly logger: LoggerService,
  ) {
    this.config = config;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Record a partial close when TP level is hit
   */
  recordPartialClose(level: number, quantity: number, exitPrice: number): PartialClose {
    // Validate
    if (this.totalQuantityClosed + quantity > this.config.totalQuantity) {
      throw new Error(
        `Cannot close ${quantity}: would exceed total quantity ${this.config.totalQuantity}`,
      );
    }

    // Calculate PnL for this partial close
    const pnlMultiplier = this.config.side === PositionSide.LONG ? 1 : -1;
    const priceDiff = exitPrice - this.config.entryPrice;
    const pnlGross = priceDiff * quantity * pnlMultiplier * this.config.leverage;

    // Calculate fees for this close
    const entryValue = this.config.entryPrice * quantity;
    const exitValue = exitPrice * quantity;
    const fees = (entryValue + exitValue) * BYBIT_TAKER_FEE;

    // Net PnL after fees
    const pnlNet = pnlGross - fees;

    const partialClose: PartialClose = {
      level,
      quantity,
      exitPrice,
      pnlGross,
      fees,
      pnlNet,
      timestamp: Date.now(),
    };

    this.partialCloses.push(partialClose);
    this.totalQuantityClosed += quantity;

    this.logger.info('📊 Partial close recorded', {
      positionId: this.config.positionId,
      level: `TP${level}`,
      quantity,
      exitPrice,
      pnlNet: pnlNet.toFixed(DECIMAL_PLACES.PRICE),
    });

    return partialClose;
  }

  /**
   * Get total PnL across all partial closes
   */
  getTotalPnL(): { pnlGross: number; fees: number; pnlNet: number } {
    const pnlGross = this.partialCloses.reduce((sum, pc) => sum + pc.pnlGross, 0);
    const fees = this.partialCloses.reduce((sum, pc) => sum + pc.fees, 0);
    const pnlNet = this.partialCloses.reduce((sum, pc) => sum + pc.pnlNet, 0);

    return { pnlGross, fees, pnlNet };
  }

  /**
   * Get all partial closes
   */
  getPartialCloses(): PartialClose[] {
    return [...this.partialCloses];
  }

  /**
   * Get total realized PnL from all partial closes
   */
  getTotalRealizedPnL(): number {
    return this.partialCloses.reduce((sum, close) => sum + close.pnlNet, 0);
  }

  /**
   * Get remaining quantity
   */
  getRemainingQuantity(): number {
    return this.config.totalQuantity - this.totalQuantityClosed;
  }

  /**
   * Check if position is fully closed
   */
  isFullyClosed(): boolean {
    // Use epsilon for floating point comparison
    return this.totalQuantityClosed >= this.config.totalQuantity - EPSILON;
  }

  /**
   * Get count of TP levels hit
   */
  getTpLevelsHit(): number[] {
    return this.partialCloses.map((pc) => pc.level);
  }

  /**
   * Reset (for testing or position reopen)
   */
  reset(): void {
    this.partialCloses = [];
    this.totalQuantityClosed = 0;
  }

  /**
   * Calculate final PnL if remaining quantity closes at given price
   */
  calculateFinalPnL(finalExitPrice: number): {
    partialPnL: { pnlGross: number; fees: number; pnlNet: number };
    remainingPnL: { pnlGross: number; fees: number; pnlNet: number };
    totalPnL: { pnlGross: number; fees: number; pnlNet: number };
  } {
    // PnL from partial closes
    const partialPnL = this.getTotalPnL();

    // Calculate PnL for remaining quantity
    const remainingQty = this.getRemainingQuantity();
    const pnlMultiplier = this.config.side === PositionSide.LONG ? 1 : -1;
    const priceDiff = finalExitPrice - this.config.entryPrice;
    const pnlGrossRemaining = priceDiff * remainingQty * pnlMultiplier * this.config.leverage;

    const entryValueRemaining = this.config.entryPrice * remainingQty;
    const exitValueRemaining = finalExitPrice * remainingQty;
    const feesRemaining = (entryValueRemaining + exitValueRemaining) * BYBIT_TAKER_FEE;

    const pnlNetRemaining = pnlGrossRemaining - feesRemaining;

    const remainingPnL = {
      pnlGross: pnlGrossRemaining,
      fees: feesRemaining,
      pnlNet: pnlNetRemaining,
    };

    // Total PnL
    const totalPnL = {
      pnlGross: partialPnL.pnlGross + remainingPnL.pnlGross,
      fees: partialPnL.fees + remainingPnL.fees,
      pnlNet: partialPnL.pnlNet + remainingPnL.pnlNet,
    };

    return { partialPnL, remainingPnL, totalPnL };
  }
}
