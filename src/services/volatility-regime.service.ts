/**
 * Volatility Regime Service
 *
 * Detects market volatility regime (LOW/MEDIUM/HIGH) based on ATR percentage.
 * Auto-switches strategy parameters for optimal performance in different conditions.
 *
 * Regimes:
 * - LOW: ATR < 0.3% - Tight ranging, require more touches, smaller distance
 * - MEDIUM: 0.3% <= ATR <= 1.5% - Normal conditions, balanced params
 * - HIGH: ATR > 1.5% - High volatility, fewer touches needed, wider distance
 *
 * Usage:
 * - Call analyze() with current ATR % to get regime and appropriate params
 * - Integrate with LevelBasedStrategy to override params based on regime
 */

import {
  LoggerService,
  VolatilityRegime,
  VolatilityRegimeConfig,
  VolatilityRegimeParams,
  VolatilityRegimeAnalysis,
} from '../types';
import { SessionDetector, TradingSession } from '../utils/session-detector';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LOW_ATR_THRESHOLD = 0.3; // Below this = LOW regime
const DEFAULT_HIGH_ATR_THRESHOLD = 1.5; // Above this = HIGH regime

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_REGIME_PARAMS: Record<VolatilityRegime, VolatilityRegimeParams> = {
  [VolatilityRegime.LOW]: {
    maxDistancePercent: 0.3, // Tighter in low volatility
    minTouchesRequired: 4, // More confirmation needed
    clusterThresholdPercent: 0.15, // Tighter clustering
    minConfidenceThreshold: 0.65, // Higher confidence needed
  },
  [VolatilityRegime.MEDIUM]: {
    maxDistancePercent: 0.6, // Balanced
    minTouchesRequired: 3, // Standard
    clusterThresholdPercent: 0.25, // Standard clustering
    minConfidenceThreshold: 0.55, // Standard confidence
  },
  [VolatilityRegime.HIGH]: {
    maxDistancePercent: 1.2, // Wider in high volatility
    minTouchesRequired: 2, // Faster entries
    clusterThresholdPercent: 0.4, // Wider clustering
    minConfidenceThreshold: 0.5, // Lower threshold, more opportunities
  },
};

const DEFAULT_CONFIG: VolatilityRegimeConfig = {
  enabled: true,
  thresholds: {
    lowAtrPercent: DEFAULT_LOW_ATR_THRESHOLD,
    highAtrPercent: DEFAULT_HIGH_ATR_THRESHOLD,
  },
  regimes: DEFAULT_REGIME_PARAMS,
};

// ============================================================================
// VOLATILITY REGIME SERVICE
// ============================================================================

export class VolatilityRegimeService {
  private config: VolatilityRegimeConfig;
  private lastRegime: VolatilityRegime = VolatilityRegime.MEDIUM;
  private regimeChangeCount: number = 0;

  constructor(
    private logger: LoggerService,
    config?: Partial<VolatilityRegimeConfig>,
  ) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
  }

  /**
   * Merge partial config with defaults (deep merge for nested objects)
   */
  private mergeConfig(
    defaults: VolatilityRegimeConfig,
    overrides?: Partial<VolatilityRegimeConfig>,
  ): VolatilityRegimeConfig {
    if (!overrides) {
      return { ...defaults };
    }

    return {
      enabled: overrides.enabled ?? defaults.enabled,
      thresholds: {
        ...defaults.thresholds,
        ...overrides.thresholds,
      },
      regimes: {
        LOW: { ...defaults.regimes.LOW, ...overrides.regimes?.LOW },
        MEDIUM: { ...defaults.regimes.MEDIUM, ...overrides.regimes?.MEDIUM },
        HIGH: { ...defaults.regimes.HIGH, ...overrides.regimes?.HIGH },
      },
    };
  }

  /**
   * Analyze current volatility and return regime with appropriate params
   *
   * @param atrPercent - Current ATR as percentage of price
   * @returns Volatility regime analysis with params
   */
  analyze(atrPercent: number): VolatilityRegimeAnalysis {
    if (!this.config.enabled) {
      // Return MEDIUM with default params when disabled
      return {
        regime: VolatilityRegime.MEDIUM,
        atrPercent,
        params: this.config.regimes.MEDIUM,
        reason: 'Volatility regime detection disabled',
      };
    }

    // Determine regime based on ATR thresholds
    const regime = this.detectRegime(atrPercent);
    const params = this.config.regimes[regime];

    // Track regime changes
    if (regime !== this.lastRegime) {
      this.regimeChangeCount++;
      this.logger.info('🔄 Volatility regime changed', {
        from: this.lastRegime,
        to: regime,
        atrPercent: atrPercent.toFixed(3),
        changeCount: this.regimeChangeCount,
      });
      this.lastRegime = regime;
    }

    const reason = this.buildReason(regime, atrPercent);

    this.logger.debug('📊 Volatility regime analysis', {
      regime,
      atrPercent: atrPercent.toFixed(3),
      params,
    });

    return {
      regime,
      atrPercent,
      params,
      reason,
    };
  }

  /**
   * Detect volatility regime from ATR percentage
   * Uses session-specific thresholds and hysteresis if enabled
   */
  private detectRegime(atrPercent: number): VolatilityRegime {
    const thresholds = this.getEffectiveThresholds();
    const hysteresis = this.config.hysteresis;

    // Apply hysteresis if enabled
    if (hysteresis?.enabled && hysteresis.bufferPercent > 0) {
      return this.detectRegimeWithHysteresis(atrPercent, thresholds, hysteresis.bufferPercent);
    }

    // Simple threshold detection (no hysteresis)
    if (atrPercent < thresholds.lowAtrPercent) {
      return VolatilityRegime.LOW;
    }

    if (atrPercent > thresholds.highAtrPercent) {
      return VolatilityRegime.HIGH;
    }

    return VolatilityRegime.MEDIUM;
  }

  /**
   * Detect regime with hysteresis to prevent rapid switching
   * Uses different thresholds based on current regime direction
   */
  private detectRegimeWithHysteresis(
    atrPercent: number,
    thresholds: { lowAtrPercent: number; highAtrPercent: number },
    bufferPercent: number,
  ): VolatilityRegime {
    const { lowAtrPercent, highAtrPercent } = thresholds;

    // Calculate buffer sizes
    const lowBuffer = lowAtrPercent * bufferPercent;
    const highBuffer = highAtrPercent * bufferPercent;

    // Current regime determines which thresholds to use
    switch (this.lastRegime) {
      case VolatilityRegime.LOW:
        // To exit LOW, need to cross threshold + buffer (harder to exit)
        if (atrPercent > lowAtrPercent + lowBuffer) {
          // Check if we should go to HIGH
          if (atrPercent > highAtrPercent + highBuffer) {
            return VolatilityRegime.HIGH;
          }
          return VolatilityRegime.MEDIUM;
        }
        return VolatilityRegime.LOW;

      case VolatilityRegime.HIGH:
        // To exit HIGH, need to cross threshold - buffer (harder to exit)
        if (atrPercent < highAtrPercent - highBuffer) {
          // Check if we should go to LOW
          if (atrPercent < lowAtrPercent - lowBuffer) {
            return VolatilityRegime.LOW;
          }
          return VolatilityRegime.MEDIUM;
        }
        return VolatilityRegime.HIGH;

      case VolatilityRegime.MEDIUM:
      default:
        // From MEDIUM, use threshold - buffer to enter extreme regimes (easier to enter)
        if (atrPercent < lowAtrPercent - lowBuffer) {
          return VolatilityRegime.LOW;
        }
        if (atrPercent > highAtrPercent + highBuffer) {
          return VolatilityRegime.HIGH;
        }
        return VolatilityRegime.MEDIUM;
    }
  }

  /**
   * Get effective thresholds based on current session
   * Applies session-specific overrides if enabled
   */
  private getEffectiveThresholds(): { lowAtrPercent: number; highAtrPercent: number } {
    const baseThresholds = this.config.thresholds;

    // Check if session overrides are enabled
    if (!this.config.sessionOverrides?.enabled) {
      return baseThresholds;
    }

    // Get current trading session
    const currentSession = SessionDetector.getCurrentSession();
    const sessionOverride = this.config.sessionOverrides[currentSession];

    if (!sessionOverride) {
      return baseThresholds;
    }

    // Apply session-specific overrides
    return {
      lowAtrPercent: sessionOverride.lowAtrPercent ?? baseThresholds.lowAtrPercent,
      highAtrPercent: sessionOverride.highAtrPercent ?? baseThresholds.highAtrPercent,
    };
  }

  /**
   * Get current session (for logging/debugging)
   */
  getCurrentSession(): TradingSession {
    return SessionDetector.getCurrentSession();
  }

  /**
   * Build human-readable reason string
   */
  private buildReason(regime: VolatilityRegime, atrPercent: number): string {
    const thresholds = this.getEffectiveThresholds();
    const session = this.config.sessionOverrides?.enabled ? ` [${SessionDetector.getCurrentSession()}]` : '';

    switch (regime) {
      case VolatilityRegime.LOW:
        return `LOW volatility (ATR ${atrPercent.toFixed(2)}% < ${thresholds.lowAtrPercent}%)${session}`;
      case VolatilityRegime.HIGH:
        return `HIGH volatility (ATR ${atrPercent.toFixed(2)}% > ${thresholds.highAtrPercent}%)${session}`;
      default:
        return `MEDIUM volatility (${thresholds.lowAtrPercent}% <= ATR ${atrPercent.toFixed(2)}% <= ${thresholds.highAtrPercent}%)${session}`;
    }
  }

  /**
   * Get params for a specific regime (without ATR analysis)
   */
  getParamsForRegime(regime: VolatilityRegime): VolatilityRegimeParams {
    return { ...this.config.regimes[regime] };
  }

  /**
   * Get current regime (last analyzed)
   */
  getCurrentRegime(): VolatilityRegime {
    return this.lastRegime;
  }

  /**
   * Get regime change count (for statistics)
   */
  getRegimeChangeCount(): number {
    return this.regimeChangeCount;
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current configuration
   */
  getConfig(): VolatilityRegimeConfig {
    return {
      enabled: this.config.enabled,
      thresholds: { ...this.config.thresholds },
      regimes: {
        LOW: { ...this.config.regimes.LOW },
        MEDIUM: { ...this.config.regimes.MEDIUM },
        HIGH: { ...this.config.regimes.HIGH },
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VolatilityRegimeConfig>): void {
    this.config = this.mergeConfig(this.config, config);
    this.logger.info('⚙️ Volatility regime config updated', {
      enabled: this.config.enabled,
      thresholds: this.config.thresholds,
    });
  }

  /**
   * Reset state (for testing or session reset)
   */
  reset(): void {
    this.lastRegime = VolatilityRegime.MEDIUM;
    this.regimeChangeCount = 0;
  }

  /**
   * Get service state for debugging/logging
   */
  getState(): {
    enabled: boolean;
    currentRegime: VolatilityRegime;
    regimeChangeCount: number;
    thresholds: { lowAtrPercent: number; highAtrPercent: number };
  } {
    return {
      enabled: this.config.enabled,
      currentRegime: this.lastRegime,
      regimeChangeCount: this.regimeChangeCount,
      thresholds: { ...this.config.thresholds },
    };
  }
}
