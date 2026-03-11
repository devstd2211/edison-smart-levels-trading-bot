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
 * Error Handling: Phase 8.9.43
 * - RETRY: File I/O operations (loadState, saveState)
 * - GRACEFUL_DEGRADE: syncFromHistory (non-critical)
 * - SKIP: Logging errors (always continue)
 * - THROW: Validation errors (halt on invalid input)
 *
 * Usage:
 * ```typescript
 * const vb = new VirtualBalanceService(logger, errorHandler, 50); // With error handling
 * vb.updateBalance(+5.0, 'APEX_001'); // Add profit
 * const current = vb.getCurrentBalance(); // 55.0
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, ValidatedVirtualBalanceState } from '../types/legacy';
import { createErrorContext } from '../utils/error-helper';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { FileSystemError, ValidationError } from '../errors/DomainErrors';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { getErrorMessage } from '../utils/error.utils';

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
  private state: VirtualBalanceState | null = null;
  private lastSyncAttempt = 0;
  private syncFailureCount = 0;
  private initialized = false;

  constructor(
    private logger: LoggerService,
    private errorHandler: ErrorHandler,
    private baseDeposit: number,
    private dataDir: string = './data',
  ) {
    // THROW: Validation is critical
    if (baseDeposit < 0) {
      throw new ValidationError('Base deposit cannot be negative', {
        baseDeposit,
        context: 'VirtualBalanceService.constructor',
      });
    }

    this.statePath = path.join(this.dataDir, 'virtual-balance.json');
  }

  /**
   * Start service initialization (explicit lifecycle)
   */
  start(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.state = this.loadState();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.start();
    }
  }

  /**
   * Load state from file or initialize (RETRY on file I/O)
   */
  private loadState(): VirtualBalanceState {
    let state: ValidatedVirtualBalanceState | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    // Simple synchronous retry loop for file I/O
    while (retryCount < maxRetries) {
      try {
        if (fs.existsSync(this.statePath)) {
          const content = fs.readFileSync(this.statePath, 'utf-8');
          state = JSON.parse(content) as ValidatedVirtualBalanceState;
        }
        break; // Success, exit loop
      } catch (error: unknown) {
        retryCount++;
        const errorMsg = getErrorMessage(error);

        if (retryCount < maxRetries) {
          // RETRY: Exponential backoff for recoverable errors
          const delayMs = 50 * Math.pow(2, retryCount - 1);
          this.logger.warn(
            `⚠️ Retrying virtual balance load (attempt ${retryCount}/${maxRetries})`,
            {
              error: errorMsg,
              nextRetryMs: delayMs,
            }
          );
          // Note: In production, would need async delay, but constructor is sync
        } else {
          // GRACEFUL_DEGRADE: Log and continue with fresh state
          this.logger.error(
            `❌ Failed to load virtual balance after ${maxRetries} attempts`,
            {
              error: errorMsg,
              context: 'VirtualBalanceService.loadState',
            }
          );
          state = null;
        }
      }
    }

    if (state) {
      // Update base deposit if changed in config
      if (state.baseDeposit !== this.baseDeposit) {
        this.logger.warn('⚠️ Base deposit changed in config', {
          old: state.baseDeposit,
          new: this.baseDeposit,
          currentBalance: state.currentBalance,
        });

        state.baseDeposit = this.baseDeposit;
        state.totalProfit = state.currentBalance - this.baseDeposit;
      }

      this.logger.info('✅ Virtual balance loaded', {
        balance: state.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        profit: state.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
        trades: state.totalTrades,
      });

      return state;
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
   * Save state to file (with RETRY + SKIP strategy for file I/O)
   */
  private saveState(state: VirtualBalanceState): void {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        if (!fs.existsSync(this.dataDir)) {
          fs.mkdirSync(this.dataDir, { recursive: true });
        }
        fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
        return; // Success
      } catch (error: unknown) {
        retryCount++;
        const errorMsg = getErrorMessage(error);

        if (retryCount < maxRetries) {
          // RETRY: Continue with exponential backoff
          this.logger.warn(
            `⚠️ Retrying virtual balance save (attempt ${retryCount}/${maxRetries})`,
            {
              error: errorMsg,
            }
          );
        } else {
          // SKIP: Log failure but don't throw (balance is in memory)
          this.logger.error(
            `❌ Failed to save virtual balance after ${maxRetries} attempts`,
            {
              error: errorMsg,
              balance: state.currentBalance,
              context: 'VirtualBalanceService.saveState',
            }
          );
          this.logger.warn('⚠️ Virtual balance not persisted to disk (in-memory only)', {
            balance: state.currentBalance,
          });
        }
      }
    }
  }

  /**
   * Get current virtual balance
   */
  getCurrentBalance(): number {
    this.ensureInitialized();
    return this.state!.currentBalance;
  }

  /**
   * Get base deposit
   */
  getBaseDeposit(): number {
    this.ensureInitialized();
    return this.state!.baseDeposit;
  }

  /**
   * Get total profit (current - base)
   */
  getTotalProfit(): number {
    this.ensureInitialized();
    return this.state!.totalProfit;
  }

  /**
   * Get profit percentage
   */
  getProfitPercent(): number {
    this.ensureInitialized();
    if (this.state!.baseDeposit === 0) {
      return 0;
    }
    return (this.state!.totalProfit / this.state!.baseDeposit) * PERCENT_MULTIPLIER;
  }

  /**
   * Get complete state
   */
  getState(): VirtualBalanceState {
    this.ensureInitialized();
    return { ...this.state! };
  }

  private updateAllTimeExtremes(): void {
    if (!this.state) {
      return;
    }
    if (this.state.currentBalance > this.state.allTimeHigh) {
      this.state.allTimeHigh = this.state.currentBalance;
    }
    if (this.state.currentBalance < this.state.allTimeLow) {
      this.state.allTimeLow = this.state.currentBalance;
    }
  }

  /**
   * Update balance after trade (SKIP on logging errors, THROW on validation)
   */
  updateBalance(pnl: number, tradeId: string): void {
    this.ensureInitialized();
    // Validate input (THROW on invalid)
    if (!tradeId || typeof tradeId !== 'string') {
      throw new ValidationError('Invalid trade ID', {
        tradeId,
        context: 'VirtualBalanceService.updateBalance',
      });
    }

    const oldBalance = this.state!.currentBalance;

    this.state!.currentBalance += pnl;
    this.state!.lastUpdated = Date.now();
    this.state!.totalTrades++;
    this.state!.lastTradeId = tradeId;
    this.state!.totalProfit = this.state!.currentBalance - this.state!.baseDeposit;

    this.updateAllTimeExtremes();

    this.saveState(this.state!);

    // SKIP: Logging errors don't block balance update
    try {
      const emoji = pnl > 0 ? '💰' : pnl < 0 ? '📉' : '➖';

      this.logger.info(`${emoji} Virtual balance updated`, {
        tradeId,
        pnl: pnl.toFixed(DECIMAL_PLACES.PERCENT),
        oldBalance: oldBalance.toFixed(DECIMAL_PLACES.PERCENT),
        newBalance: this.state!.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        profit: this.state!.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
        profitPercent: this.getProfitPercent().toFixed(DECIMAL_PLACES.PERCENT) + '%',
      });
    } catch (error: unknown) {
      // SKIP: Log error but don't throw
      const errorMsg = getErrorMessage(error);
      this.logger.error('❌ Error logging balance update', {
        error: errorMsg,
        tradeId,
        pnl,
        context: 'VirtualBalanceService.updateBalance',
      });
    }
  }

  /**
   * Reset balance to base deposit (with validation - THROW on error)
   */
  reset(newBaseDeposit?: number): void {
    this.ensureInitialized();
    const deposit = newBaseDeposit !== undefined ? newBaseDeposit : this.baseDeposit;

    // Validate (THROW on invalid)
    if (deposit < 0) {
      throw new ValidationError('Base deposit cannot be negative', {
        deposit,
        context: 'VirtualBalanceService.reset',
      });
    }

    this.state!.currentBalance = deposit;
    this.state!.baseDeposit = deposit;
    this.state!.lastUpdated = Date.now();
    this.state!.totalTrades = 0;
    this.state!.lastTradeId = '';
    this.state!.totalProfit = 0;
    this.state!.allTimeHigh = deposit;
    this.state!.allTimeLow = deposit;

    this.saveState(this.state!);

    this.logger.warn('⚠️ Virtual balance RESET', {
      balance: deposit.toFixed(DECIMAL_PLACES.PERCENT),
    });
  }

  /**
   * Sync balance from trade history (recalculate from scratch)
   * Useful for fixing inconsistencies (with GRACEFUL_DEGRADE)
   */
  async syncFromHistory(trades: Array<{ id: string; netPnl: number }>): Promise<void> {
    this.ensureInitialized();
    const performSync = async () => {
      let calculatedBalance = this.state!.baseDeposit;
      let lastTradeId = '';

      for (const trade of trades) {
        calculatedBalance += trade.netPnl;
        lastTradeId = trade.id;
      }

      return { calculatedBalance, lastTradeId };
    };

    try {
      const { calculatedBalance, lastTradeId } = await performSync();
      const diff = Math.abs(calculatedBalance - this.state!.currentBalance);

      if (diff > 0.01) {
        // Threshold for floating point errors
        this.logger.warn('⚠️ Balance mismatch detected, syncing from history', {
          currentBalance: this.state!.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
          calculatedBalance: calculatedBalance.toFixed(DECIMAL_PLACES.PERCENT),
          difference: diff.toFixed(DECIMAL_PLACES.PERCENT),
        });

        this.state!.currentBalance = calculatedBalance;
        this.state!.totalProfit = calculatedBalance - this.state!.baseDeposit;
        this.state!.totalTrades = trades.length;
        this.state!.lastTradeId = lastTradeId;
        this.state!.lastUpdated = Date.now();

        // Update all-time highs/lows
        if (calculatedBalance > this.state!.allTimeHigh) {
          this.state!.allTimeHigh = calculatedBalance;
        }
        if (calculatedBalance < this.state!.allTimeLow) {
          this.state!.allTimeLow = calculatedBalance;
        }

        this.saveState(this.state!);

        this.logger.info('✅ Virtual balance synced from history', {
          balance: this.state!.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
          profit: this.state!.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
          trades: this.state!.totalTrades,
        });
      } else {
        this.logger.debug('✅ Virtual balance in sync with history', {
          balance: this.state!.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        });
      }

      this.lastSyncAttempt = Date.now();
      this.syncFailureCount = 0;
    } catch (error: unknown) {
      // GRACEFUL_DEGRADE: Sync failure is non-critical
      const result = await this.errorHandler.handle(error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'VirtualBalanceService.syncFromHistory',
        onFailure: (err, _attemptsUsed) => {
          this.syncFailureCount++;
          this.logger.warn('⚠️ Virtual balance sync failed (degraded mode)', {
            error: err.message,
            failureCount: this.syncFailureCount,
            balance: this.state!.currentBalance,
          });
        },
      });

      if (!result.success && this.syncFailureCount > 3) {
        this.logger.error('❌ Multiple sync failures - consider manual review', {
          failureCount: this.syncFailureCount,
          lastAttempt: new Date(this.lastSyncAttempt).toISOString(),
        });
      }
    }
  }
}
