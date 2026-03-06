/**
 * Bollinger Bands Analyzer NEW - with ConfigNew Support
 * Generates trading signals based on Bollinger Bands and price position
 *
 * Signal Logic (based on %B value and bandwidth):
 * - %B < 20 (near lower band) + Expanding bands: LONG signal (oversold bounce potential)
 * - %B > 80 (near upper band) + Expanding bands: SHORT signal (overbought reversal potential)
 * - 20 <= %B <= 80: HOLD signal (price in middle zone)
 * - Squeeze (%B with narrow bands): HOLD with low confidence (consolidation)
 *
 * Confidence Calculation:
 * - Based on distance of %B from boundaries (0/100)
 * - Stronger signals when price is near bands AND bands are expanding
 * - Weaker signals when bands are squeezed (low volatility)
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { BollingerBandsAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { BollingerBandsIndicatorNew } from '../indicators/bollinger-bands.indicator-new';
import type { LoggerService } from '../services/logger.service';
import type { IIndicator } from '../types/indicator';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';
import {
  calculateBollingerConfidence,
  getBollingerDirection,
} from './bollinger-bands/bollinger-signal.utils';

// ============================================================================
// DEFAULT CONSTANTS (can be overridden via config)
// ============================================================================

const DEFAULT_MIN_CANDLES_FOR_BOLLINGER_BANDS = 25; // Need at least period (20) + some history
const DEFAULT_MIN_CONFIDENCE = 0.1; // Minimum confidence floor (10%)
const DEFAULT_MAX_CONFIDENCE = 0.95; // Maximum confidence ceiling (95%)
const DEFAULT_OVERSOLD_THRESHOLD = 20; // %B < 20 = near lower band
const DEFAULT_OVERBOUGHT_THRESHOLD = 80; // %B > 80 = near upper band
const DEFAULT_NEUTRAL_LOWER = 40; // %B range for neutral zone
const DEFAULT_NEUTRAL_UPPER = 60;
const DEFAULT_SQUEEZE_THRESHOLD = 5; // Bandwidth < 5% = squeezing
const DEFAULT_EXPANSION_THRESHOLD = 10; // Bandwidth > 10% = expanding
const DEFAULT_NEUTRAL_CONFIDENCE_MULTIPLIER = 0.2; // Neutral zone confidence multiplier
const DEFAULT_MODERATE_CONFIDENCE_MULTIPLIER = 0.4; // Moderate zone confidence multiplier
const DEFAULT_DISTANCE_NORMALIZATION_DIVISOR = 40; // Distance normalization divisor
const DEFAULT_VOLATILITY_VERY_LOW_THRESHOLD = 3; // Bandwidth < 3% = very low volatility
const DEFAULT_VOLATILITY_LOW_THRESHOLD = 6; // Bandwidth < 6% = low volatility
const DEFAULT_VOLATILITY_NORMAL_THRESHOLD = 10; // Bandwidth < 10% = normal volatility
const DEFAULT_VOLATILITY_HIGH_THRESHOLD = 15; // Bandwidth < 15% = high volatility

// ============================================================================
// BOLLINGER BANDS ANALYZER - NEW VERSION
// ============================================================================

export class BollingerBandsAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly period: number;
  private readonly stdDev: number;

  // Configurable thresholds
  private readonly minCandlesForBollingerBands: number;
  private readonly minConfidence: number;
  private readonly maxConfidence: number;
  private readonly oversoldThreshold: number;
  private readonly overboughtThreshold: number;
  private readonly neutralLower: number;
  private readonly neutralUpper: number;
  private readonly squeezeThreshold: number;
  private readonly expansionThreshold: number;
  private readonly neutralConfidenceMultiplier: number;
  private readonly moderateConfidenceMultiplier: number;
  private readonly distanceNormalizationDivisor: number;
  private readonly volatilityVeryLowThreshold: number;
  private readonly volatilityLowThreshold: number;
  private readonly volatilityNormalThreshold: number;
  private readonly volatilityHighThreshold: number;

  private indicator: BollingerBandsIndicatorNew;
  private lastSignal: AnalyzerSignal | null = null;
  private lastBandwidth: number = 0;
  private initialized: boolean = false;

  /**
   * Constructor with ConfigNew
   * STRICT - Throws if config is invalid
   *
   * @param config Analyzer configuration
   * @param logger Logger service (optional)
   * @param indicatorDI Bollinger Bands indicator instance via DI (optional, will create if not provided)
   */
  constructor(
    config: BollingerBandsAnalyzerConfigNew & {
      minCandlesForBollingerBands?: number;
      minConfidence?: number;
      maxConfidence?: number;
      oversoldThreshold?: number;
      overboughtThreshold?: number;
      neutralLower?: number;
      neutralUpper?: number;
      squeezeThreshold?: number;
      expansionThreshold?: number;
      neutralConfidenceMultiplier?: number;
      moderateConfidenceMultiplier?: number;
      distanceNormalizationDivisor?: number;
      volatilityVeryLowThreshold?: number;
      volatilityLowThreshold?: number;
      volatilityNormalThreshold?: number;
      volatilityHighThreshold?: number;
    },
    private logger?: LoggerService,
    indicatorDI?: IIndicator | null,
  ) {
    // Validate analyzer config
    if (typeof config.enabled !== 'boolean') {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Missing or invalid: enabled (boolean)');
    }
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Missing or invalid: weight (0.0-1.0)');
    }
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Missing or invalid: priority (1-10)');
    }
    if (typeof config.period !== 'number' || config.period < 1 || config.period > 100) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Missing or invalid: period (1-100)');
    }
    if (typeof config.stdDev !== 'number' || config.stdDev < 0.1 || config.stdDev > 10) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Missing or invalid: stdDev (0.1-10)');
    }

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.period = config.period;
    this.stdDev = config.stdDev;

    // Initialize configurable thresholds with defaults
    this.minCandlesForBollingerBands = config.minCandlesForBollingerBands ?? DEFAULT_MIN_CANDLES_FOR_BOLLINGER_BANDS;
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.oversoldThreshold = config.oversoldThreshold ?? DEFAULT_OVERSOLD_THRESHOLD;
    this.overboughtThreshold = config.overboughtThreshold ?? DEFAULT_OVERBOUGHT_THRESHOLD;
    this.neutralLower = config.neutralLower ?? DEFAULT_NEUTRAL_LOWER;
    this.neutralUpper = config.neutralUpper ?? DEFAULT_NEUTRAL_UPPER;
    this.squeezeThreshold = config.squeezeThreshold ?? DEFAULT_SQUEEZE_THRESHOLD;
    this.expansionThreshold = config.expansionThreshold ?? DEFAULT_EXPANSION_THRESHOLD;
    this.neutralConfidenceMultiplier = config.neutralConfidenceMultiplier ?? DEFAULT_NEUTRAL_CONFIDENCE_MULTIPLIER;
    this.moderateConfidenceMultiplier = config.moderateConfidenceMultiplier ?? DEFAULT_MODERATE_CONFIDENCE_MULTIPLIER;
    this.distanceNormalizationDivisor = config.distanceNormalizationDivisor ?? DEFAULT_DISTANCE_NORMALIZATION_DIVISOR;
    this.volatilityVeryLowThreshold = config.volatilityVeryLowThreshold ?? DEFAULT_VOLATILITY_VERY_LOW_THRESHOLD;
    this.volatilityLowThreshold = config.volatilityLowThreshold ?? DEFAULT_VOLATILITY_LOW_THRESHOLD;
    this.volatilityNormalThreshold = config.volatilityNormalThreshold ?? DEFAULT_VOLATILITY_NORMAL_THRESHOLD;
    this.volatilityHighThreshold = config.volatilityHighThreshold ?? DEFAULT_VOLATILITY_HIGH_THRESHOLD;

    // Use injected indicator if provided (DI), otherwise create new one
    if (indicatorDI && indicatorDI instanceof BollingerBandsIndicatorNew) {
      this.indicator = indicatorDI;
      this.logger?.info('[BOLLINGER_BANDS_ANALYZER] Using injected Bollinger Bands indicator via DI');
    } else {
      // Fallback: Create Bollinger Bands indicator with configured parameters
      this.logger?.info('[BOLLINGER_BANDS_ANALYZER] Creating new Bollinger Bands indicator', {
        period: this.period,
        stdDev: this.stdDev,
      });

      this.indicator = new BollingerBandsIndicatorNew({
        enabled: true,
        period: this.period,
        stdDev: this.stdDev,
      });
    }
  }

  /**
   * Analyze candles and generate Bollinger Bands signal
   *
   * @param candles - Array of candles
   * @returns AnalyzerSignal with direction, confidence, and weight
   * @throws {Error} If not enabled, not enough candles, or invalid input
   */
  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Analyzer is disabled');
    }

    if (!Array.isArray(candles)) {
      throw new Error('[BOLLINGER_BANDS_ANALYZER] Invalid candles input (must be array)');
    }

    if (candles.length < this.minCandlesForBollingerBands) {
      throw new Error(
        `[BOLLINGER_BANDS_ANALYZER] Not enough candles. Need ${this.minCandlesForBollingerBands}, got ${candles.length}`,
      );
    }

    // Validate candles
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') {
        throw new Error(`[BOLLINGER_BANDS_ANALYZER] Invalid candle at index ${i}`);
      }
    }

    // Calculate Bollinger Bands
    const bbValues = this.indicator.calculate(candles);

    // Determine signal direction based on %B and bandwidth
    const direction = this.getDirection(bbValues.percentB, bbValues.bandwidth);

    // Calculate confidence based on price position and volatility
    const confidence = this.calculateConfidence(bbValues.percentB, bbValues.bandwidth);

    // Create signal
    const signal: AnalyzerSignal = {
      source: 'BOLLINGER_BANDS_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.lastBandwidth = bbValues.bandwidth;
    this.initialized = true;

    this.logger?.debug('[BOLLINGER_BANDS_ANALYZER] Generated signal', {
      direction,
      confidence,
      percentB: bbValues.percentB,
      bandwidth: bbValues.bandwidth,
    });

    return signal;
  }

  /**
   * Determine signal direction based on %B and bandwidth
   *
   * @private
   * @param percentB - %B value (0-100 scale)
   * @param bandwidth - Bandwidth percentage
   * @returns SignalDirection (LONG, SHORT, or HOLD)
   */
  private getDirection(percentB: number, bandwidth: number): SignalDirection {
    return getBollingerDirection(percentB, bandwidth, {
      oversoldThreshold: this.oversoldThreshold,
      overboughtThreshold: this.overboughtThreshold,
      squeezeThreshold: this.squeezeThreshold,
    });
  }

  /**
   * Calculate confidence based on %B position and bandwidth
   *
   * @private
   * @param percentB - %B value (0-100 scale)
   * @param bandwidth - Bandwidth percentage
   * @returns Confidence value (0-100 scale)
   */
  private calculateConfidence(percentB: number, bandwidth: number): number {
    return calculateBollingerConfidence(percentB, bandwidth, {
      minConfidence: this.minConfidence,
      maxConfidence: this.maxConfidence,
      oversoldThreshold: this.oversoldThreshold,
      overboughtThreshold: this.overboughtThreshold,
      neutralLower: this.neutralLower,
      neutralUpper: this.neutralUpper,
      squeezeThreshold: this.squeezeThreshold,
      neutralConfidenceMultiplier: this.neutralConfidenceMultiplier,
      moderateConfidenceMultiplier: this.moderateConfidenceMultiplier,
      distanceNormalizationDivisor: this.distanceNormalizationDivisor,
    });
  }

  /**
   * Get Bollinger Bands values for current state
   *
   * @param candles - Array of candles
   * @returns { upper, middle, lower, percentB, bandwidth }
   * @throws {Error} If not enough candles
   */
  getBollingerBandsValues(candles: Candle[]): {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    bandwidth: number;
  } {
    if (!Array.isArray(candles) || candles.length < this.minCandlesForBollingerBands) {
      throw new Error(
        `[BOLLINGER_BANDS_ANALYZER] Not enough candles for Bollinger Bands calculation`,
      );
    }

    return this.indicator.calculate(candles);
  }

  /**
   * Check if price is near upper band (overbought)
   *
   * @param candles - Array of candles
   * @param threshold - %B threshold for overbought (default 80)
   * @returns true if %B > threshold
   */
  isOverbought(candles: Candle[], threshold: number = this.overboughtThreshold): boolean {
    const values = this.getBollingerBandsValues(candles);
    return values.percentB > threshold;
  }

  /**
   * Check if price is near lower band (oversold)
   *
   * @param candles - Array of candles
   * @param threshold - %B threshold for oversold (default 20)
   * @returns true if %B < threshold
   */
  isOversold(candles: Candle[], threshold: number = this.oversoldThreshold): boolean {
    const values = this.getBollingerBandsValues(candles);
    return values.percentB < threshold;
  }

  /**
   * Check if bands are squeezed (low volatility)
   *
   * @param candles - Array of candles
   * @param threshold - Bandwidth threshold for squeeze (default 5%)
   * @returns true if bandwidth < threshold
   */
  isSqueezing(candles: Candle[], threshold: number = this.squeezeThreshold): boolean {
    const values = this.getBollingerBandsValues(candles);
    return values.bandwidth < threshold;
  }

  /**
   * Check if bands are expanding (high volatility)
   *
   * @param candles - Array of candles
   * @param threshold - Bandwidth threshold for expansion (default 10%)
   * @returns true if bandwidth > threshold
   */
  isExpanding(candles: Candle[], threshold: number = this.expansionThreshold): boolean {
    const values = this.getBollingerBandsValues(candles);
    return values.bandwidth > threshold;
  }

  /**
   * Get volatility classification
   *
   * @param candles - Array of candles
   * @returns Volatility classification
   */
  getVolatilityClass(
    candles: Candle[],
  ): 'very_low' | 'low' | 'normal' | 'high' | 'very_high' {
    const values = this.getBollingerBandsValues(candles);
    const bw = values.bandwidth;

    if (bw < this.volatilityVeryLowThreshold) return 'very_low';
    if (bw < this.volatilityLowThreshold) return 'low';
    if (bw < this.volatilityNormalThreshold) return 'normal';
    if (bw < this.volatilityHighThreshold) return 'high';
    return 'very_high';
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
      period: number;
      stdDev: number;
    };
  } {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      lastSignal: this.lastSignal,
      config: {
        weight: this.weight,
        priority: this.priority,
        period: this.period,
        stdDev: this.stdDev,
      },
    };
  }

  // ===== INTERFACE IMPLEMENTATION (IAnalyzer) =====

  /**
   * Get analyzer type name
   * @returns AnalyzerType.BOLLINGER_BANDS
   */
  getType(): string {
    return AnalyzerType.BOLLINGER_BANDS;
  }

  /**
   * Check if analyzer has enough data
   * @param candles Array of candles
   * @returns true if enough candles, false otherwise
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForBollingerBands;
  }

  /**
   * Get minimum candles required for analysis
   * @returns Min candle count needed
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForBollingerBands;
  }

  /**
   * Get analyzer weight (contribution to final decision)
   * @returns Weight 0.0-1.0
   */
  getWeight(): number {
    return this.weight;
  }

  /**
   * Get analyzer priority (execution order)
   * @returns Priority 1-10 (higher = more important)
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Get maximum confidence this analyzer can produce
   * @returns Max confidence 0.0-1.0
   */
  getMaxConfidence(): number {
    return this.maxConfidence;
  }


  /**
   * Reset analyzer state
   */
  reset(): void {
    this.indicator.reset();
    this.lastSignal = null;
    this.lastBandwidth = 0;
    this.initialized = false;
  }

  /**
   * Check if analyzer is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get config values
   */
  getConfig(): {
    enabled: boolean;
    weight: number;
    priority: number;
    period: number;
    stdDev: number;
  } {
    return {
      enabled: this.enabled,
      weight: this.weight,
      priority: this.priority,
      period: this.period,
      stdDev: this.stdDev,
    };
  }
}

