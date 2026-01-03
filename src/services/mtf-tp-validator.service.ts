/**
 * MTF TP Validator Service
 *
 * Validates Take Profit levels against Higher Timeframe (HTF) structure:
 * - TREND1 (15m) - Primary HTF validation
 * - TREND2 (30m) - Secondary HTF validation
 * - CONTEXT (1h) - Trend-based TP scaling
 *
 * Purpose:
 * - Confirm TP aligns with HTF support/resistance
 * - Scale TP based on multi-timeframe confirmation
 * - Prevent TPs that conflict with HTF structure
 */

import {
  LoggerService,
  Candle,
  SignalDirection,
  SwingPoint,
  ZigZagNRIndicator,
} from '../types';
import { Level, LevelAnalyzer } from '../analyzers/level.analyzer';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface MTFTPConfig {
  enabled: boolean;

  // HTF (15m) TP validation
  htfTPValidation: {
    enabled: boolean;
    alignmentThresholdPercent: number; // Max distance to consider aligned (default: 0.3%)
    confidenceBoostPercent: number; // Boost when aligned (default: 10)
  };

  // TREND2 (30m) TP validation (extra layer)
  trend2TPValidation?: {
    enabled: boolean;
    alignmentThresholdPercent: number; // default: 0.4%
    confidenceBoostPercent: number; // default: 5
  };

  // Context (1h) - TP scaling based on trend
  contextTPAdjustment?: {
    enabled: boolean;
    minEmaGapPercent: number; // Min gap to consider trend (default: 0.5%)
    // In aligned trend: expand TP
    alignedScaleFactor: number; // default: 1.15 (+15%)
    // Against trend: contract TP
    opposedScaleFactor: number; // default: 0.85 (-15%)
  };

  // Scaling based on confirmation count
  scaling: {
    noConfirm: number; // No HTF confirms TP (default: 0.9)
    htfConfirmed: number; // HTF (15m) confirms (default: 1.0)
    bothConfirmed: number; // Both 15m+30m confirm (default: 1.1)
  };
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface MTFTPValidationResult {
  // HTF (15m) validation
  htfTPAligned: boolean;
  htfTPLevel?: Level;
  htfDistance?: number;

  // TREND2 (30m) validation
  trend2TPAligned: boolean;
  trend2TPLevel?: Level;
  trend2Distance?: number;

  // Context (1h) trend
  contextTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  contextScaleFactor: number;

  // Combined results
  confidenceBoostPercent: number; // 0-20
  scalingFactor: number; // 0.8-1.2
  recommendation: 'EXPAND' | 'CONTRACT' | 'NEUTRAL';
  reason: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MTFTPConfig = {
  enabled: true,
  htfTPValidation: {
    enabled: true,
    alignmentThresholdPercent: 0.3,
    confidenceBoostPercent: 10,
  },
  trend2TPValidation: {
    enabled: true,
    alignmentThresholdPercent: 0.4,
    confidenceBoostPercent: 5,
  },
  contextTPAdjustment: {
    enabled: true,
    minEmaGapPercent: 0.5,
    alignedScaleFactor: 1.15,
    opposedScaleFactor: 0.85,
  },
  scaling: {
    noConfirm: 0.9,
    htfConfirmed: 1.0,
    bothConfirmed: 1.1,
  },
};

// ============================================================================
// MTF TP VALIDATOR SERVICE
// ============================================================================

export class MTFTPValidatorService {
  private config: MTFTPConfig;
  private zigzag: ZigZagNRIndicator;

  constructor(
    private logger: LoggerService,
    private levelAnalyzer: LevelAnalyzer,
    config?: Partial<MTFTPConfig>,
  ) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    this.zigzag = new ZigZagNRIndicator(2); // depth=2 for HTF
  }

  /**
   * Deep merge configuration
   */
  private mergeConfig(defaults: MTFTPConfig, overrides?: Partial<MTFTPConfig>): MTFTPConfig {
    if (!overrides) return defaults;

    return {
      enabled: overrides.enabled ?? defaults.enabled,
      htfTPValidation: { ...defaults.htfTPValidation, ...overrides.htfTPValidation },
      trend2TPValidation: overrides.trend2TPValidation
        ? { ...defaults.trend2TPValidation, ...overrides.trend2TPValidation }
        : defaults.trend2TPValidation,
      contextTPAdjustment: overrides.contextTPAdjustment
        ? { ...defaults.contextTPAdjustment, ...overrides.contextTPAdjustment }
        : defaults.contextTPAdjustment,
      scaling: { ...defaults.scaling, ...overrides.scaling },
    };
  }

  /**
   * Validate TP against HTF levels
   *
   * @param tp1Price - TP1 price from PRIMARY timeframe
   * @param entryPrice - Entry price
   * @param direction - Trade direction
   * @param htfCandles - TREND1 (15m) candles
   * @param trend2Candles - TREND2 (30m) candles (optional)
   * @param contextEMA - CONTEXT (1h) EMA values (optional)
   * @param timestamp - Current timestamp
   */
  validateTP(
    tp1Price: number,
    entryPrice: number,
    direction: SignalDirection,
    htfCandles?: Candle[],
    trend2Candles?: Candle[],
    contextEMA?: { fast: number; slow: number },
    timestamp: number = Date.now(),
  ): MTFTPValidationResult {
    if (!this.config.enabled) {
      return this.noValidation('MTF TP Validation disabled');
    }

    // Step 1: Validate against HTF (15m) levels
    let htfResult: { aligned: boolean; level?: Level; distance: number } = {
      aligned: false,
      level: undefined,
      distance: Infinity,
    };
    if (this.config.htfTPValidation.enabled && htfCandles && htfCandles.length >= 20) {
      htfResult = this.validateAgainstTimeframe(
        tp1Price,
        entryPrice,
        direction,
        htfCandles,
        this.config.htfTPValidation.alignmentThresholdPercent,
        timestamp,
        'HTF (15m)',
      );
    }

    // Step 2: Validate against TREND2 (30m) levels
    let trend2Result: { aligned: boolean; level?: Level; distance: number } = {
      aligned: false,
      level: undefined,
      distance: Infinity,
    };
    if (
      this.config.trend2TPValidation?.enabled &&
      trend2Candles &&
      trend2Candles.length >= 20
    ) {
      trend2Result = this.validateAgainstTimeframe(
        tp1Price,
        entryPrice,
        direction,
        trend2Candles,
        this.config.trend2TPValidation.alignmentThresholdPercent,
        timestamp,
        'TREND2 (30m)',
      );
    }

    // Step 3: Calculate context trend and scaling
    let contextTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let contextScaleFactor = 1.0;

    if (this.config.contextTPAdjustment?.enabled && contextEMA) {
      const gapPercent =
        (Math.abs(contextEMA.fast - contextEMA.slow) / contextEMA.slow) * PERCENT_MULTIPLIER;

      if (gapPercent >= this.config.contextTPAdjustment.minEmaGapPercent) {
        contextTrend = contextEMA.fast > contextEMA.slow ? 'BULLISH' : 'BEARISH';

        // Check if direction aligns with context trend
        const isAligned =
          (direction === SignalDirection.LONG && contextTrend === 'BULLISH') ||
          (direction === SignalDirection.SHORT && contextTrend === 'BEARISH');

        contextScaleFactor = isAligned
          ? this.config.contextTPAdjustment.alignedScaleFactor
          : this.config.contextTPAdjustment.opposedScaleFactor;
      }
    }

    // Step 4: Calculate confirmation scaling
    const confirmCount = (htfResult.aligned ? 1 : 0) + (trend2Result.aligned ? 1 : 0);
    let confirmScaleFactor: number;

    switch (confirmCount) {
      case 0:
        confirmScaleFactor = this.config.scaling.noConfirm;
        break;
      case 1:
        confirmScaleFactor = this.config.scaling.htfConfirmed;
        break;
      case 2:
        confirmScaleFactor = this.config.scaling.bothConfirmed;
        break;
      default:
        confirmScaleFactor = 1.0;
    }

    // Step 5: Combine scaling factors
    const finalScaleFactor = contextScaleFactor * confirmScaleFactor;

    // Step 6: Calculate confidence boost
    let confidenceBoostPercent = 0;
    if (htfResult.aligned) {
      confidenceBoostPercent += this.config.htfTPValidation.confidenceBoostPercent;
    }
    if (trend2Result.aligned && this.config.trend2TPValidation) {
      confidenceBoostPercent += this.config.trend2TPValidation.confidenceBoostPercent;
    }

    // Step 7: Determine recommendation
    const recommendation = this.getRecommendation(finalScaleFactor);

    // Build reason string
    const reasons: string[] = [];
    if (htfResult.aligned) reasons.push('HTF-aligned');
    if (trend2Result.aligned) reasons.push('TREND2-aligned');
    if (contextTrend !== 'NEUTRAL') {
      reasons.push(`1h-${contextTrend.toLowerCase()}`);
    }
    const reason = reasons.length > 0 ? reasons.join(', ') : 'No HTF confirmation';

    this.logger.info('📊 MTF TP Validation', {
      tp1Price: tp1Price.toFixed(DECIMAL_PLACES.PRICE),
      htfAligned: htfResult.aligned,
      trend2Aligned: trend2Result.aligned,
      contextTrend,
      scaleFactor: finalScaleFactor.toFixed(2),
      confidenceBoost: '+' + confidenceBoostPercent + '%',
      recommendation,
    });

    return {
      htfTPAligned: htfResult.aligned,
      htfTPLevel: htfResult.level,
      htfDistance: htfResult.distance,
      trend2TPAligned: trend2Result.aligned,
      trend2TPLevel: trend2Result.level,
      trend2Distance: trend2Result.distance,
      contextTrend,
      contextScaleFactor,
      confidenceBoostPercent,
      scalingFactor: finalScaleFactor,
      recommendation,
      reason,
    };
  }

  /**
   * Validate TP against a specific timeframe's levels
   */
  private validateAgainstTimeframe(
    tp1Price: number,
    entryPrice: number,
    direction: SignalDirection,
    candles: Candle[],
    thresholdPercent: number,
    timestamp: number,
    tfName: string,
  ): { aligned: boolean; level?: Level; distance: number } {
    // Build swing points
    const { swingHighs, swingLows } = this.zigzag.findSwingPoints(candles);

    if (swingHighs.length < 2 && swingLows.length < 2) {
      this.logger.debug(`${tfName}: Not enough swing points for level analysis`);
      return { aligned: false, distance: Infinity };
    }

    // Build levels using LevelAnalyzer
    const allSwings = [...swingHighs, ...swingLows];
    const levels = this.levelAnalyzer.getAllLevels(allSwings, candles, timestamp);

    // Select relevant levels based on direction
    // LONG: TP targets resistance (price goes UP to resistance)
    // SHORT: TP targets support (price goes DOWN to support)
    const relevantLevels =
      direction === SignalDirection.LONG ? levels.resistance : levels.support;

    if (relevantLevels.length === 0) {
      this.logger.debug(`${tfName}: No relevant ${direction === SignalDirection.LONG ? 'resistance' : 'support'} levels found`);
      return { aligned: false, distance: Infinity };
    }

    // Check if TP aligns with any level
    for (const level of relevantLevels) {
      const distance = (Math.abs(tp1Price - level.price) / level.price) * PERCENT_MULTIPLIER;

      if (distance <= thresholdPercent) {
        this.logger.debug(`✅ ${tfName} TP Aligned`, {
          tp1: tp1Price.toFixed(DECIMAL_PLACES.PRICE),
          level: level.price.toFixed(DECIMAL_PLACES.PRICE),
          distance: distance.toFixed(2) + '%',
          touches: level.touches,
          strength: level.strength.toFixed(2),
        });

        return { aligned: true, level, distance };
      }
    }

    // Find closest level for logging
    const closestLevel = relevantLevels.reduce((closest, level) => {
      const dist = Math.abs(tp1Price - level.price);
      const closestDist = Math.abs(tp1Price - closest.price);
      return dist < closestDist ? level : closest;
    });

    const closestDistance =
      (Math.abs(tp1Price - closestLevel.price) / closestLevel.price) * PERCENT_MULTIPLIER;

    this.logger.debug(`❌ ${tfName} TP Not Aligned`, {
      tp1: tp1Price.toFixed(DECIMAL_PLACES.PRICE),
      closestLevel: closestLevel.price.toFixed(DECIMAL_PLACES.PRICE),
      distance: closestDistance.toFixed(2) + '%',
      threshold: thresholdPercent + '%',
    });

    return { aligned: false, distance: closestDistance };
  }

  /**
   * Determine recommendation based on scaling factor
   */
  private getRecommendation(scaleFactor: number): 'EXPAND' | 'CONTRACT' | 'NEUTRAL' {
    if (scaleFactor >= 1.05) return 'EXPAND';
    if (scaleFactor <= 0.95) return 'CONTRACT';
    return 'NEUTRAL';
  }

  /**
   * Return no validation result
   */
  private noValidation(reason: string): MTFTPValidationResult {
    return {
      htfTPAligned: false,
      trend2TPAligned: false,
      contextTrend: 'NEUTRAL',
      contextScaleFactor: 1.0,
      confidenceBoostPercent: 0,
      scalingFactor: 1.0,
      recommendation: 'NEUTRAL',
      reason,
    };
  }

  /**
   * Apply scaling to TP percent
   */
  applyScaling(originalTPPercent: number, scalingFactor: number): number {
    return originalTPPercent * scalingFactor;
  }

  /**
   * Get current configuration
   */
  getConfig(): MTFTPConfig {
    return this.config;
  }
}
