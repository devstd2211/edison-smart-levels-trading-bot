import { DECIMAL_PLACES } from '../constants';
/**
 * Compound Interest Calculator Service
 *
 * Calculates position sizes using compound interest logic to automatically
 * scale positions based on account profit while protecting base deposit.
 *
 * Features:
 * - Automatic position scaling based on profit
 * - Base deposit protection (never fully risked)
 * - Profit locking (portion of profit is protected)
 * - Configurable reinvestment percentage
 * - Risk limits per trade
 *
 * Error Handling (Phase 8.9.76):
 * - THROW: Config validation errors (negative amounts, invalid percentages)
 * - GRACEFUL_DEGRADE: Calculation failures (getBalance rejection, NaN/Infinity handling)
 * - SKIP: Logging failures (non-blocking via safeLog wrapper)
 *
 * Example Usage:
 * ```typescript
 * const calculator = new CompoundInterestCalculatorService(config, logger, getBalance, errorHandler);
 * const result = await calculator.calculatePositionSize();
 * console.log(`Position size: ${result.positionSize} USDT`);
 * ```
 */

import { CompoundInterestConfig, LoggerService } from '../types/legacy';
import { ICONS } from '../cli/cli-runtime';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  calculateCompoundPositionSize,
  validateCompoundConfig,
  CompoundCalculationResult,
} from '../utils/compound-interest.helpers';
import { getErrorMessage, normalizeError } from '../utils/error.utils';
import {
  COMPOUND_INTEREST_GROWTH_SEARCH_STEP,
  COMPOUND_INTEREST_GROWTH_TARGET_MULTIPLIER,
} from './compound-interest-calculator.constants';

export class CompoundInterestCalculatorService {
  constructor(
    private config: CompoundInterestConfig,
    private logger: LoggerService,
    private getBalance: () => Promise<number>, // Function to get current balance from exchange
    private errorHandler?: ErrorHandler, // Optional ErrorHandler for error recovery
  ) {
    // Validate config on initialization - THROW on validation errors
    try {
      validateCompoundConfig(config);
      this.safeLog('info', `${ICONS.success} CompoundInterestCalculator initialized`, {
        enabled: config.enabled,
        baseDeposit: config.baseDeposit,
        reinvestmentPercent: config.reinvestmentPercent,
        profitLockPercent: config.profitLockPercent,
        minSize: config.minPositionSize,
        maxSize: config.maxPositionSize,
      });
    } catch (error: unknown) {
      this.safeLog('error', `${ICONS.error} Invalid CompoundInterest config`, {
        error,
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Calculate position size based on current balance and compound interest rules
   *
   * @returns Calculation result with position size and breakdown
   * GRACEFUL_DEGRADE: Returns safe default on getBalance failure or NaN/Infinity values
   */
  async calculatePositionSize(): Promise<CompoundCalculationResult> {
    // If ErrorHandler provided, use executeAsync for GRACEFUL_DEGRADE on NaN/Infinity
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => {
          // Get current balance from exchange
          const currentBalance = await this.getBalance();

          this.safeLog('debug', 'Calculating compound position size', {
            currentBalance,
            baseDeposit: this.config.baseDeposit,
          });

          // Calculate using helpers (will throw on negative balance)
          const calcResult = calculateCompoundPositionSize(currentBalance, this.config);

          // Log result
          this.logCalculationResult(calcResult);

          return calcResult;
        },
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success && result.value) {
        return result.value;
      } else {
        // GRACEFUL_DEGRADE: Return safe default on failure (NaN/Infinity calculation issues)
        this.safeLog('warn', `${ICONS.warning} Compound calculation failed, using safe defaults`, {
          error: result.error?.message,
        });
        return {
          positionSize: this.config.minPositionSize,
          currentBalance: 0,
          totalProfit: 0,
          lockedProfit: 0,
          availableProfit: 0,
          reinvestedAmount: 0,
          protectionActive: true,
          limitApplied: 'none',
        };
      }
    }

    // Fallback without ErrorHandler (backward compatible)
    try {
      // Get current balance from exchange
      const currentBalance = await this.getBalance();

      this.safeLog('debug', 'Calculating compound position size', {
        currentBalance,
        baseDeposit: this.config.baseDeposit,
      });

      // Calculate using helpers (will throw on negative balance, pass through NaN/Infinity)
      const calcResult = calculateCompoundPositionSize(currentBalance, this.config);

      // Log result
      this.logCalculationResult(calcResult);

      return calcResult;
    } catch (error: unknown) {
      this.safeLog('error', 'Error calculating compound position size', {
        error,
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CompoundInterestConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (useful for dynamic adjustments)
   *
   * @param newConfig - New configuration
   * GRACEFUL_DEGRADE: Reverts to old config if validation fails
   */
  updateConfig(newConfig: Partial<CompoundInterestConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    try {
      validateCompoundConfig(this.config);
      this.safeLog('info', `${ICONS.success} CompoundInterest config updated`, {
        enabled: this.config.enabled,
        reinvestmentPercent: this.config.reinvestmentPercent,
      });
    } catch (error: unknown) {
      // GRACEFUL_DEGRADE: Revert to old config on validation failure
      this.config = oldConfig;
      this.safeLog('error', `${ICONS.error} Invalid config update, reverted to previous`, {
        error,
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Check if compound interest is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get position size without making API call (for testing/simulation)
   *
   * @param currentBalance - Balance to use for calculation
   * @returns Calculation result
   */
  calculatePositionSizeSync(currentBalance: number): CompoundCalculationResult {
    return calculateCompoundPositionSize(currentBalance, this.config);
  }

  /**
   * Estimate future position size after a profit/loss
   *
   * @param currentBalance - Current balance
   * @param estimatedPnL - Expected profit or loss
   * @returns Estimated position size after PnL
   */
  estimateFuturePositionSize(currentBalance: number, estimatedPnL: number): number {
    const futureBalance = currentBalance + estimatedPnL;
    const result = calculateCompoundPositionSize(futureBalance, this.config);
    return result.positionSize;
  }

  /**
   * Calculate potential growth from current position
   *
   * @param currentBalance - Current balance
   * @returns Growth metrics
   * GRACEFUL_DEGRADE: Returns safe defaults on calculation failures (negative balance, etc)
   */
  calculateGrowthMetrics(currentBalance: number): {
    currentSize: number;
    profitToNextLevel: number; // How much profit needed to increase position by 10%
    maxPossibleSize: number;
    growthFactor: number; // Current size / min size
  } {
    try {
      const currentResult = calculateCompoundPositionSize(currentBalance, this.config);

      // Calculate profit needed for 10% position increase
      const targetSize = currentResult.positionSize * COMPOUND_INTEREST_GROWTH_TARGET_MULTIPLIER;
      let profitNeeded = 0;

      // Binary search for required profit (handles NaN/Infinity gracefully)
      for (let profit = 0; profit < this.config.maxPositionSize; profit += COMPOUND_INTEREST_GROWTH_SEARCH_STEP) {
        const testBalance = currentBalance + profit;
        const testResult = calculateCompoundPositionSize(testBalance, this.config);
        if (testResult.positionSize >= targetSize) {
          profitNeeded = profit;
          break;
        }
      }

      // Handle NaN/Infinity in growth factor
      let growthFactor = currentResult.positionSize / this.config.minPositionSize;
      if (!Number.isFinite(growthFactor)) {
        growthFactor = 1; // Safe default for NaN/Infinity
      }

      return {
        currentSize: currentResult.positionSize,
        profitToNextLevel: profitNeeded,
        maxPossibleSize: this.config.maxPositionSize,
        growthFactor,
      };
    } catch (error: unknown) {
      // GRACEFUL_DEGRADE: Return safe defaults on error (e.g., negative balance)
      this.safeLog('warn', `${ICONS.warning} Growth metrics calculation failed`, {
        error: getErrorMessage(error),
      });
      return {
        currentSize: this.config.minPositionSize,
        profitToNextLevel: 0,
        maxPossibleSize: this.config.maxPositionSize,
        growthFactor: 1,
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Safe logger wrapper - SKIP strategy for logging failures
   * Prevents logging errors from interrupting calculations
   */
  private safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>
  ): void {
    try {
      switch (level) {
        case 'debug':
          this.logger.debug(message, data);
          break;
        case 'info':
          this.logger.info(message, data);
          break;
        case 'warn':
          this.logger.warn(message, data);
          break;
        case 'error':
          this.logger.error(message, data);
          break;
      }
    } catch (logError: unknown) {
      // SKIP: Silently ignore logging failures - never block operations
      if (this.errorHandler) {
        this.errorHandler.handle(
          normalizeError(logError),
          { strategy: RecoveryStrategy.SKIP }
        );
      }
      // If no ErrorHandler, just silently ignore
    }
  }

  /**
   * Log calculation result with appropriate level (with SKIP error handling)
   */
  private logCalculationResult(result: CompoundCalculationResult): void {
    const {
      positionSize,
      currentBalance,
      totalProfit,
      lockedProfit,
      protectionActive,
      limitApplied,
    } = result;

    const logData = {
      positionSize: positionSize.toFixed(DECIMAL_PLACES.PERCENT),
      currentBalance: currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
      totalProfit: totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
      lockedProfit: lockedProfit.toFixed(DECIMAL_PLACES.PERCENT),
      protectionActive,
      limitApplied,
      growthFactor: (positionSize / this.config.minPositionSize).toFixed(DECIMAL_PLACES.PERCENT) + 'x',
    };

    if (protectionActive) {
      this.safeLog('warn', `${ICONS.warning} Deposit protection active`, logData);
    } else if (limitApplied !== 'none') {
      this.safeLog('info', `${ICONS.warning} Position limit applied: ${limitApplied}`, logData);
    } else {
      this.safeLog('debug', `${ICONS.money} Compound position calculated`, logData);
    }
  }
}
