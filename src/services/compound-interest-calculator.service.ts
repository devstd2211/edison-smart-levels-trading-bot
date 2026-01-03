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
 * Example Usage:
 * ```typescript
 * const calculator = new CompoundInterestCalculatorService(config, logger, bybitService);
 * const result = await calculator.calculatePositionSize();
 * console.log(`Position size: ${result.positionSize} USDT`);
 * ```
 */

import { CompoundInterestConfig, LoggerService } from '../types';
import {
  calculateCompoundPositionSize,
  validateCompoundConfig,
  CompoundCalculationResult,
} from '../utils/compound-interest.helpers';

export class CompoundInterestCalculatorService {
  constructor(
    private config: CompoundInterestConfig,
    private logger: LoggerService,
    private getBalance: () => Promise<number>, // Function to get current balance from exchange
  ) {
    // Validate config on initialization
    try {
      validateCompoundConfig(config);
      this.logger.info('✅ CompoundInterestCalculator initialized', {
        enabled: config.enabled,
        baseDeposit: config.baseDeposit,
        reinvestmentPercent: config.reinvestmentPercent,
        profitLockPercent: config.profitLockPercent,
        minSize: config.minPositionSize,
        maxSize: config.maxPositionSize,
      });
    } catch (error: unknown) {
      this.logger.error('❌ Invalid CompoundInterest config', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate position size based on current balance and compound interest rules
   *
   * @returns Calculation result with position size and breakdown
   */
  async calculatePositionSize(): Promise<CompoundCalculationResult> {
    try {
      // Get current balance from exchange
      const currentBalance = await this.getBalance();

      this.logger.debug('Calculating compound position size', {
        currentBalance,
        baseDeposit: this.config.baseDeposit,
      });

      // Calculate using helpers
      const result = calculateCompoundPositionSize(currentBalance, this.config);

      // Log result
      this.logCalculationResult(result);

      return result;
    } catch (error: unknown) {
      this.logger.error('Error calculating compound position size', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
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
   */
  updateConfig(newConfig: Partial<CompoundInterestConfig>): void {
    this.config = { ...this.config, ...newConfig };

    try {
      validateCompoundConfig(this.config);
      this.logger.info('✅ CompoundInterest config updated', {
        enabled: this.config.enabled,
        reinvestmentPercent: this.config.reinvestmentPercent,
      });
    } catch (error: unknown) {
      this.logger.error('❌ Invalid config update', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
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
   */
  calculateGrowthMetrics(currentBalance: number): {
    currentSize: number;
    profitToNextLevel: number; // How much profit needed to increase position by 10%
    maxPossibleSize: number;
    growthFactor: number; // Current size / min size
  } {
    const currentResult = calculateCompoundPositionSize(currentBalance, this.config);

    // Calculate profit needed for 10% position increase
    const targetSize = currentResult.positionSize * 1.1;
    let profitNeeded = 0;

    // Binary search for required profit
    for (let profit = 0; profit < this.config.maxPositionSize; profit += 0.1) {
      const testBalance = currentBalance + profit;
      const testResult = calculateCompoundPositionSize(testBalance, this.config);
      if (testResult.positionSize >= targetSize) {
        profitNeeded = profit;
        break;
      }
    }

    return {
      currentSize: currentResult.positionSize,
      profitToNextLevel: profitNeeded,
      maxPossibleSize: this.config.maxPositionSize,
      growthFactor: currentResult.positionSize / this.config.minPositionSize,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Log calculation result with appropriate level
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
      this.logger.warn('🛡️ Deposit protection ACTIVE', logData);
    } else if (limitApplied !== 'none') {
      this.logger.info(`⚠️ Position limit applied: ${limitApplied}`, logData);
    } else {
      this.logger.debug('💰 Compound position calculated', logData);
    }
  }
}
