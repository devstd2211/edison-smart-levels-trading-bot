/**
 * Trend Detector Analyzer NEW - with ConfigNew Support
 * Detects trend direction (uptrend, downtrend, consolidation)
 *
 * Signal Logic:
 * - Clear uptrend (higher highs, higher lows): LONG signal
 * - Clear downtrend (lower highs, lower lows): SHORT signal
 * - Consolidation (sideways): HOLD signal
 *
 * Confidence Calculation:
 * - Based on trend consistency and clarity
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { TrendDetectorConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';
import { IAnalyzer } from '../types/analyzer.interface';
import { AnalyzerType } from '../types/analyzer-type.enum';

// ============================================================================
// CONSTANTS - Configurable Defaults
// ============================================================================

const DEFAULT_MIN_CANDLES_FOR_TREND = 20;
const DEFAULT_MIN_CONFIDENCE = 0.1;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_TREND_LOOKBACK = 15; // Look back for trend analysis

// ============================================================================
// TREND DETECTOR ANALYZER - NEW VERSION
// ============================================================================

export class TrendDetectorAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minEmaGapPercent: number;
  private readonly minConfidence: number;
  private readonly maxConfidence: number;
  private readonly minCandlesForTrend: number;
  private readonly trendLookback: number;

  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  /**
   * Constructor with ConfigNew
   * STRICT - Throws if config is invalid
   */
  constructor(
    config: TrendDetectorConfigNew,
    private logger?: LoggerService,
  ) {
    // Validate analyzer config
    if (typeof config.enabled !== 'boolean') {
      throw new Error('[TREND_DETECTOR] Missing or invalid: enabled (boolean)');
    }
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) {
      throw new Error('[TREND_DETECTOR] Missing or invalid: weight (0.0-1.0)');
    }
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
      throw new Error('[TREND_DETECTOR] Missing or invalid: priority (1-10)');
    }
    if (typeof config.minEmaGapPercent !== 'number' || config.minEmaGapPercent < 0) {
      throw new Error('[TREND_DETECTOR] Missing or invalid: minEmaGapPercent (>= 0)');
    }
    if (typeof config.minConfidence !== 'number' || config.minConfidence < 0 || config.minConfidence > 1) {
      throw new Error('[TREND_DETECTOR] Missing or invalid: minConfidence (0.0-1.0)');
    }
    if (typeof config.maxConfidence !== 'number' || config.maxConfidence < 0.1 || config.maxConfidence > 1) {
      throw new Error('[TREND_DETECTOR] Missing or invalid: maxConfidence (0.1-1.0)');
    }

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minEmaGapPercent = config.minEmaGapPercent;
    this.minConfidence = config.minConfidence;
    this.maxConfidence = config.maxConfidence;
    this.minCandlesForTrend = config.minCandlesForTrend ?? DEFAULT_MIN_CANDLES_FOR_TREND;
    this.trendLookback = config.trendLookback ?? DEFAULT_TREND_LOOKBACK;
  }

  /**
   * Analyze candles and generate trend signal
   *
   * @param candles - Array of candles
   * @returns AnalyzerSignal with direction, confidence, and weight
   * @throws {Error} If not enabled, not enough candles, or invalid input
   */
  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) {
      throw new Error('[TREND_DETECTOR] Analyzer is disabled');
    }

    if (!Array.isArray(candles)) {
      throw new Error('[TREND_DETECTOR] Invalid candles input (must be array)');
    }

    if (candles.length < this.minCandlesForTrend) {
      throw new Error(`[TREND_DETECTOR] Not enough candles. Need ${this.minCandlesForTrend}, got ${candles.length}`);
    }

    // Validate candles
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].high !== 'number' || typeof candles[i].low !== 'number' || typeof candles[i].close !== 'number') {
        throw new Error(`[TREND_DETECTOR] Invalid candle at index ${i}`);
      }
    }

    // Detect trend
    const trend = this.detectTrend(candles);

    // Determine signal direction
    const direction = this.getDirection(trend);

    // Calculate confidence
    const confidence = this.calculateConfidence(trend);

    // Create signal
    const signal: AnalyzerSignal = {
      source: 'TREND_DETECTOR_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;

    this.logger?.debug('[TREND_DETECTOR] Generated signal', {
      direction,
      confidence,
      trendType: trend.type,
      strength: trend.strength,
    });

    return signal;
  }

  /**
   * Detect trend from price action
   *
   * @private
   * @param candles - Array of candles
   * @returns Trend information
   */
  private detectTrend(candles: Candle[]): {
    type: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
    strength: number;
    highCount: number;
    lowCount: number;
  } {
    const lookback = Math.min(this.trendLookback, candles.length - 1);
    const recentCandles = candles.slice(-lookback);

    // Find swing highs and lows
    let highCount = 0; // Higher highs
    let lowCount = 0; // Higher lows
    let lowerHighCount = 0; // Lower highs
    let lowerLowCount = 0; // Lower lows

    // Compare each pivot to previous
    for (let i = 1; i < recentCandles.length; i++) {
      const prevHigh = recentCandles[i - 1].high;
      const currHigh = recentCandles[i].high;
      const prevLow = recentCandles[i - 1].low;
      const currLow = recentCandles[i].low;

      if (currHigh > prevHigh) highCount++;
      else if (currHigh < prevHigh) lowerHighCount++;

      if (currLow > prevLow) lowCount++;
      else if (currLow < prevLow) lowerLowCount++;
    }

    // Determine trend type
    let type: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
    let strength = 0;

    if (highCount > lowerHighCount && lowCount > lowerLowCount) {
      type = 'UPTREND';
      strength = (highCount + lowCount) / (lookback * 2);
    } else if (lowerHighCount > highCount && lowerLowCount > lowCount) {
      type = 'DOWNTREND';
      strength = (lowerHighCount + lowerLowCount) / (lookback * 2);
    } else {
      type = 'CONSOLIDATION';
      strength = 0.3;
    }

    return {
      type,
      strength: Math.min(1, strength),
      highCount,
      lowCount,
    };
  }

  /**
   * Determine signal direction based on trend
   *
   * @private
   * @param trend - Trend information
   * @returns SignalDirection
   */
  private getDirection(trend: { type: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION' }): SignalDirection {
    switch (trend.type) {
      case 'UPTREND':
        return SignalDirectionEnum.LONG;
      case 'DOWNTREND':
        return SignalDirectionEnum.SHORT;
      case 'CONSOLIDATION':
      default:
        return SignalDirectionEnum.HOLD;
    }
  }

  /**
   * Calculate confidence based on trend strength
   *
   * @private
   * @param trend - Trend information
   * @returns Confidence value (0-100 scale)
   */
  private calculateConfidence(trend: { type: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION'; strength: number }): number {
    let confidence: number;

    if (trend.type === 'CONSOLIDATION') {
      confidence = Math.min(0.5, this.minConfidence + trend.strength * 0.3);
    } else {
      confidence = Math.min(this.maxConfidence, this.minConfidence + trend.strength * 0.8);
    }

    confidence = Math.max(this.minConfidence, Math.min(this.maxConfidence, confidence));
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
  getState(): {
    enabled: boolean;
    initialized: boolean;
    lastSignal: AnalyzerSignal | null;
    config: {
      weight: number;
      priority: number;
    };
  } {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      lastSignal: this.lastSignal,
      config: {
        weight: this.weight,
        priority: this.priority,
      },
    };
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
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
    return AnalyzerType.TREND_DETECTOR;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForTrend;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForTrend;
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
  } {
    return {
      enabled: this.enabled,
      weight: this.weight,
      priority: this.priority,
    };
  }
}
