import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer.interface';
import { AnalyzerType } from '../types/analyzer-type.enum';

const DEFAULT_MIN_CANDLES_FOR_LIQUIDITY_ZONE = 25;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_RECENT_WINDOW = 30;
const DEFAULT_ZONE_PERCENTAGE = 0.1;
const DEFAULT_MIN_CANDLES_FOR_ZONE = 2;
const DEFAULT_HIGH_LOW_BASELINE = 0.25;
const DEFAULT_HIGH_LOW_MULTIPLIER = 0.7;
const DEFAULT_BOTH_BASELINE = 0.15;
const DEFAULT_BOTH_MULTIPLIER = 0.6;

export class LiquidityZoneAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForLiquidityZone: number;
  private readonly maxConfidence: number;
  private readonly recentWindow: number;
  private readonly zonePercentage: number;
  private readonly minCandlesForZone: number;
  private readonly highLowBaseline: number;
  private readonly highLowMultiplier: number;
  private readonly bothBaseline: number;
  private readonly bothMultiplier: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew & {
    minCandlesForLiquidityZone?: number;
    maxConfidence?: number;
    recentWindow?: number;
    zonePercentage?: number;
    minCandlesForZone?: number;
    highLowBaseline?: number;
    highLowMultiplier?: number;
    bothBaseline?: number;
    bothMultiplier?: number;
  }, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[LIQUIDITY_ZONE] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[LIQUIDITY_ZONE] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[LIQUIDITY_ZONE] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForLiquidityZone = config.minCandlesForLiquidityZone ?? DEFAULT_MIN_CANDLES_FOR_LIQUIDITY_ZONE;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.recentWindow = config.recentWindow ?? DEFAULT_RECENT_WINDOW;
    this.zonePercentage = config.zonePercentage ?? DEFAULT_ZONE_PERCENTAGE;
    this.minCandlesForZone = config.minCandlesForZone ?? DEFAULT_MIN_CANDLES_FOR_ZONE;
    this.highLowBaseline = config.highLowBaseline ?? DEFAULT_HIGH_LOW_BASELINE;
    this.highLowMultiplier = config.highLowMultiplier ?? DEFAULT_HIGH_LOW_MULTIPLIER;
    this.bothBaseline = config.bothBaseline ?? DEFAULT_BOTH_BASELINE;
    this.bothMultiplier = config.bothMultiplier ?? DEFAULT_BOTH_MULTIPLIER;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[LIQUIDITY_ZONE] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[LIQUIDITY_ZONE] Invalid candles input');
    if (candles.length < this.minCandlesForLiquidityZone) throw new Error('[LIQUIDITY_ZONE] Not enough candles');

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') {
        throw new Error('[LIQUIDITY_ZONE] Invalid candle');
      }
    }

    const zone = this.detectZone(candles);

    // FIX #1: Properly handle HIGH vs LOW zones
    let direction = SignalDirectionEnum.HOLD;
    let confidence = 0;

    if (zone.hasHigh && !zone.hasLow) {
      // Pure HIGH zone: price was rejected at high prices
      direction = SignalDirectionEnum.SHORT; // Expect pullback from high

      /**
       * CONFIDENCE SCORING: Evidence-based calculation
       *
       * Uses configurable baseline + strength multiplier
       * - Baseline: Even with no HIGH strength, we have some confidence in detection
       *   (price behavior near highs with volume is meaningful)
       * - Multiplier: Leaves margin for unknown unknowns (Bayesian skepticism)
       *
       * Range: [baseline, baseline + multiplier * maxStrength]
       *
       * Applied because:
       * ✓ Never overconfident in single analyzer output
       * ✓ Allows weak signals to participate but with lower weight
       * ✓ Preserves margin for edge cases and market uncertainty
       */
      confidence = Math.round((this.highLowBaseline + zone.highStrength * this.highLowMultiplier) * 100);

    } else if (zone.hasLow && !zone.hasHigh) {
      // Pure LOW zone: price was supported at low prices
      direction = SignalDirectionEnum.LONG; // Expect bounce from low

      /**
       * CONFIDENCE SCORING: Same logic as HIGH zone
       * Uses configurable baseline + multiplier
       */
      confidence = Math.round((this.highLowBaseline + zone.lowStrength * this.highLowMultiplier) * 100);

    } else if (zone.hasHigh && zone.hasLow) {
      // Both zones present: High liquidity consolidation zone
      direction = SignalDirectionEnum.HOLD; // No clear directional bias, but high liquidity

      /**
       * CONFIDENCE SCORING: Consolidation strength
       * When both HIGH and LOW zones exist with significant volume:
       * - This indicates active two-way trading (support & resistance)
       * - Strong marker of liquidity and interest level
       * - Use AVERAGE strength instead of minimum (both zones matter equally)
       * - Uses configurable baseline + multiplier for consolidation signals
       *
       * Range: [baseline, baseline + multiplier * maxStrength]
       */
      const combinedStrength = (zone.highStrength + zone.lowStrength) / 2;
      confidence = Math.round((this.bothBaseline + combinedStrength * this.bothMultiplier) * 100);
      if (this.logger) {
        this.logger.debug('[LIQUIDITY_ZONE] Both HIGH and LOW zones detected - strong consolidation');
      }

    } else {
      // No clear zones
      direction = SignalDirectionEnum.HOLD;
      confidence = 0;
    }

    // Ensure confidence is valid [0, 100]
    confidence = Math.max(0, Math.min(100, confidence));

    const signal: AnalyzerSignal = {
      source: 'LIQUIDITY_ZONE_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  /**
   * FIX #2: Detect HIGH and LOW zones independently
   * HIGH zone: recent high prices with elevated volume
   * LOW zone: recent low prices with elevated volume
   */
  private detectZone(
    candles: Candle[]
  ): { hasHigh: boolean; hasLow: boolean; highStrength: number; lowStrength: number } {
    const recent = candles.slice(-this.recentWindow);

    if (recent.length === 0) {
      return { hasHigh: false, hasLow: false, highStrength: 0, lowStrength: 0 };
    }

    // Calculate average volume
    const avgVolume = recent.reduce((s, x) => s + (x.volume || 0), 0) / recent.length;
    const volumeThreshold = avgVolume; // Use average as threshold (candles equal or above avg = zone candidate)

    // Find max and min prices
    const maxHigh = recent.reduce((max, x) => Math.max(max, x.high), 0);
    const minLow = recent.reduce((min, x) => Math.min(min, x.low), Infinity);

    // Calculate price range for proper zone detection
    const priceRange = maxHigh - minLow;

    // HIGH zone: recent HIGH prices with elevated volume
    // (top zonePercentage of price range with high volume)
    const highPricesWithVolume = recent.filter((c) => {
      const isHighPrice = c.high > maxHigh - priceRange * this.zonePercentage;
      const hasHighVolume = (c.volume || 0) >= volumeThreshold;
      return isHighPrice && hasHighVolume;
    });

    // LOW zone: recent LOW prices with elevated volume
    // (bottom zonePercentage of price range with high volume)
    const lowPricesWithVolume = recent.filter((c) => {
      const isLowPrice = c.low < minLow + priceRange * this.zonePercentage;
      const hasHighVolume = (c.volume || 0) >= volumeThreshold;
      return isLowPrice && hasHighVolume;
    });

    // Calculate strength (ratio of zone candles)
    const highStrength = highPricesWithVolume.length / recent.length;
    const lowStrength = lowPricesWithVolume.length / recent.length;

    return {
      hasHigh: highPricesWithVolume.length >= this.minCandlesForZone,
      hasLow: lowPricesWithVolume.length >= this.minCandlesForZone,
      highStrength,
      lowStrength,
    };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.LIQUIDITY_ZONE;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForLiquidityZone;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForLiquidityZone;
  }

  /**
   * Get analyzer weight
   */
  getWeight(): number {
    return this.weight;
  }

  /**
   * Get analyzer priority
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Get maximum confidence
   */
  getMaxConfidence(): number {
    return this.maxConfidence;
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
