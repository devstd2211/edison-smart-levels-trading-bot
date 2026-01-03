import { CONFIDENCE_THRESHOLDS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS } from '../constants';
/**
 * Flat Market Detector
 *
 * Multi-factor system to detect ranging/neutral markets with high confidence.
 * Used to switch between single-TP (flat) and multi-TP (trending) strategies.
 *
 * Detection uses 6 weighted factors:
 * - EMA Distance (20 points): Tight EMA convergence indicates flat
 * - ATR Volatility (20 points): Low volatility indicates consolidation
 * - Price Range (15 points): Narrow price range indicates range-bound
 * - ZigZag Pattern (20 points): Equal highs/lows indicate flat structure
 * - EMA Slope (15 points): Flat EMA slope indicates no directional bias
 * - Volume Distribution (10 points): Even volume indicates no directional flow
 *
 * Total confidence score: 0-100 points
 * - 80-100: High confidence FLAT → use single TP @ 0.5%
 * - 50-79: Uncertain → cautious multi-TP
 * - 0-49: Confident TREND → full multi-TP
 */

import {
  Candle,
  TradingContext,
  MarketStructure,
  FlatMarketConfig,
  FlatMarketResult,
  FlatMarketFactors,
  LoggerService,
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

// These are now in config, with defaults shown here
// const MAX_EMA_SCORE = 20; // From config.analysisConfig.flatMarketDetector.maxEmaScore
// const MAX_ATR_SCORE = 20; // From config.analysisConfig.flatMarketDetector.maxAtrScore
// const MAX_RANGE_SCORE = 15; // From config.analysisConfig.flatMarketDetector.maxRangeScore
// const MAX_ZIGZAG_SCORE = 20; // From config.analysisConfig.flatMarketDetector (assumed 20)
// const MAX_SLOPE_SCORE = 15; // From config.analysisConfig.flatMarketDetector.maxSlopeScore
// const MAX_VOLUME_SCORE = 10; // From config.analysisConfig.flatMarketDetector.maxVolumeScore

const DEFAULT_RANGE_PERIOD = PERCENTAGE_THRESHOLDS.LOW_MODERATE; // Candles to analyze for price range
const DEGREES_TO_RADIANS = Math.PI / 180; // Conversion factor

// ============================================================================
// FLAT MARKET DETECTOR
// ============================================================================

export class FlatMarketDetector {
  private readonly maxEmaScore: number;
  private readonly maxAtrScore: number;
  private readonly maxRangeScore: number;
  private readonly maxZigzagScore: number = 20; // Default, from config (assumed same as default)
  private readonly maxSlopeScore: number;
  private readonly maxVolumeScore: number;

  constructor(
    private readonly config: FlatMarketConfig,
    private readonly logger: LoggerService,
  ) {
    // Initialize max scores from config with defaults
    this.maxEmaScore = this.config.maxEmaScore ?? PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    this.maxAtrScore = this.config.maxAtrScore ?? PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    this.maxRangeScore = this.config.maxRangeScore ?? 15;
    this.maxSlopeScore = this.config.maxSlopeScore ?? 15;
    this.maxVolumeScore = this.config.maxVolumeScore ?? 10;
  }

  /**
   * Detect if market is in flat/ranging state
   * @param candles - Candles array (min 20 for range analysis)
   * @param context - Trading context (from ContextAnalyzer)
   * @param ema20 - EMA20 value
   * @param ema50 - EMA50 value (from context)
   * @returns Flat market result with confidence score
   */
  detect(
    candles: Candle[],
    context: TradingContext,
    ema20: number,
    ema50: number,
  ): FlatMarketResult {
    // Validate inputs
    if (candles.length < DEFAULT_RANGE_PERIOD) {
      this.logger.warn('Insufficient candles for flat market detection', {
        required: DEFAULT_RANGE_PERIOD,
        received: candles.length,
      });
      return this.noDetection('Insufficient data');
    }

    // 1. EMA Distance (20 points)
    const emaScore = this.checkEMADistance(ema20, ema50);

    // 2. ATR Volatility (20 points)
    const atrScore = this.checkATRVolatility(context.atrPercent);

    // 3. Price Range (15 points)
    const rangeScore = this.checkPriceRange(candles, DEFAULT_RANGE_PERIOD);

    // 4. ZigZag Pattern (20 points)
    const zigzagScore = this.checkZigZagPattern(context.marketStructure);

    // 5. EMA Slope (15 points)
    const slopeScore = this.checkEMASlope(candles);

    // 6. Volume Distribution (10 points)
    const volumeScore = this.checkVolumeDistribution(candles);

    // Calculate total confidence
    const confidence = emaScore + atrScore + rangeScore + zigzagScore + slopeScore + volumeScore;

    // Decision: threshold or above = FLAT
    const isFlat = confidence >= this.config.flatThreshold;

    // Build explanation for logs
    const factors: FlatMarketFactors = {
      emaDistance: emaScore,
      atrVolatility: atrScore,
      priceRange: rangeScore,
      zigzagPattern: zigzagScore,
      emaSlope: slopeScore,
      volumeDistribution: volumeScore,
    };

    const explanation = this.buildExplanation(factors);

    this.logger.info(isFlat ? '⚡ FLAT market detected' : '📈 TRENDING market', {
      confidence: confidence.toFixed(1) + '%',
      threshold: this.config.flatThreshold + '%',
      decision: isFlat ? 'FLAT' : 'TREND',
    });

    this.logger.debug('Flat market factors breakdown', factors as unknown as Record<string, unknown>);

    return {
      isFlat,
      confidence,
      factors,
      explanation,
    };
  }

  // ==========================================================================
  // PRIVATE FACTOR CHECKS
  // ==========================================================================

  /**
   * Check EMA distance (convergence)
   * Tight EMA convergence (EMA20 ≈ EMA50) indicates flat market
   * @param ema20 - EMA20 value
   * @param ema50 - EMA50 value
   * @returns Score 0-20 points
   */
  private checkEMADistance(ema20: number, ema50: number): number {
    // Calculate distance as percentage
    const distance = Math.abs(ema20 - ema50) / ema50;
    const distancePercent = distance * PERCENT_MULTIPLIER;

    // Score: maxEmaScore points if distance <= threshold, linear decrease to 0
    // Example: threshold 0.3%, distance 0.1% → 20 pts, distance 0.6% → 0 pts
    if (distancePercent <= this.config.emaThreshold) {
      return this.maxEmaScore; // Perfect convergence
    }

    // Linear decrease: maxEmaScore * (1 - excess / threshold)
    const excess = distancePercent - this.config.emaThreshold;
    const score = this.maxEmaScore * Math.max(0, 1 - excess / this.config.emaThreshold);

    return Math.round(score);
  }

  /**
   * Check ATR volatility (low volatility = flat)
   * Low ATR relative to price indicates consolidation
   * @param atrPercent - ATR as percentage of price (from TradingContext)
   * @returns Score 0-20 points
   */
  private checkATRVolatility(atrPercent: number): number {
    // Score: maxAtrScore points if ATR <= threshold, linear decrease to 0
    // Example: threshold 1.5%, ATR 1.0% → 20 pts, ATR 3.0% → 0 pts
    if (atrPercent <= this.config.atrThreshold) {
      return this.maxAtrScore; // Very low volatility
    }

    const excess = atrPercent - this.config.atrThreshold;
    const score = this.maxAtrScore * Math.max(0, 1 - excess / this.config.atrThreshold);

    return Math.round(score);
  }

  /**
   * Check price range (narrow range = flat)
   * Narrow high-low range over period indicates range-bound market
   * @param candles - Candles array
   * @param period - Number of candles to analyze
   * @returns Score 0-15 points
   */
  private checkPriceRange(candles: Candle[], period: number): number {
    // Get last N candles
    const recentCandles = candles.slice(-period);
    if (recentCandles.length < period) {
      return 0; // Insufficient data
    }

    // Find highest high and lowest low
    const high = Math.max(...recentCandles.map((c) => c.high));
    const low = Math.min(...recentCandles.map((c) => c.low));
    const close = recentCandles[recentCandles.length - 1].close;

    // Calculate range as percentage of close
    const rangePercent = ((high - low) / close) * PERCENT_MULTIPLIER;

    // Score: maxRangeScore points if range <= threshold, linear decrease to 0
    // Example: threshold 1.0%, range 0.5% → 15 pts, range 2.0% → 0 pts
    if (rangePercent <= this.config.rangeThreshold) {
      return this.maxRangeScore; // Very tight range
    }

    const excess = rangePercent - this.config.rangeThreshold;
    const score = this.maxRangeScore * Math.max(0, 1 - excess / this.config.rangeThreshold);

    return Math.round(score);
  }

  /**
   * Check ZigZag pattern (Equal Highs/Lows = flat)
   * EH (Equal High) or EL (Equal Low) patterns indicate flat structure
   * @param marketStructure - Market structure from TradingContext
   * @returns Score 0-20 points
   */
  private checkZigZagPattern(marketStructure: MarketStructure | null): number {
    if (marketStructure == null) {
      return 0; // No ZigZag data
    }

    // Check for flat patterns (EH or EL)
    if (marketStructure === MarketStructure.EQUAL_HIGH || marketStructure === MarketStructure.EQUAL_LOW) {
      return this.maxZigzagScore; // Confirmed flat structure
    }

    // Check for weak trend patterns (might be forming flat)
    // Give partial credit if not strong trend
    const strongTrendPatterns = [
      MarketStructure.HIGHER_HIGH,
      MarketStructure.HIGHER_LOW,
      MarketStructure.LOWER_LOW,
      MarketStructure.LOWER_HIGH,
    ];
    if (!strongTrendPatterns.includes(marketStructure)) {
      return Math.round(this.maxZigzagScore * 0.3); // Partial credit
    }

    return 0; // Strong trend pattern, not flat
  }

  /**
   * Check EMA slope (flat slope = no directional bias)
   * Flat EMA50 slope indicates no clear direction
   * @param candles - Candles array
   * @returns Score 0-15 points
   */
  private checkEMASlope(candles: Candle[]): number {
    const recentCandles = candles.slice(-10); // Last 10 candles for slope
    if (recentCandles.length < 10) {
      return 0; // Insufficient data
    }

    // Simple linear regression for EMA50 slope
    // Use close prices as proxy for EMA50 direction
    const prices = recentCandles.map((c) => c.close);
    const n = prices.length;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
    }

    // Calculate slope (rise/run)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Convert slope to angle in degrees
    const angle = Math.atan(Math.abs(slope) * n) / DEGREES_TO_RADIANS;

    // Score: maxSlopeScore points if angle <= threshold, linear decrease to 0
    // Example: threshold 5°, angle 2° → 15 pts, angle 10° → 0 pts
    if (angle <= this.config.slopeThreshold) {
      return this.maxSlopeScore; // Flat slope
    }

    const excess = angle - this.config.slopeThreshold;
    const score = this.maxSlopeScore * Math.max(0, 1 - excess / this.config.slopeThreshold);

    return Math.round(score);
  }

  /**
   * Check volume distribution (even volume = no directional flow)
   * Even buy/sell volume distribution indicates no directional bias
   * @param candles - Candles array
   * @returns Score 0-10 points
   */
  private checkVolumeDistribution(candles: Candle[]): number {
    const recentCandles = candles.slice(-DEFAULT_RANGE_PERIOD);
    if (recentCandles.length < DEFAULT_RANGE_PERIOD) {
      return 0; // Insufficient data
    }

    // Calculate bullish vs bearish volume
    let bullishVolume = 0;
    let bearishVolume = 0;

    for (const candle of recentCandles) {
      if (candle.close > candle.open) {
        bullishVolume += candle.volume;
      } else {
        bearishVolume += candle.volume;
      }
    }

    const totalVolume = bullishVolume + bearishVolume;
    if (totalVolume === 0) {
      return 0; // No volume data
    }

    // Calculate ratio (closer to 1.0 = more even distribution)
    const ratio = Math.min(bullishVolume, bearishVolume) / Math.max(bullishVolume, bearishVolume);

    // Score: maxVolumeScore points if ratio >= CONFIDENCE_THRESHOLDS.MODERATE (fairly even), linear decrease
    // Example: ratio 0.9 → 10 pts, ratio 0.5 → 5 pts, ratio 0.0 → 0 pts
    const score = this.maxVolumeScore * ratio;

    return Math.round(score);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Build human-readable explanation of detection factors
   * @param factors - Individual factor scores
   * @returns Explanation string for logs
   */
  private buildExplanation(factors: FlatMarketFactors): string {
    const lines: string[] = [];

    lines.push(`EMA Distance: ${factors.emaDistance}/${this.maxEmaScore}`);
    lines.push(`ATR Volatility: ${factors.atrVolatility}/${this.maxAtrScore}`);
    lines.push(`Price Range: ${factors.priceRange}/${this.maxRangeScore}`);
    lines.push(`ZigZag Pattern: ${factors.zigzagPattern}/${this.maxZigzagScore}`);
    lines.push(`EMA Slope: ${factors.emaSlope}/${this.maxSlopeScore}`);
    lines.push(`Volume: ${factors.volumeDistribution}/${this.maxVolumeScore}`);

    return lines.join(', ');
  }

  /**
   * Return default "no detection" result
   * Used when insufficient data or errors occur
   * @param reason - Reason for no detection
   * @returns FlatMarketResult with confidence 0
   */
  private noDetection(reason: string): FlatMarketResult {
    return {
      isFlat: false,
      confidence: 0,
      factors: {
        emaDistance: 0,
        atrVolatility: 0,
        priceRange: 0,
        zigzagPattern: 0,
        emaSlope: 0,
        volumeDistribution: 0,
      },
      explanation: `No detection: ${reason}`,
    };
  }
}
