/**
 * Position Sizing Service
 * Single Responsibility: Calculate position size and quantity
 *
 * Extracts all sizing logic from PositionManager.openPosition()
 * Responsibility ONLY for calculations, NOT for execution
 *
 * Pricing Chain (in order):
 * 1. Fixed USDT size from config
 * 2. OR Compound interest override
 * 3. OR Risk-based sizing override
 * 4. Apply loss-streak multiplier
 * 5. Calculate final quantity
 * 6. Validate against exchange limits
 */

import {
  LoggerService,
  Signal,
  TradingConfig,
  RiskManagementConfig,
  Config,
} from '../types';
import { BybitService } from './bybit';
import { PositionCalculatorService } from './position-calculator.service';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';

/**
 * Result of position sizing calculation
 */
export interface PositionSizingResult {
  positionSizeUsdt: number;
  quantity: number;
  roundedQuantity: string;
  marginUsed: number;
  notionalValue: number;
  sizingChain: string[]; // Track which sizing methods were applied
}

/**
 * Position Sizing Service
 * Calculates position size considering all factors
 */
export class PositionSizingService {
  constructor(
    private readonly bybitService: BybitService,
    private readonly positionCalculator: PositionCalculatorService,
    private readonly logger: LoggerService,
    private readonly tradingConfig: TradingConfig,
    private readonly riskConfig: RiskManagementConfig,
    private readonly fullConfig: Config,
    private readonly compoundInterestCalculator?: any,
    private readonly riskBasedSizingService?: any,
    private readonly lossStreakService?: any,
  ) {}

  /**
   * Calculate final position size and quantity
   * Applies sizing methods in priority order
   *
   * @param signal - Trading signal with entry price and SL
   * @returns PositionSizingResult with final quantity and metrics
   * @throws Error if calculation fails or invalid
   */
  async calculatePositionSize(signal: Signal): Promise<PositionSizingResult> {
    const sizingChain: string[] = [];

    // =========================================================================
    // STEP 1: Determine base position size (USDT)
    // =========================================================================

    let positionSizeUsdt: number;

    // Try Compound Interest (highest priority if enabled)
    if (this.compoundInterestCalculator?.isEnabled?.()) {
      const compoundResult = await this.compoundInterestCalculator.calculatePositionSize();
      positionSizeUsdt = compoundResult.positionSize;
      sizingChain.push('COMPOUND_INTEREST');

      this.logger.info('💰 Position sizing: Compound interest', {
        currentBalance: compoundResult.currentBalance.toFixed(DECIMAL_PLACES.PERCENT),
        totalProfit: compoundResult.totalProfit.toFixed(DECIMAL_PLACES.PERCENT),
        positionSize: positionSizeUsdt.toFixed(DECIMAL_PLACES.PERCENT),
        growthFactor: (positionSizeUsdt / this.riskConfig.positionSizeUsdt).toFixed(DECIMAL_PLACES.PERCENT) + 'x',
      });
    } else {
      // Use fixed position size from config (default)
      positionSizeUsdt = this.riskConfig.positionSizeUsdt;
      sizingChain.push('FIXED');

      this.logger.debug('📊 Position sizing: Fixed USDT', {
        positionSize: positionSizeUsdt.toFixed(DECIMAL_PLACES.PERCENT),
      });
    }

    // =========================================================================
    // STEP 2: Apply Risk-Based Sizing Override
    // =========================================================================

    if (this.riskBasedSizingService) {
      const currentBalance = await this.bybitService.getBalance();
      const riskBasedSize = this.riskBasedSizingService.calculatePositionSize(
        currentBalance,
        signal.price,
        signal.stopLoss,
      );

      const originalSize = positionSizeUsdt;
      positionSizeUsdt = riskBasedSize;
      sizingChain.push('RISK_BASED');

      const slDistance = Math.abs(signal.price - signal.stopLoss);
      const slPercent = (slDistance / signal.price) * PERCENT_MULTIPLIER;

      this.logger.info('🎯 Position sizing: Risk-based override', {
        originalSize: originalSize.toFixed(DECIMAL_PLACES.PERCENT),
        newSize: riskBasedSize.toFixed(DECIMAL_PLACES.PERCENT),
        slDistance: slDistance.toFixed(DECIMAL_PLACES.PERCENT),
        slPercent: slPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
      });
    }

    // =========================================================================
    // STEP 3: Apply Loss Streak Multiplier
    // =========================================================================

    if (this.lossStreakService) {
      const multiplier = this.lossStreakService.getSizeMultiplier();
      const originalSize = positionSizeUsdt;
      positionSizeUsdt = positionSizeUsdt * multiplier;
      sizingChain.push('LOSS_STREAK_MULTIPLIER');

      this.logger.info('🔻 Position sizing: Loss streak multiplier', {
        consecutiveLosses: this.lossStreakService.getConsecutiveLosses(),
        multiplier: (multiplier * PERCENT_MULTIPLIER).toFixed(0) + '%',
        originalSize: originalSize.toFixed(DECIMAL_PLACES.PERCENT),
        adjustedSize: positionSizeUsdt.toFixed(DECIMAL_PLACES.PERCENT),
      });
    }

    // =========================================================================
    // STEP 4: Calculate Quantity with Exchange Limits Validation
    // =========================================================================

    const limits = this.bybitService.getExchangeLimits();
    const calculation = this.positionCalculator.calculateQuantity(
      positionSizeUsdt,
      this.tradingConfig.leverage,
      signal.price,
      limits,
    );

    if (!calculation.isValid) {
      const errorMsg = `Position calculation failed: ${calculation.validationErrors.join(', ')}`;

      this.logger.error('❌ Position sizing: Calculation failed', {
        errors: calculation.validationErrors,
        positionSizeUsdt,
        leverage: this.tradingConfig.leverage,
        price: signal.price,
        limits,
      });

      throw new Error(errorMsg);
    }

    const quantity = parseFloat(calculation.roundedQuantity);

    this.logger.info('✅ Position sizing: Quantity calculated', {
      quantity,
      roundedQuantity: calculation.roundedQuantity,
      marginUsed: calculation.marginUsed,
      notionalValue: calculation.notionalValue,
      sizingChain: sizingChain.join(' → '),
    });

    // =========================================================================
    // STEP 5: Return Complete Result
    // =========================================================================

    return {
      positionSizeUsdt,
      quantity,
      roundedQuantity: calculation.roundedQuantity,
      marginUsed: calculation.marginUsed,
      notionalValue: calculation.notionalValue,
      sizingChain,
    };
  }
}
