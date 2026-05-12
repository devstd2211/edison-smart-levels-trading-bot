/**
 * Divergence Analyzer NEW - with ConfigNew Support
 * Detects divergences between price action and RSI indicator
 *
 * Divergences are powerful reversal signals:
 * - BULLISH DIVERGENCE: Price makes lower low, RSI makes higher low -> Potential reversal up
 * - BEARISH DIVERGENCE: Price makes higher high, RSI makes lower high -> Potential reversal down
 *
 * Signal Logic:
 * - Bullish divergence detected: LONG signal
 * - Bearish divergence detected: SHORT signal
 * - No divergence: HOLD signal
 *
 * Confidence Calculation:
 * - Based on divergence strength (price diff + RSI diff magnitude)
 * - Stronger divergences = higher confidence
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { DivergenceAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { RSIIndicatorNew } from '../indicators/rsi.indicator-new';
import type { LoggerService } from '../services/logger.service';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';
import {
  checkBearishDivergence,
  checkBullishDivergence,
  DivergenceResult,
  findSwingHighs,
  findSwingLows,
} from './divergence/divergence-primitives.utils';

// ============================================================================
// DEFAULT CONSTANTS (can be overridden via config)
// ============================================================================

const DEFAULT_MIN_CANDLES = 50; // Need enough candles to find swing points
const DEFAULT_MIN_CONFIDENCE = 0.1; // Minimum confidence floor (10%)
const DEFAULT_MAX_CONFIDENCE = 0.95; // Maximum confidence
const DEFAULT_MIN_PRICE_DIFF_PERCENT = 1.0; // Minimum price movement for divergence
const DEFAULT_MIN_RSI_DIFF_POINTS = 5; // Minimum RSI movement for divergence
const DEFAULT_SWING_LOOKBACK = 10; // Look back N candles to find swing points

// RSI Indicator Defaults
const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_RSI_OVERSOLD = 30;
const DEFAULT_RSI_OVERBOUGHT = 70;
const DEFAULT_RSI_EXTREME_LOW = 5;
const DEFAULT_RSI_EXTREME_HIGH = 95;
const DEFAULT_RSI_NEUTRAL_MIN = 40;
const DEFAULT_RSI_NEUTRAL_MAX = 60;
const DEFAULT_RSI_MAX_CONFIDENCE = 0.95;

// ============================================================================
// DIVERGENCE ANALYZER - NEW VERSION
// ============================================================================

export class DivergenceAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly maxConfidence: number;

  // Configurable parameters
  private readonly minCandles: number;
  private readonly minConfidence: number;
  private readonly minPriceDiffPercent: number;
  private readonly minRsiDiffPoints: number;
  private readonly swingLookback: number;

  // RSI Indicator parameters
  private readonly rsiPeriod: number;
  private readonly rsiOversold: number;
  private readonly rsiOverbought: number;
  private readonly rsiExtremeLow: number;
  private readonly rsiExtremeHigh: number;
  private readonly rsiNeutralMin: number;
  private readonly rsiNeutralMax: number;
  private readonly rsiMaxConfidence: number;

  private rsiIndicator: RSIIndicatorNew;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  /**
   * Constructor with ConfigNew
   * STRICT - Throws if config is invalid
   */
  constructor(
    config: DivergenceAnalyzerConfigNew & {
      minCandles?: number;
      minConfidence?: number;
      minPriceDiffPercent?: number;
      minRsiDiffPoints?: number;
      swingLookback?: number;
      rsiPeriod?: number;
      rsiOversold?: number;
      rsiOverbought?: number;
      rsiExtremeLow?: number;
      rsiExtremeHigh?: number;
      rsiNeutralMin?: number;
      rsiNeutralMax?: number;
      rsiMaxConfidence?: number;
    },
    private logger?: LoggerService,
  ) {
    // Validate analyzer config
    if (typeof config.enabled !== 'boolean') {
      throw new Error('[DIVERGENCE_ANALYZER] Missing or invalid: enabled (boolean)');
    }
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) {
      throw new Error('[DIVERGENCE_ANALYZER] Missing or invalid: weight (0.0-1.0)');
    }
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
      throw new Error('[DIVERGENCE_ANALYZER] Missing or invalid: priority (1-10)');
    }
    if (typeof config.maxConfidence !== 'number' || config.maxConfidence < 0.1 || config.maxConfidence > 1) {
      throw new Error('[DIVERGENCE_ANALYZER] Missing or invalid: maxConfidence (0.1-1.0)');
    }

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.maxConfidence = config.maxConfidence;

    // Initialize configurable parameters with defaults
    this.minCandles = config.minCandles ?? DEFAULT_MIN_CANDLES;
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.minPriceDiffPercent = config.minPriceDiffPercent ?? DEFAULT_MIN_PRICE_DIFF_PERCENT;
    this.minRsiDiffPoints = config.minRsiDiffPoints ?? DEFAULT_MIN_RSI_DIFF_POINTS;
    this.swingLookback = config.swingLookback ?? DEFAULT_SWING_LOOKBACK;

    // RSI Indicator parameters
    this.rsiPeriod = config.rsiPeriod ?? DEFAULT_RSI_PERIOD;
    this.rsiOversold = config.rsiOversold ?? DEFAULT_RSI_OVERSOLD;
    this.rsiOverbought = config.rsiOverbought ?? DEFAULT_RSI_OVERBOUGHT;
    this.rsiExtremeLow = config.rsiExtremeLow ?? DEFAULT_RSI_EXTREME_LOW;
    this.rsiExtremeHigh = config.rsiExtremeHigh ?? DEFAULT_RSI_EXTREME_HIGH;
    this.rsiNeutralMin = config.rsiNeutralMin ?? DEFAULT_RSI_NEUTRAL_MIN;
    this.rsiNeutralMax = config.rsiNeutralMax ?? DEFAULT_RSI_NEUTRAL_MAX;
    this.rsiMaxConfidence = config.rsiMaxConfidence ?? DEFAULT_RSI_MAX_CONFIDENCE;

    // Create RSI indicator with configurable parameters
    this.rsiIndicator = new RSIIndicatorNew({
      enabled: true,
      period: this.rsiPeriod,
      oversold: this.rsiOversold,
      overbought: this.rsiOverbought,
      extreme: { low: this.rsiExtremeLow, high: this.rsiExtremeHigh },
      neutralZone: { min: this.rsiNeutralMin, max: this.rsiNeutralMax },
      maxConfidence: this.rsiMaxConfidence,
    });
  }

  /**
   * Analyze candles and generate divergence signal
   *
   * @param candles - Array of candles
   * @returns AnalyzerSignal with direction, confidence, and weight
   * @throws {Error} If not enabled, not enough candles, or invalid input
   */
  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) {
      throw new Error('[DIVERGENCE_ANALYZER] Analyzer is disabled');
    }

    if (!Array.isArray(candles)) {
      throw new Error('[DIVERGENCE_ANALYZER] Invalid candles input (must be array)');
    }

    if (candles.length < this.minCandles) {
      throw new Error(
        `[DIVERGENCE_ANALYZER] Not enough candles. Need ${this.minCandles}, got ${candles.length}`,
      );
    }

    // Validate candles
    for (let i = 0; i < candles.length; i++) {
      if (
        !candles[i] ||
        typeof candles[i].high !== 'number' ||
        typeof candles[i].low !== 'number' ||
        typeof candles[i].close !== 'number'
      ) {
        throw new Error(`[DIVERGENCE_ANALYZER] Invalid candle at index ${i}`);
      }
    }

    // Calculate RSI for all candles
    const rsiValues = this.calculateRSI(candles);

    // Detect divergence
    const divergence = this.detectDivergence(candles, rsiValues);

    // Determine signal direction based on divergence
    const direction = this.getDirection(divergence);

    // Calculate confidence based on divergence strength
    const confidence = this.calculateConfidence(divergence);

    // Create signal
    const signal: AnalyzerSignal = {
      source: 'DIVERGENCE_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;

    this.logger?.debug('[DIVERGENCE_ANALYZER] Generated signal', {
      direction,
      confidence,
      divergenceType: divergence.type,
      strength: divergence.strength,
    });

    return signal;
  }

  /**
   * Calculate RSI values for all candles
   *
   * @private
   * @param candles - Array of candles
   * @returns Array of RSI values
   */
  private calculateRSI(candles: Candle[]): number[] {
    const rsiValues: number[] = [];

    // For each candle, calculate RSI up to that point
    for (let i = 13; i < candles.length; i++) {
      const sliceCandles = candles.slice(0, i + 1);
      try {
        const rsiValue = this.rsiIndicator.calculate(sliceCandles);
        rsiValues.push(rsiValue);
      } catch {
        // If we can't calculate RSI for this point, use NaN
        rsiValues.push(NaN);
      }
    }

    return rsiValues;
  }

  /**
   * Detect divergence between price and RSI
   *
   * @private
   * @param candles - Array of candles
   * @param rsiValues - Array of RSI values (parallel to candles)
   * @returns Divergence information
   */
  private detectDivergence(
    candles: Candle[],
    rsiValues: number[],
  ): DivergenceResult {
    // Find swing points (local highs and lows)
    const lastN = Math.min(this.swingLookback, candles.length - 1);
    const recentCandles = candles.slice(-lastN);
    const recentRsi = rsiValues.slice(-lastN);

    // Find last two highs (for bearish divergence)
    const highs = findSwingHighs(recentCandles, recentRsi);

    // Find last two lows (for bullish divergence)
    const lows = findSwingLows(recentCandles, recentRsi);

    // Check for bearish divergence (price HH, RSI LH)
    if (highs.length >= 2) {
      const divergence = checkBearishDivergence(
        highs[0],
        highs[1],
        this.minPriceDiffPercent,
        this.minRsiDiffPoints,
        this.minConfidence,
      );
      if (divergence.type === 'BEARISH') {
        return divergence;
      }
    }

    // Check for bullish divergence (price LL, RSI HL)
    if (lows.length >= 2) {
      const divergence = checkBullishDivergence(
        lows[0],
        lows[1],
        this.minPriceDiffPercent,
        this.minRsiDiffPoints,
        this.minConfidence,
      );
      if (divergence.type === 'BULLISH') {
        return divergence;
      }
    }

    return { type: 'NONE', strength: 0, priceDiff: 0, rsiDiff: 0 };
  }

  /**
   * Determine signal direction based on divergence type
   *
   * @private
   * @param divergence - Divergence information
   * @returns SignalDirection
   */
  private getDirection(divergence: {
    type: 'NONE' | 'BULLISH' | 'BEARISH';
    strength: number;
  }): SignalDirection {
    if (divergence.type === 'BULLISH') {
      return SignalDirectionEnum.LONG;
    } else if (divergence.type === 'BEARISH') {
      return SignalDirectionEnum.SHORT;
    } else {
      return SignalDirectionEnum.HOLD;
    }
  }

  /**
   * Calculate confidence based on divergence strength
   *
   * @private
   * @param divergence - Divergence information
   * @returns Confidence value (0-100 scale)
   */
  private calculateConfidence(divergence: {
    type: 'NONE' | 'BULLISH' | 'BEARISH';
    strength: number;
  }): number {
    let confidence: number;

    if (divergence.type === 'NONE') {
      // No divergence: low confidence
      confidence = this.minConfidence;
    } else {
      // Divergence found: confidence based on strength
      confidence = this.minConfidence + divergence.strength * (this.maxConfidence - this.minConfidence);
    }

    // Clamp to bounds
    confidence = Math.max(this.minConfidence, Math.min(this.maxConfidence, confidence));

    // Convert to 0-100 scale
    return Math.round(confidence * 100);
  }

  /**
   * Get last generated signal
   *
   * @returns Last AnalyzerSignal or null if not initialized
   */
  getLastSignal(): AnalyzerSignal | null {
    return this.lastSignal;
  }

  /**
   * Get analyzer state
   *
   * @returns Current analyzer state
   */
  getStateSnapshot(): {
    enabled: boolean;
    initialized: boolean;
    lastSignal: AnalyzerSignal | null;
    config: {
      weight: number;
      priority: number;
      maxConfidence: number;
    };
  } {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      lastSignal: this.lastSignal ? { ...this.lastSignal } : null,
      config: {
        weight: this.weight,
        priority: this.priority,
        maxConfidence: this.maxConfidence,
      },
    };
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.rsiIndicator.reset();
    this.lastSignal = null;
    this.initialized = false;
  }

  /**
   * Check if analyzer is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.DIVERGENCE;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandles;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandles;
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

  /**
   * Get config values
   */
  getConfig(): {
    enabled: boolean;
    weight: number;
    priority: number;
    maxConfidence: number;
  } {
    return {
      enabled: this.enabled,
      weight: this.weight,
      priority: this.priority,
      maxConfidence: this.maxConfidence,
    };
  }
}

