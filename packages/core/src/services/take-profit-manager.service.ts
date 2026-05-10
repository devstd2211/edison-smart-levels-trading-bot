import { DECIMAL_PLACES, BYBIT_FEES } from '../constants';
import { EPSILON } from '../constants/technical.constants';
import { LoggerService, PositionSide } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { TakeProfitCalculationError } from '../errors/DomainErrors';
import { ICONS } from '../cli/cli-runtime';

/**
 * Take Profit Manager Service (Phase 8.9.22)
 *
 * Manages partial take-profit closes and tracks PnL for each TP level.
 *
 * Error Handling Integration:
 * - THROW: Quantity validation (prevents data corruption)
 * - SKIP: Logger failures (non-blocking notifications)
 *
 * Features:
 * - Track multiple TP levels (TP1, TP2, TP3)
 * - Calculate PnL for each partial close
 * - Accumulate total PnL across all closes
 * - Handle fees calculation per close
 * - Optional ErrorHandler injection for resilience
 */

// ============================================================================
// CONSTANTS
// ============================================================================

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
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.config = config;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Record a partial close when TP level is hit
   *
   * Error Handling:
   * - THROW on quantity validation (prevents data corruption)
   * - SKIP on logger failures (non-critical notifications)
   */
  recordPartialClose(level: number, quantity: number, exitPrice: number): PartialClose {
    // VALIDATE: Quantity must not exceed remaining position (THROW strategy)
    if (this.totalQuantityClosed + quantity > this.config.totalQuantity) {
      const errorMsg = `Cannot close ${quantity}: would exceed total quantity ${this.config.totalQuantity}`;
      if (this.errorHandler) {
        const error = new TakeProfitCalculationError(
          errorMsg,
          {
            positionId: this.config.positionId,
            level,
            quantity,
            exitPrice,
            entryPrice: this.config.entryPrice,
            reason: `Total would exceed: ${this.totalQuantityClosed + quantity} > ${this.config.totalQuantity}`,
          },
        );
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'TakeProfitManager.recordPartialClose[validation]',
        });
      }
      throw new Error(errorMsg);
    }

    // CALCULATE: PnL for this partial close (synchronous, no error handling)
    const pnlMultiplier = this.config.side === PositionSide.LONG ? 1 : -1;
    const priceDiff = exitPrice - this.config.entryPrice;
    const pnlGross = priceDiff * quantity * pnlMultiplier * this.config.leverage;

    // Calculate fees
    const entryValue = this.config.entryPrice * quantity;
    const exitValue = exitPrice * quantity;
    const fees = (entryValue + exitValue) * BYBIT_TAKER_FEE;

    // Net PnL
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

    // LOG: Record partial close (SKIP strategy for logger failures)
    if (this.errorHandler) {
      // Fire and forget logging with SKIP strategy (non-blocking)
      this.errorHandler
        .executeAsync(
          async () => {
            this.logger.info(`${ICONS.chart} Partial close recorded`, {
              positionId: this.config.positionId,
              level: `TP${level}`,
              quantity,
              exitPrice,
              pnlNet: pnlNet.toFixed(DECIMAL_PLACES.PRICE),
            });
            return true;
          },
          {
            strategy: RecoveryStrategy.SKIP,
            context: 'TakeProfitManager.recordPartialClose[logging]',
          },
        )
        .catch(() => {
          // SKIP strategy: don't block on logging errors
        });
    } else {
      // No ErrorHandler: use original logging
      this.logger.info(`${ICONS.chart} Partial close recorded`, {
        positionId: this.config.positionId,
        level: `TP${level}`,
        quantity,
        exitPrice,
        pnlNet: pnlNet.toFixed(DECIMAL_PLACES.PRICE),
      });
    }

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
   * Get total quantity closed so far
   */
  getTotalQuantityClosed(): number {
    return this.totalQuantityClosed;
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
   * Pure synchronous calculation (no error handling needed for pure math)
   */
  calculateFinalPnL(finalExitPrice: number): {
    partialPnL: { pnlGross: number; fees: number; pnlNet: number };
    remainingPnL: { pnlGross: number; fees: number; pnlNet: number };
    totalPnL: { pnlGross: number; fees: number; pnlNet: number };
  } {
    // PnL from partial closes
    const partialPnL = this.getTotalPnL();

    // Calculate PnL for remaining quantity (simple synchronous calculation)
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
