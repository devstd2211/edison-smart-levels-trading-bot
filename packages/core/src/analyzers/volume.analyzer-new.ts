/**
 * Volume Analyzer NEW - with ConfigNew Support
 * Generates trading signals based on volume strength
 *
 * Signal Logic (strength is 0-100 scale):
 * - Volume strength > 65: High volume confirms trend (LONG signal)
 * - Volume strength < 35: Low volume, no confirmation (SHORT signal)
 * - 35 <= strength <= 65: Neutral volume (HOLD signal)
 *
 * Confidence Calculation:
 * - High strength: confidence = (strength - 65) / 35 * maxConfidence
 * - Low strength: confidence = (65 - strength) / 65 * maxConfidence
 * - Neutral: confidence = neutralConfidence (user-configured, typically low)
 * - Clamped to [0.1, maxConfidence]
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { VolumeAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { VolumeIndicatorNew } from '../indicators/volume.indicator-new';
import type { LoggerService } from '../services/logger.service';
import type { IIndicator } from '../types/indicator';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';

// ============================================================================
// DEFAULT CONSTANTS (configurable via constructor)
// ============================================================================

const DEFAULT_MIN_CANDLES_FOR_VOLUME = 20; // Need at least period for volume calculation
const DEFAULT_MIN_CONFIDENCE = 0.1; // Minimum confidence floor (10%)
const DEFAULT_HIGH_STRENGTH_THRESHOLD = 65; // 0-100 scale
const DEFAULT_LOW_STRENGTH_THRESHOLD = 35; // 0-100 scale
const DEFAULT_MAX_CONFIDENCE = 0.95; // Maximum confidence ceiling (95%)
const DEFAULT_INDICATOR_PERIOD = 14; // Standard volume period for fallback indicator

// ============================================================================
// VOLUME ANALYZER - NEW VERSION
// ============================================================================

export class VolumeAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly neutralConfidence: number;

  // Configurable parameters
  private readonly minCandlesForVolume: number;
  private readonly minConfidence: number;
  private readonly highStrengthThreshold: number;
  private readonly lowStrengthThreshold: number;
  private readonly maxConfidence: number;
  private readonly indicatorPeriod: number;

  private indicator: VolumeIndicatorNew;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  /**
   * Constructor with ConfigNew
   * STRICT - Throws if config is invalid
   *
   * @param config Analyzer configuration (with optional calibration params)
   * @param logger Logger service (optional)
   * @param indicatorDI Volume indicator instance via DI (optional, will create if not provided)
   */
  constructor(
    config: VolumeAnalyzerConfigNew & {
      minCandlesForVolume?: number;
      minConfidence?: number;
      highStrengthThreshold?: number;
      lowStrengthThreshold?: number;
      maxConfidence?: number;
      indicatorPeriod?: number;
    },
    private logger?: LoggerService,
    indicatorDI?: IIndicator | null,
  ) {
    // Validate analyzer config
    if (typeof config.enabled !== 'boolean') {
      throw new Error('[VOLUME_ANALYZER] Missing or invalid: enabled (boolean)');
    }
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) {
      throw new Error('[VOLUME_ANALYZER] Missing or invalid: weight (0.0-1.0)');
    }
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
      throw new Error('[VOLUME_ANALYZER] Missing or invalid: priority (1-10)');
    }
    if (typeof config.neutralConfidence !== 'number' || config.neutralConfidence < 0 || config.neutralConfidence > 1) {
      throw new Error('[VOLUME_ANALYZER] Missing or invalid: neutralConfidence (0.0-1.0)');
    }

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.neutralConfidence = config.neutralConfidence;

    // Initialize configurable parameters with defaults
    this.minCandlesForVolume = config.minCandlesForVolume ?? DEFAULT_MIN_CANDLES_FOR_VOLUME;
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.highStrengthThreshold = config.highStrengthThreshold ?? DEFAULT_HIGH_STRENGTH_THRESHOLD;
    this.lowStrengthThreshold = config.lowStrengthThreshold ?? DEFAULT_LOW_STRENGTH_THRESHOLD;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.indicatorPeriod = config.indicatorPeriod ?? DEFAULT_INDICATOR_PERIOD;

    // Use injected indicator if provided (DI), otherwise create new one
    if (indicatorDI && indicatorDI instanceof VolumeIndicatorNew) {
      this.indicator = indicatorDI;
      this.logger?.info('[VOLUME_ANALYZER] Using injected Volume indicator via DI');
    } else {
      // Fallback: Create Volume indicator with configured period
      this.logger?.info(`[VOLUME_ANALYZER] Creating new Volume indicator with period ${this.indicatorPeriod}`);

      this.indicator = new VolumeIndicatorNew({
        enabled: true,
        period: this.indicatorPeriod,
      });
    }
  }

  /**
   * Analyze candles and generate volume signal
   *
   * @param candles - Array of candles
   * @returns AnalyzerSignal with direction, confidence, and weight
   * @throws {Error} If not enabled, not enough candles, or invalid input
   */
  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) {
      throw new Error('[VOLUME_ANALYZER] Analyzer is disabled');
    }

    if (!Array.isArray(candles)) {
      throw new Error('[VOLUME_ANALYZER] Invalid candles input (must be array)');
    }

    if (candles.length < this.minCandlesForVolume) {
      throw new Error(
        `[VOLUME_ANALYZER] Not enough candles. Need ${this.minCandlesForVolume}, got ${candles.length}`,
      );
    }

    // Validate candles
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') {
        throw new Error(`[VOLUME_ANALYZER] Invalid candle at index ${i}`);
      }
    }

    // Calculate volume metrics
    const volumeMetrics = this.indicator.calculate(candles);

    // Determine signal direction based on volume strength
    const direction = this.getDirection(volumeMetrics.strength);

    // Calculate confidence based on volume strength
    const confidence = this.calculateConfidence(volumeMetrics.strength);

    // Create signal
    const signal: AnalyzerSignal = {
      source: 'VOLUME_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;

    this.logger?.debug('[VOLUME_ANALYZER] Generated signal', {
      direction,
      confidence,
      strength: volumeMetrics.strength,
      ratio: volumeMetrics.ratio,
    });

    return signal;
  }

  /**
   * Determine signal direction based on volume strength
   *
   * @private
   * @param strength - Volume strength (0-100 scale)
   * @returns SignalDirection (LONG, SHORT, or HOLD)
   */
  private getDirection(strength: number): SignalDirection {
    if (strength > this.highStrengthThreshold) {
      // Strong volume - trend confirmation
      return SignalDirectionEnum.LONG;
    } else if (strength < this.lowStrengthThreshold) {
      // Weak volume - lack of conviction
      return SignalDirectionEnum.SHORT;
    } else {
      // Neutral volume
      return SignalDirectionEnum.HOLD;
    }
  }

  /**
   * Calculate confidence based on volume strength
   *
   * @private
   * @param strength - Volume strength (0-100 scale)
   * @returns Confidence value (0-100 scale)
   */
  private calculateConfidence(strength: number): number {
    let confidence: number;

    if (strength > this.highStrengthThreshold) {
      // High strength: increasing confidence as volume gets stronger
      // At threshold: 0%, at 100: maxConfidence
      const normalizedStrength = (strength - this.highStrengthThreshold) / (100 - this.highStrengthThreshold);
      confidence = this.maxConfidence * normalizedStrength;
    } else if (strength < this.lowStrengthThreshold) {
      // Low strength: volume weakness signal
      // At threshold: 0%, at 0: maxConfidence
      const normalizedStrength = (this.lowStrengthThreshold - strength) / this.lowStrengthThreshold;
      confidence = this.maxConfidence * normalizedStrength;
    } else {
      // Neutral zone: use configured neutral confidence
      confidence = this.neutralConfidence;
    }

    // Clamp to configured bounds
    confidence = Math.max(this.minConfidence, Math.min(this.maxConfidence, confidence));

    // Convert to 0-100 scale
    return Math.round(confidence * 100);
  }

  /**
   * Get volume strength for current state
   *
   * @param candles - Array of candles
   * @returns Volume strength (0-1 scale)
   * @throws {Error} If not enough candles
   */
  getVolumeStrength(candles: Candle[]): number {
    if (!Array.isArray(candles) || candles.length < this.minCandlesForVolume) {
      throw new Error(`[VOLUME_ANALYZER] Not enough candles for volume calculation`);
    }

    return this.indicator.calculate(candles).strength;
  }

  /**
   * Check if volume is strong (above threshold)
   *
   * @param candles - Array of candles
   * @param threshold - Strong threshold (default 0.65)
   * @returns true if volume strength > threshold
   */
  isStrongVolume(candles: Candle[], threshold?: number): boolean {
    const strength = this.getVolumeStrength(candles);
    return strength > (threshold ?? this.highStrengthThreshold);
  }

  /**
   * Check if volume is weak (below threshold)
   *
   * @param candles - Array of candles
   * @param threshold - Weak threshold (default from config)
   * @returns true if volume strength < threshold
   */
  isWeakVolume(candles: Candle[], threshold?: number): boolean {
    const strength = this.getVolumeStrength(candles);
    return strength < (threshold ?? this.lowStrengthThreshold);
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
      neutralConfidence: number;
    };
  } {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      lastSignal: this.lastSignal ? { ...this.lastSignal } : null,
      config: {
        weight: this.weight,
        priority: this.priority,
        neutralConfidence: this.neutralConfidence,
      },
    };
  }

  // ===== INTERFACE IMPLEMENTATION (IAnalyzer) =====

  /**
   * Get analyzer type name
   * @returns AnalyzerType.VOLUME
   */
  getType(): string {
    return AnalyzerType.VOLUME;
  }

  /**
   * Check if analyzer has enough data
   * @param candles Array of candles
   * @returns true if enough candles, false otherwise
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForVolume;
  }

  /**
   * Get minimum candles required for analysis
   * @returns Min candle count needed
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForVolume;
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
    neutralConfidence: number;
  } {
    return {
      enabled: this.enabled,
      weight: this.weight,
      priority: this.priority,
      neutralConfidence: this.neutralConfidence,
    };
  }
}

