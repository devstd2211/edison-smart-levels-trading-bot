/**
 * Weight Calculator (Phase 3)
 *
 * Replaces hard blocks with gradient weights for better signal quality.
 * Instead of blocking signals, applies confidence modifiers based on market conditions.
 *
 * Benefits:
 * - +30-50% more entries (no hard blocks)
 * - Better risk adjustment (weak signals = low confidence)
 * - Fewer missed opportunities
 */

import { WeightSystemConfig, SignalDirection, LoggerService } from '../types';
import {
  PERCENTAGE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  MULTIPLIERS,
  DECIMAL_PLACES,
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  THRESHOLD_VALUES,
} from '../constants';
import { DEFAULT_MODIFIER_MULTIPLIER } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const PERCENT_TO_DECIMAL = INTEGER_MULTIPLIERS.ONE_HUNDRED;

// RSI thresholds for weight calculation (used in getRSIModifier)
const RSI_THRESHOLDS = {
  EXTREME_OVERSOLD: PERCENTAGE_THRESHOLDS.LOW_MODERATE, // 20
  STRONG_OVERSOLD: PERCENTAGE_THRESHOLDS.MODERATE, // 30
  MODERATE_OVERSOLD: PERCENTAGE_THRESHOLDS.MODERATE_HIGH, // 40
  SLIGHT_OVERBOUGHT: PERCENTAGE_THRESHOLDS.VERY_HIGH, // 60
  MODERATE_OVERBOUGHT: CONFIDENCE_THRESHOLDS.MODERATE, // 70
  EXTREME_OVERBOUGHT: PERCENTAGE_THRESHOLDS.EXTREME, // 80
} as const;

// Volume ratio thresholds for weight calculation (used in getVolumeModifier)
const VOLUME_THRESHOLDS = {
  VERY_HIGH: MULTIPLIERS.DOUBLE, // 2.0
  HIGH: MULTIPLIERS.ONE_AND_HALF, // 1.5
  NORMAL_MIN: MULTIPLIERS.ZERO_EIGHT, // 0.8
  NORMAL_MAX: MULTIPLIERS.HALF, // 0.5
} as const;

// Decimal places for display
const TOFIXED_DECIMAL = INTEGER_MULTIPLIERS.THREE;

// Bollinger Bands thresholds for weight calculation (used in getBollingerModifier)
const BOLLINGER_THRESHOLDS = {
  LOWER_VERY_CLOSE: THRESHOLD_VALUES.FIFTEEN_PERCENT,
  LOWER_SOMEWHAT_CLOSE: THRESHOLD_VALUES.THIRTY_PERCENT,
  UPPER_SOMEWHAT_CLOSE: THRESHOLD_VALUES.SEVENTY_PERCENT,
  UPPER_VERY_CLOSE: THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT,
} as const;

// Bollinger Bands modifiers (confidence multipliers)
const BOLLINGER_MODIFIERS = {
  VERY_CLOSE: MULTIPLIERS.ONE_TWO, // 1.20
  SOMEWHAT_CLOSE: MULTIPLIERS.ONE_ONE, // 1.10
  BAD_POSITION: MULTIPLIERS.ZERO_NINE, // 0.95
  SQUEEZE_BONUS: THRESHOLD_VALUES.TEN_PERCENT,
} as const;

// Stochastic thresholds for weight calculation (used in getStochasticModifier)
const STOCHASTIC_THRESHOLDS = {
  OVERSOLD: PERCENTAGE_THRESHOLDS.LOW_MODERATE, // 20
  OVERBOUGHT: PERCENTAGE_THRESHOLDS.EXTREME, // 80
  RSI_OVERSOLD: PERCENTAGE_THRESHOLDS.MODERATE, // 30
  RSI_OVERBOUGHT: PERCENTAGE_THRESHOLDS.VERY_HIGH, // 70
} as const;

// Stochastic modifiers (confidence multipliers)
const STOCHASTIC_MODIFIERS = {
  DOUBLE_CONFIRMATION: MULTIPLIERS.ONE_ONE_FIVE, // 1.15
  SINGLE_SIGNAL: MULTIPLIERS.ONE_ZERO_FIVE, // 1.05
  BAD_SIGNAL: MULTIPLIERS.ZERO_NINE, // 0.95
} as const;

// ============================================================================
// WEIGHT CALCULATOR
// ============================================================================

export class WeightCalculator {
  constructor(
    private config: WeightSystemConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Calculate RSI-based confidence modifier
   * @param rsi - Current RSI value (0-100)
   * @param direction - Signal direction (LONG/SHORT)
   * @returns Multiplier for confidence (0.85 to 1.20)
   */
  getRSIModifier(rsi: number, direction: SignalDirection): number {
    if (!this.config.enabled || !this.config.rsiWeights.enabled) {
      return DEFAULT_MODIFIER_MULTIPLIER;
    }

    const cfg = this.config.rsiWeights;
    let modifier = DEFAULT_MODIFIER_MULTIPLIER;

    if (direction === SignalDirection.LONG) {
      // LONG: Favor oversold, penalize overbought
      if (rsi < RSI_THRESHOLDS.EXTREME_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.extremeBonus; // +20% extreme oversold (< 20)
      } else if (rsi <= RSI_THRESHOLDS.STRONG_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.strongBonus; // +15% oversold (20-30)
      } else if (rsi <= RSI_THRESHOLDS.MODERATE_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.moderateBonus; // +10% moderate oversold (30-40)
      } else if (rsi >= cfg.neutralZoneMin && rsi <= cfg.neutralZoneMax) {
        modifier = MULTIPLIERS.NEUTRAL; // No modifier in neutral zone (40-60)
      } else if (rsi > RSI_THRESHOLDS.SLIGHT_OVERBOUGHT && rsi <= RSI_THRESHOLDS.MODERATE_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.slightPenalty; // -5% slightly overbought (60-70)
      } else if (rsi > RSI_THRESHOLDS.MODERATE_OVERBOUGHT && rsi <= RSI_THRESHOLDS.EXTREME_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.moderatePenalty; // -10% overbought (70-80)
      } else if (rsi > RSI_THRESHOLDS.EXTREME_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.strongPenalty; // -15% very overbought (> 80)
      }
    } else {
      // SHORT: Favor overbought, penalize oversold
      if (rsi > RSI_THRESHOLDS.EXTREME_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.extremeBonus; // +20% extreme overbought (> 80)
      } else if (rsi >= RSI_THRESHOLDS.MODERATE_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.strongBonus; // +15% overbought (70-80)
      } else if (rsi >= RSI_THRESHOLDS.SLIGHT_OVERBOUGHT) {
        modifier = MULTIPLIERS.NEUTRAL + cfg.moderateBonus; // +10% moderate overbought (60-70)
      } else if (rsi >= cfg.neutralZoneMin && rsi <= cfg.neutralZoneMax) {
        modifier = MULTIPLIERS.NEUTRAL; // No modifier in neutral zone (40-60)
      } else if (rsi < RSI_THRESHOLDS.MODERATE_OVERSOLD && rsi >= RSI_THRESHOLDS.STRONG_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.slightPenalty; // -5% slightly oversold (30-40)
      } else if (rsi < RSI_THRESHOLDS.STRONG_OVERSOLD && rsi >= RSI_THRESHOLDS.EXTREME_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.moderatePenalty; // -10% oversold (20-30)
      } else if (rsi < RSI_THRESHOLDS.EXTREME_OVERSOLD) {
        modifier = MULTIPLIERS.NEUTRAL - cfg.strongPenalty; // -15% very oversold (< 20)
      }
    }

    this.logger.debug('RSI modifier calculated', {
      rsi: rsi.toFixed(DECIMAL_PLACES.PERCENT),
      direction,
      modifier: modifier.toFixed(TOFIXED_DECIMAL),
    });

    return modifier;
  }

  /**
   * Calculate volume-based confidence modifier
   * @param volumeRatio - Current volume / avg volume (e.g., 1.5 = 150%)
   * @returns Multiplier for confidence (0.90 to 1.10)
   */
  getVolumeModifier(volumeRatio: number): number {
    if (!this.config.enabled || !this.config.volumeWeights.enabled) {
      return MULTIPLIERS.NEUTRAL;
    }

    const cfg = this.config.volumeWeights;
    let modifier = MULTIPLIERS.NEUTRAL;

    if (volumeRatio > VOLUME_THRESHOLDS.VERY_HIGH) {
      modifier = MULTIPLIERS.NEUTRAL + cfg.veryHighBonus; // +10% very high volume
    } else if (volumeRatio >= VOLUME_THRESHOLDS.HIGH) {
      modifier = MULTIPLIERS.NEUTRAL + cfg.highBonus; // +5% high volume
    } else if (volumeRatio >= VOLUME_THRESHOLDS.NORMAL_MIN) {
      modifier = MULTIPLIERS.NEUTRAL; // Normal volume (no modifier)
    } else if (volumeRatio >= VOLUME_THRESHOLDS.NORMAL_MAX) {
      modifier = MULTIPLIERS.NEUTRAL - cfg.lowPenalty; // -5% low volume
    } else {
      modifier = MULTIPLIERS.NEUTRAL - cfg.veryLowPenalty; // -10% very low volume
    }

    this.logger.debug('Volume modifier calculated', {
      volumeRatio: volumeRatio.toFixed(DECIMAL_PLACES.PERCENT),
      modifier: modifier.toFixed(TOFIXED_DECIMAL),
    });

    return modifier;
  }

  /**
   * Calculate level strength-based confidence modifier
   * @param touches - Number of touches on the level
   * @returns Multiplier for confidence (1.00 to 1.40)
   */
  getLevelStrengthModifier(touches: number): number {
    if (!this.config.enabled || !this.config.levelStrengthWeights.enabled) {
      return MULTIPLIERS.NEUTRAL;
    }

    const cfg = this.config.levelStrengthWeights;
    let modifier = MULTIPLIERS.NEUTRAL;

    if (touches >= cfg.minTouchesForStrong) {
      modifier = MULTIPLIERS.NEUTRAL + cfg.strongLevelBonus; // +40% strong level (3+ touches)
    } else if (touches >= cfg.minTouchesForMedium) {
      modifier = MULTIPLIERS.NEUTRAL + cfg.mediumLevelBonus; // +20% medium level (2 touches)
    }
    // touches === 1: no modifier (weak level)

    this.logger.debug('Level strength modifier calculated', {
      touches,
      modifier: modifier.toFixed(TOFIXED_DECIMAL),
    });

    return modifier;
  }

  /**
   * Calculate Bollinger Bands-based confidence modifier (BB.MD)
   * @param percentB - Price position in BB (0.0 - 1.0)
   * @param direction - Signal direction (LONG/SHORT)
   * @param isSqueeze - Is BB squeeze detected
   * @returns Multiplier for confidence (0.90 to 1.30 + squeeze bonus)
   */
  getBollingerModifier(percentB: number, direction: SignalDirection, isSqueeze: boolean): number {
    if (!this.config.enabled) {
      return MULTIPLIERS.NEUTRAL;
    }

    let modifier: number = MULTIPLIERS.NEUTRAL;

    if (direction === SignalDirection.LONG) {
      // LONG: Price near lower band = good entry (BB.MD Section 2.3)
      if (percentB <= BOLLINGER_THRESHOLDS.LOWER_VERY_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.VERY_CLOSE; // +20% very close to lower band
      } else if (percentB <= BOLLINGER_THRESHOLDS.LOWER_SOMEWHAT_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.SOMEWHAT_CLOSE; // +10% somewhat close to lower band
      } else if (percentB > BOLLINGER_THRESHOLDS.UPPER_SOMEWHAT_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.BAD_POSITION; // -5% price near upper band (bad for LONG)
      }
    } else {
      // SHORT: Price near upper band = good entry
      if (percentB >= BOLLINGER_THRESHOLDS.UPPER_VERY_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.VERY_CLOSE; // +20% very close to upper band
      } else if (percentB >= BOLLINGER_THRESHOLDS.UPPER_SOMEWHAT_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.SOMEWHAT_CLOSE; // +10% somewhat close to upper band
      } else if (percentB < BOLLINGER_THRESHOLDS.LOWER_SOMEWHAT_CLOSE) {
        modifier = BOLLINGER_MODIFIERS.BAD_POSITION; // -5% price near lower band (bad for SHORT)
      }
    }

    // BB Squeeze bonus (BB.MD Section 2.3)
    if (isSqueeze) {
      modifier += BOLLINGER_MODIFIERS.SQUEEZE_BONUS; // +10% additional bonus for squeeze (potential breakout)
    }

    this.logger.debug('Bollinger modifier calculated', {
      percentB: percentB.toFixed(DECIMAL_PLACES.PERCENT),
      direction,
      isSqueeze,
      modifier: modifier.toFixed(TOFIXED_DECIMAL),
    });

    return modifier;
  }

  /**
   * Calculate Stochastic-based confidence modifier with RSI confirmation (BB.MD)
   * @param stochK - Stochastic %K value (0-100)
   * @param rsi - RSI value for confirmation (0-100)
   * @param direction - Signal direction (LONG/SHORT)
   * @returns Multiplier for confidence (0.95 to 1.15)
   */
  getStochasticModifier(stochK: number, rsi: number, direction: SignalDirection): number {
    if (!this.config.enabled) {
      return MULTIPLIERS.NEUTRAL;
    }

    let modifier: number = MULTIPLIERS.NEUTRAL;

    if (direction === SignalDirection.LONG) {
      // LONG: Favor oversold Stochastic
      const isStochOversold = stochK < STOCHASTIC_THRESHOLDS.OVERSOLD;
      const isRSIOversold = rsi < STOCHASTIC_THRESHOLDS.RSI_OVERSOLD;

      if (isStochOversold && isRSIOversold) {
        // Double confirmation (BB.MD Section 2.3)
        modifier = STOCHASTIC_MODIFIERS.DOUBLE_CONFIRMATION; // +15% both oversold
      } else if (isStochOversold) {
        modifier = STOCHASTIC_MODIFIERS.SINGLE_SIGNAL; // +5% only Stochastic oversold
      } else if (stochK > STOCHASTIC_THRESHOLDS.OVERBOUGHT) {
        modifier = STOCHASTIC_MODIFIERS.BAD_SIGNAL; // -5% Stochastic overbought (bad for LONG)
      }
    } else {
      // SHORT: Favor overbought Stochastic
      const isStochOverbought = stochK > STOCHASTIC_THRESHOLDS.OVERBOUGHT;
      const isRSIOverbought = rsi > STOCHASTIC_THRESHOLDS.RSI_OVERBOUGHT;

      if (isStochOverbought && isRSIOverbought) {
        // Double confirmation (BB.MD Section 2.3)
        modifier = STOCHASTIC_MODIFIERS.DOUBLE_CONFIRMATION; // +15% both overbought
      } else if (isStochOverbought) {
        modifier = STOCHASTIC_MODIFIERS.SINGLE_SIGNAL; // +5% only Stochastic overbought
      } else if (stochK < STOCHASTIC_THRESHOLDS.OVERSOLD) {
        modifier = STOCHASTIC_MODIFIERS.BAD_SIGNAL; // -5% Stochastic oversold (bad for SHORT)
      }
    }

    this.logger.debug('Stochastic modifier calculated', {
      stochK: stochK.toFixed(DECIMAL_PLACES.PERCENT),
      rsi: rsi.toFixed(DECIMAL_PLACES.PERCENT),
      direction,
      modifier: modifier.toFixed(TOFIXED_DECIMAL),
    });

    return modifier;
  }

  /**
   * Apply all weight modifiers to confidence
   * @param baseConfidence - Original confidence from strategy
   * @param params - Market parameters
   * @returns Adjusted confidence with all modifiers applied
   */
  applyWeights(
    baseConfidence: number,
    params: {
      rsi?: number;
      direction?: SignalDirection;
      volumeRatio?: number;
      levelTouches?: number;
      bollingerBands?: {
        percentB: number;
        isSqueeze: boolean;
      };
      stochastic?: {
        k: number;
      };
    },
  ): number {
    if (!this.config.enabled) {
      this.logger.debug('Weight system disabled, returning base confidence', {
        baseConfidence: baseConfidence.toFixed(TOFIXED_DECIMAL),
      });
      return baseConfidence;
    }

    let confidence = baseConfidence;
    const modifiers: string[] = [];

    // Apply RSI modifier
    if (params.rsi !== undefined && params.direction !== undefined) {
      const rsiMod = this.getRSIModifier(params.rsi, params.direction);
      confidence *= rsiMod;
      modifiers.push(`RSI×${rsiMod.toFixed(TOFIXED_DECIMAL)}`);
    }

    // Apply volume modifier
    if (params.volumeRatio !== undefined) {
      const volMod = this.getVolumeModifier(params.volumeRatio);
      confidence *= volMod;
      modifiers.push(`Vol×${volMod.toFixed(TOFIXED_DECIMAL)}`);
    }

    // Apply level strength modifier
    if (params.levelTouches !== undefined) {
      const levelMod = this.getLevelStrengthModifier(params.levelTouches);
      confidence *= levelMod;
      modifiers.push(`Level×${levelMod.toFixed(TOFIXED_DECIMAL)}`);
    }

    // Apply Bollinger Bands modifier (BB.MD)
    if (params.bollingerBands !== undefined && params.direction !== undefined) {
      const bbMod = this.getBollingerModifier(
        params.bollingerBands.percentB,
        params.direction,
        params.bollingerBands.isSqueeze,
      );
      confidence *= bbMod;
      modifiers.push(`BB×${bbMod.toFixed(TOFIXED_DECIMAL)}`);
    }

    // Apply Stochastic modifier with RSI confirmation (BB.MD)
    if (
      params.stochastic !== undefined &&
      params.rsi !== undefined &&
      params.direction !== undefined
    ) {
      const stochMod = this.getStochasticModifier(params.stochastic.k, params.rsi, params.direction);
      confidence *= stochMod;
      modifiers.push(`Stoch×${stochMod.toFixed(TOFIXED_DECIMAL)}`);
    }

    // Clamp confidence to valid range [0.1, 1.0]
    confidence = Math.max(THRESHOLD_VALUES.TEN_PERCENT, Math.min(RATIO_MULTIPLIERS.FULL, confidence));

    this.logger.info('⚖️ Weight system applied', {
      baseConfidence: baseConfidence.toFixed(TOFIXED_DECIMAL),
      finalConfidence: confidence.toFixed(TOFIXED_DECIMAL),
      modifiers: modifiers.join(', '),
      change: `${((confidence - baseConfidence) * PERCENT_TO_DECIMAL).toFixed(RATIO_MULTIPLIERS.FULL)}%`,
    });

    return confidence;
  }
}
