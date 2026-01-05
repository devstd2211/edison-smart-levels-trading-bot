import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Virtual Balance Service
 *
 * Manages virtual trading balance independent from exchange balance.
 * Essential for:
 * - Demo mode: ignore huge demo balance (e.g., 49,614 USDT)
 * - Production: track bot's actual P&L separate from manual trades
 * - Compound interest: use bot's actual performance, not exchange balance
 *
 * State persisted to virtual-balance.json and synced on startup.
 *
 * Usage:
 * ```typescript
 * const vb = new VirtualBalanceService(logger, 50); // Start with 50 USDT
 * vb.updateBalance(+5.0, 'APEX_001'); // Add profit
 * const current = vb.getCurrentBalance(); // 55.0
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, ValidatedVirtualBalanceState } from '../types';
import { createErrorContext } from '../utils/error-helper';

// ============================================================================
// TYPES
// ============================================================================

export interface VirtualBalanceState {
  currentBalance: number; // Current virtual balance
  baseDeposit: number; // Initial deposit (never changes)
  lastUpdated: number; // Timestamp of last update
  totalTrades: number; // Total number of trades
  lastTradeId: string; // ID of last processed trade
  totalProfit: number; // Total profit (currentBalance - baseDeposit)
  allTimeHigh: number; // Highest balance achieved
  allTimeLow: number; // Lowest balance achieved
}

// ============================================================================
// VIRTUAL BALANCE SERVICE
// ============================================================================

export class VirtualBalanceService {
  private statePath: string;
  private state: VirtualBalanceState;

  constructor(
    private logger: LoggerService,
    private baseDeposit: number,
    private dataDir: string = './data',
  ) {
    if (baseDeposit < 0) {
      throw new Error('Base deposit cannot be negative');
    }

    this.statePath = path.join(this.dataDir, 'virtual-balance.json');
    this.state = this.loadState();
  }

  /**
   * Load state from file or initialize
   */
  private loadState(): VirtualBalanceState {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, 'utf-8');
        const state = JSON.parse(content) as ValidatedVirtualBalanceState;

        // Update base deposit if changed in config
        if (state.baseDeposit !== this.baseDeposit) {
          this.logger.warn('⚠️ Base deposit changed in config', {
            old: state.baseDeposit,
            new: this.baseDeposit,
            currentBalance: state.currentBalance,
          });

          // Option 1: Keep current balance, just update base reference
          state.baseDeposit = this.baseDeposit;

          // Recalculate profit
          state.totalProfit = state.currentBalance - this.baseDeposit;
        }

        this.logger.info('✅ Virtual balance loaded', {
          balance: state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
          profit: state.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
          trades: state.totalTrades,
        });

        return state;
      }
    } catch (error: unknown) {
      const errorContext = createErrorContext(error);
      this.logger.error('❌ Failed to load virtual balance', {
        error: errorContext.message,
        timestamp: errorContext.timestamp,
      });
    }

    // Initialize new state
    const newState: VirtualBalanceState = {
      currentBalance: this.baseDeposit,
      baseDeposit: this.baseDeposit,
      lastUpdated: Date.now(),
      totalTrades: 0,
      lastTradeId: '',
      totalProfit: 0,
      allTimeHigh: this.baseDeposit,
      allTimeLow: this.baseDeposit,
    };

    this.saveState(newState);

    this.logger.info('✅ Virtual balance initialized', {
      balance: newState.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
      baseDeposit: this.baseDeposit.toFixed(DECIMAL_PLACES.PERCENT),
    });

    return newState;
  }

  /**
   * Save state to file
   */
  private saveState(state: VirtualBalanceState): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error: unknown) {
      const errorContext = createErrorContext(error);
      this.logger.error('❌ Failed to save virtual balance', {
        error: errorContext.message,
        timestamp: errorContext.timestamp,
      });
    }
  }

  /**
   * Get current virtual balance
   */
  getCurrentBalance(): number {
    return this.state.currentBalance;
  }

  /**
   * Get base deposit
   */
  getBaseDeposit(): number {
    return this.state.baseDeposit;
  }

  /**
   * Get total profit (current - base)
   */
  getTotalProfit(): number {
    return this.state.totalProfit;
  }

  /**
   * Get profit percentage
   */
  getProfitPercent(): number {
    if (this.state.baseDeposit === 0) {
      return 0;
    }
    return (this.state.totalProfit / this.state.baseDeposit) * PERCENT_MULTIPLIER;
  }

  /**
   * Get complete state
   */
  getState(): VirtualBalanceState {
    return { ...this.state };
  }

  /**
   * Update balance after trade
   */
  updateBalance(pnl: number, tradeId: string): void {
    const oldBalance = this.state.currentBalance;

    this.state.currentBalance += pnl;
    this.state.lastUpdated = Date.now();
    this.state.totalTrades++;
    this.state.lastTradeId = tradeId;
    this.state.totalProfit = this.state.currentBalance - this.state.baseDeposit;

    // Update all-time highs/lows
    if (this.state.currentBalance > this.state.allTimeHigh) {
      this.state.allTimeHigh = this.state.currentBalance;
    }
    if (this.state.currentBalance < this.state.allTimeLow) {
      this.state.allTimeLow = this.state.currentBalance;
    }

    this.saveState(this.state);

    const emoji = pnl > 0 ? '💰' : pnl < 0 ? '📉' : '➖';

    this.logger.info(`${emoji} Virtual balance updated`, {
      tradeId,
      pnl: pnl.toFixed(DECIMAL_PLACES.PERCENT),
      oldBalance: oldBalance.toFixed(DECIMAL_PLACES.PERCENT),
      newBalance: this.state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
      profit: this.state.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
      profitPercent: this.getProfitPercent().toFixed(DECIMAL_PLACES.PERCENT) + '%',
    });
  }

  /**
   * Reset balance to base deposit
   */
  reset(newBaseDeposit?: number): void {
    const deposit = newBaseDeposit !== undefined ? newBaseDeposit : this.baseDeposit;

    this.state.currentBalance = deposit;
    this.state.baseDeposit = deposit;
    this.state.lastUpdated = Date.now();
    this.state.totalTrades = 0;
    this.state.lastTradeId = '';
    this.state.totalProfit = 0;
    this.state.allTimeHigh = deposit;
    this.state.allTimeLow = deposit;

    this.saveState(this.state);

    this.logger.warn('⚠️ Virtual balance RESET', {
      balance: deposit.toFixed(DECIMAL_PLACES.PERCENT),
    });
  }

  /**
   * Sync balance from trade history (recalculate from scratch)
   * Useful for fixing inconsistencies
   */
  async syncFromHistory(trades: Array<{ id: string; netPnl: number }>): Promise<void> {
    let calculatedBalance = this.state.baseDeposit;
    let lastTradeId = '';

    for (const trade of trades) {
      calculatedBalance += trade.netPnl;
      lastTradeId = trade.id;
    }

    const diff = Math.abs(calculatedBalance - this.state.currentBalance);

    if (diff > 0.01) {
      // Threshold for floating point errors
      this.logger.warn('⚠️ Balance mismatch detected, syncing from history', {
        currentBalance: this.state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        calculatedBalance: calculatedBalance.toFixed(DECIMAL_PLACES.PERCENT),
        difference: diff.toFixed(DECIMAL_PLACES.PERCENT),
      });

      this.state.currentBalance = calculatedBalance;
      this.state.totalProfit = calculatedBalance - this.state.baseDeposit;
      this.state.totalTrades = trades.length;
      this.state.lastTradeId = lastTradeId;
      this.state.lastUpdated = Date.now();

      // Update all-time highs/lows
      if (calculatedBalance > this.state.allTimeHigh) {
        this.state.allTimeHigh = calculatedBalance;
      }
      if (calculatedBalance < this.state.allTimeLow) {
        this.state.allTimeLow = calculatedBalance;
      }

      this.saveState(this.state);

      this.logger.info('✅ Virtual balance synced from history', {
        balance: this.state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        profit: this.state.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
        trades: this.state.totalTrades,
      });
    } else {
      this.logger.debug('✅ Virtual balance in sync with history', {
        balance: this.state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
      });
    }
  }
}
