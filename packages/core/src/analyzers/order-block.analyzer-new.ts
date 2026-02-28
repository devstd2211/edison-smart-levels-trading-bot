import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';
import type { LoggerService } from '../services/logger.service';

const DEFAULT_MIN_CANDLES_FOR_ORDER_BLOCK = 25;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.15;
const DEFAULT_CONFIDENCE_MULTIPLIER = 0.8;
const DEFAULT_RECENT_WINDOW = 10;
const DEFAULT_WICK_RATIO_THRESHOLD = 1.5;
const DEFAULT_MAX_DISTANCE_THRESHOLD = 0.05;
const DEFAULT_MAX_REJECTION_COUNT = 5;
const DEFAULT_DISTANCE_PENALTY_MULTIPLIER = 0.5;
const DEFAULT_MAX_DISTANCE_FOR_RELEVANCE = 0.1;

export class OrderBlockAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly confidenceMultiplier: number;
  private readonly recentWindow: number;
  private readonly wickRatioThreshold: number;
  private readonly maxDistanceThreshold: number;
  private readonly maxRejectionCount: number;
  private readonly distancePenaltyMultiplier: number;
  private readonly maxDistanceForRelevance: number;
  private readonly minCandlesForOrderBlock: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew & {
    minCandlesForOrderBlock?: number;
    maxConfidence?: number;
    baseConfidence?: number;
    confidenceMultiplier?: number;
    recentWindow?: number;
    wickRatioThreshold?: number;
    maxDistanceThreshold?: number;
    maxRejectionCount?: number;
    distancePenaltyMultiplier?: number;
    maxDistanceForRelevance?: number;
  }, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[ORDER_BLOCK] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[ORDER_BLOCK] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[ORDER_BLOCK] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForOrderBlock = config.minCandlesForOrderBlock ?? DEFAULT_MIN_CANDLES_FOR_ORDER_BLOCK;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.confidenceMultiplier = config.confidenceMultiplier ?? DEFAULT_CONFIDENCE_MULTIPLIER;
    this.recentWindow = config.recentWindow ?? DEFAULT_RECENT_WINDOW;
    this.wickRatioThreshold = config.wickRatioThreshold ?? DEFAULT_WICK_RATIO_THRESHOLD;
    this.maxDistanceThreshold = config.maxDistanceThreshold ?? DEFAULT_MAX_DISTANCE_THRESHOLD;
    this.maxRejectionCount = config.maxRejectionCount ?? DEFAULT_MAX_REJECTION_COUNT;
    this.distancePenaltyMultiplier = config.distancePenaltyMultiplier ?? DEFAULT_DISTANCE_PENALTY_MULTIPLIER;
    this.maxDistanceForRelevance = config.maxDistanceForRelevance ?? DEFAULT_MAX_DISTANCE_FOR_RELEVANCE;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[ORDER_BLOCK] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[ORDER_BLOCK] Invalid candles input');
    if (candles.length < this.minCandlesForOrderBlock) throw new Error('[ORDER_BLOCK] Not enough candles');

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') {
        throw new Error('[ORDER_BLOCK] Invalid candle');
      }
    }

    const block = this.detectBlock(candles);

    // FIX #1: Only generate signal if block is relevant (close to current price)
    if (block.type === 'NONE' || !block.isRelevant) {
      const signal: AnalyzerSignal = {
        source: 'ORDER_BLOCK_ANALYZER_NEW',
        direction: SignalDirectionEnum.HOLD,
        confidence: 0,
        weight: this.weight,
        priority: this.priority,
        score: 0,
      };
      this.lastSignal = signal;
      this.initialized = true;
      return signal;
    }

    // FIX #2: Use proper confidence based on strength
    const direction = block.type === 'BULLISH' ? SignalDirectionEnum.LONG : SignalDirectionEnum.SHORT;

    /**
     * CONFIDENCE SCORING: Evidence-based calculation for Order Blocks
     *
     * Why baseline + multiplier?
     * - Baseline: Even with low strength, we detected a rejection pattern
     *   (wick ratio >= threshold) which has meaning
     * - Multiplier: Maximum possible is maxConfidence (Bayesian skepticism)
     *
     * Range: [baseline%, maxConfidence%]
     * - strength=0: confidence = baseline (block detected but very weak)
     * - strength=1: confidence = maxConfidence (multiple strong rejections at same level, price near block)
     *
     * Why different from LiquidityZone?
     * - Order blocks require explicit wick rejection (higher bar)
     * - Start at lower baseline (harder to confirm)
     * - But when strong, reach same maxConfidence (both analyzers equal weight)
     *
     * Applied because:
     * ✓ Reflects SMC theory: rejections are meaningful pattern
     * ✓ Distance penalty already applied in strength calculation
     * ✓ Prevents overconfidence in noisy wicks
     */
    const confidence = Math.round((this.baseConfidence + block.strength * this.confidenceMultiplier) * 100);

    const signal: AnalyzerSignal = {
      source: 'ORDER_BLOCK_ANALYZER_NEW',
      direction,
      confidence: Math.max(0, Math.min(100, confidence)),
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  /**
   * FIX #3: Detect REAL order blocks using wick rejection
   *
   * ORDER BLOCK THEORY (SMC):
   * - Bullish OB: Price tried to go down, but got rejected (big lower wick)
   * - Bearish OB: Price tried to go up, but got rejected (big upper wick)
   *
   * Detection:
   * 1. Find candles with wick > 1.5x body size (rejection signal)
   * 2. Count rejections at each price level
   * 3. Find the most relevant block (closest to current price)
   * 4. Calculate strength based on: rejection count + proximity
   */
  private detectBlock(
    candles: Candle[]
  ): {
    type: 'BULLISH' | 'BEARISH' | 'NONE';
    strength: number;
    blockLevel?: number;
    distance?: number;
    isRelevant: boolean;
  } {
    const recent = candles.slice(-this.recentWindow);
    const lastCandle = candles[candles.length - 1];

    if (recent.length < 3) {
      return { type: 'NONE', strength: 0, isRelevant: false };
    }

    // Helper: Calculate wick-to-body ratios
    const getWickRatio = (
      c: Candle
    ): { upper: number; lower: number; body: number } => {
      const body = Math.abs(c.close - c.open);
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;

      return {
        upper: body > 0 ? upperWick / body : 0,
        lower: body > 0 ? lowerWick / body : 0,
        body,
      };
    };

    // FIX #4: Find rejections (wick > threshold * body)
    // BEARISH rejection: upper wick (price went up, got rejected)
    const bearishRejections = recent
      .map((c, i) => {
        const wick = getWickRatio(c);
        return {
          index: i,
          candle: c,
          level: c.high, // Top of rejection wick
          wickRatio: wick.upper,
          body: wick.body,
          isRejection: wick.upper >= this.wickRatioThreshold && wick.body > 0,
        };
      })
      .filter((x) => x.isRejection);

    // BULLISH rejection: lower wick (price went down, got rejected)
    const bullishRejections = recent
      .map((c, i) => {
        const wick = getWickRatio(c);
        return {
          index: i,
          candle: c,
          level: c.low, // Bottom of rejection wick
          wickRatio: wick.lower,
          body: wick.body,
          isRejection: wick.lower >= this.wickRatioThreshold && wick.body > 0,
        };
      })
      .filter((x) => x.isRejection);

    // FIX #5: Find most relevant block (closest to current price)
    interface RejectionCandidate {
      index: number;
      candle: Candle;
      level: number;
      wickRatio: number;
      body: number;
      isRejection: boolean;
    }

    interface BlockCandidate {
      type: 'BULLISH' | 'BEARISH';
      level: number;
      distance: number;
      rejections: RejectionCandidate[];
    }

    let bestBlock: BlockCandidate | null = null;
    let minDistance = Infinity;

    // Check bearish rejections → BULLISH order block
    if (bearishRejections.length > 0) {
      // Use most recent rejection as block level
      const blockLevel = bearishRejections[bearishRejections.length - 1].level;
      const distance = Math.abs(lastCandle.close - blockLevel) / blockLevel;

      if (distance < minDistance) {
        minDistance = distance;
        bestBlock = {
          type: 'BULLISH',
          level: blockLevel,
          distance,
          rejections: bearishRejections,
        };
      }
    }

    // Check bullish rejections → BEARISH order block
    if (bullishRejections.length > 0) {
      const blockLevel = bullishRejections[bullishRejections.length - 1].level;
      const distance = Math.abs(lastCandle.close - blockLevel) / blockLevel;

      if (distance < minDistance) {
        minDistance = distance;
        bestBlock = {
          type: 'BEARISH',
          level: blockLevel,
          distance,
          rejections: bullishRejections,
        };
      }
    }

    // No rejections found
    if (!bestBlock) {
      return { type: 'NONE', strength: 0, isRelevant: false };
    }

    // FIX #6: Calculate strength
    // Strength = f(rejectionCount, distance)
    // More rejections = stronger
    // Closer distance = stronger

    // Distance factor: 0 at block, 1 when too far
    const distanceFactor = Math.min(1, bestBlock.distance / this.maxDistanceThreshold);

    // Rejection factor: 0 with no rejections, 1 with many
    const rejectionFactor = Math.min(1, bestBlock.rejections.length / this.maxRejectionCount);

    // Combined strength: both matter equally
    // At block (distance=0) with many rejections (ratio=1): strength ≈ 1.0
    // Far from block (distance=max) with few rejections: strength ≈ 0
    const strength = (1 - distanceFactor * this.distancePenaltyMultiplier) * rejectionFactor;

    // Only consider block relevant if:
    // 1. It has at least 1 rejection (confirmed)
    // 2. Price is within threshold of block level
    const isRelevant =
      bestBlock.rejections.length >= 1 && bestBlock.distance <= this.maxDistanceForRelevance;

    return {
      type: bestBlock.type,
      strength: Math.max(0, Math.min(1, strength)),
      blockLevel: bestBlock.level,
      distance: bestBlock.distance,
      isRelevant,
    };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.ORDER_BLOCK;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForOrderBlock;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForOrderBlock;
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

