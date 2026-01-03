/**
 * Sweep Detector (Liquidity Grab Detection)
 *
 * Detects sweep/liquidity grab events where price briefly penetrates
 * a support/resistance level then quickly reverses.
 *
 * BULLISH_SWEEP: Price dips below support, triggers stops, then recovers
 * - Long wick below support level
 * - Candle closes back above support
 * - Often accompanied by volume spike
 * - Bullish signal: shorts trapped, buyers stepping in
 *
 * BEARISH_SWEEP: Price spikes above resistance, triggers stops, then drops
 * - Long wick above resistance level
 * - Candle closes back below resistance
 * - Often accompanied by volume spike
 * - Bearish signal: longs trapped, sellers stepping in
 *
 * Usage:
 * - Confirm entry direction after sweep
 * - Trail SL to sweep price + buffer (lock in micro-profit/breakeven)
 * - Boost confidence when sweep aligns with position direction
 */

import {
  Candle,
  LoggerService,
  SweepDetectorConfig,
  SweepEvent,
  SweepType,
  SweepAnalysis,
} from '../types';

// Default configuration
const DEFAULT_CONFIG: SweepDetectorConfig = {
  enabled: true,
  minWickPercent: 0.1,           // Min 0.1% wick beyond level
  minRecoveryPercent: 50,        // Min 50% recovery from sweep
  volumeSpikeMultiplier: 1.5,    // Volume 1.5x average = spike
  lookbackCandles: 20,           // Look back 20 candles for volume avg
  maxSweepAgeCandles: 3,         // Consider sweeps from last 3 candles
  trailSlOnSweep: true,          // Trail SL after sweep
  trailSlBufferPercent: 0.1,     // 0.1% buffer from sweep price
};

// Constants
const PERCENT_MULTIPLIER = 100;
const DECIMAL_PLACES = {
  PRICE: 4,
  PERCENT: 2,
};

/**
 * Sweep Detector
 * Detects liquidity grabs / stop hunts at support/resistance levels
 */
export class SweepDetector {
  private config: SweepDetectorConfig;
  private recentSweeps: SweepEvent[] = [];

  constructor(
    private logger: LoggerService,
    config?: Partial<SweepDetectorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze candles for sweep events near given levels
   * @param candles Recent candles (newest last)
   * @param supportLevels Support level prices
   * @param resistanceLevels Resistance level prices
   * @param direction Position direction to check sweeps for (optional)
   * @returns Sweep analysis result
   */
  analyze(
    candles: Candle[],
    supportLevels: number[],
    resistanceLevels: number[],
    direction?: 'LONG' | 'SHORT',
  ): SweepAnalysis {
    if (!this.config.enabled || candles.length < this.config.lookbackCandles) {
      return this.noSweep();
    }

    // Calculate average volume for spike detection
    const avgVolume = this.calculateAverageVolume(candles);

    // Check recent candles for sweep events
    const sweepsFound: SweepEvent[] = [];
    const checkCandles = candles.slice(-this.config.maxSweepAgeCandles);

    for (let i = 0; i < checkCandles.length; i++) {
      const candle = checkCandles[i];
      const candleIndex = candles.length - this.config.maxSweepAgeCandles + i;

      // Check for bullish sweep (sweep below support)
      for (const supportPrice of supportLevels) {
        const sweep = this.detectBullishSweep(candle, supportPrice, avgVolume, candleIndex);
        if (sweep) {
          sweepsFound.push(sweep);
        }
      }

      // Check for bearish sweep (sweep above resistance)
      for (const resistancePrice of resistanceLevels) {
        const sweep = this.detectBearishSweep(candle, resistancePrice, avgVolume, candleIndex);
        if (sweep) {
          sweepsFound.push(sweep);
        }
      }
    }

    // Update recent sweeps cache
    this.recentSweeps = sweepsFound;

    // Find the most relevant sweep for the given direction
    let relevantSweep: SweepEvent | null = null;
    if (direction) {
      relevantSweep = this.findRelevantSweep(sweepsFound, direction);
    } else if (sweepsFound.length > 0) {
      // Return the strongest sweep if no direction specified
      relevantSweep = sweepsFound.reduce((best, current) =>
        current.strength > best.strength ? current : best,
      );
    }

    // Calculate suggested SL and confidence boost
    const suggestedSL = this.calculateSuggestedSL(relevantSweep, direction);
    const confidenceBoost = this.calculateConfidenceBoost(relevantSweep, direction);

    if (relevantSweep) {
      this.logger.info('🎯 Sweep detected', {
        type: relevantSweep.type,
        levelPrice: relevantSweep.levelPrice.toFixed(DECIMAL_PLACES.PRICE),
        sweepPrice: relevantSweep.sweepPrice.toFixed(DECIMAL_PLACES.PRICE),
        wickPercent: relevantSweep.wickPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        recoveryPercent: relevantSweep.recoveryPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        strength: relevantSweep.strength.toFixed(DECIMAL_PLACES.PERCENT),
        volumeSpike: relevantSweep.volumeSpike,
        suggestedSL: suggestedSL?.toFixed(DECIMAL_PLACES.PRICE) ?? 'none',
        confidenceBoost: (confidenceBoost * PERCENT_MULTIPLIER).toFixed(0) + '%',
      });
    }

    return {
      hasSweep: relevantSweep !== null,
      sweep: relevantSweep,
      recentSweeps: sweepsFound,
      suggestedSL,
      confidenceBoost,
    };
  }

  /**
   * Detect bullish sweep (price dips below support then recovers)
   */
  private detectBullishSweep(
    candle: Candle,
    supportPrice: number,
    avgVolume: number,
    candleIndex: number,
  ): SweepEvent | null {
    // Check if wick goes below support but close is above
    if (candle.low >= supportPrice || candle.close < supportPrice) {
      return null;
    }

    // Calculate wick penetration
    const wickBelowLevel = supportPrice - candle.low;
    const wickPercent = (wickBelowLevel / supportPrice) * PERCENT_MULTIPLIER;

    if (wickPercent < this.config.minWickPercent) {
      return null;
    }

    // Calculate recovery (how much price recovered from the sweep)
    const totalWick = candle.close - candle.low;
    const recoveryPercent = totalWick > 0
      ? ((candle.close - candle.low) / (supportPrice - candle.low + totalWick)) * PERCENT_MULTIPLIER
      : 0;

    if (recoveryPercent < this.config.minRecoveryPercent) {
      return null;
    }

    // Check for volume spike
    const volumeSpike = candle.volume > avgVolume * this.config.volumeSpikeMultiplier;

    // Calculate sweep strength (0-1)
    const strength = this.calculateSweepStrength(wickPercent, recoveryPercent, volumeSpike);

    return {
      type: SweepType.BULLISH_SWEEP,
      sweepPrice: candle.low,
      recoveryPrice: candle.close,
      levelPrice: supportPrice,
      levelType: 'SUPPORT',
      timestamp: candle.timestamp,
      strength,
      wickPercent,
      recoveryPercent,
      volumeSpike,
      candleIndex,
    };
  }

  /**
   * Detect bearish sweep (price spikes above resistance then drops)
   */
  private detectBearishSweep(
    candle: Candle,
    resistancePrice: number,
    avgVolume: number,
    candleIndex: number,
  ): SweepEvent | null {
    // Check if wick goes above resistance but close is below
    if (candle.high <= resistancePrice || candle.close > resistancePrice) {
      return null;
    }

    // Calculate wick penetration
    const wickAboveLevel = candle.high - resistancePrice;
    const wickPercent = (wickAboveLevel / resistancePrice) * PERCENT_MULTIPLIER;

    if (wickPercent < this.config.minWickPercent) {
      return null;
    }

    // Calculate recovery (how much price dropped from the sweep)
    const totalWick = candle.high - candle.close;
    const recoveryPercent = totalWick > 0
      ? ((candle.high - candle.close) / (candle.high - resistancePrice + totalWick)) * PERCENT_MULTIPLIER
      : 0;

    if (recoveryPercent < this.config.minRecoveryPercent) {
      return null;
    }

    // Check for volume spike
    const volumeSpike = candle.volume > avgVolume * this.config.volumeSpikeMultiplier;

    // Calculate sweep strength (0-1)
    const strength = this.calculateSweepStrength(wickPercent, recoveryPercent, volumeSpike);

    return {
      type: SweepType.BEARISH_SWEEP,
      sweepPrice: candle.high,
      recoveryPrice: candle.close,
      levelPrice: resistancePrice,
      levelType: 'RESISTANCE',
      timestamp: candle.timestamp,
      strength,
      wickPercent,
      recoveryPercent,
      volumeSpike,
      candleIndex,
    };
  }

  /**
   * Calculate sweep strength (0-1)
   */
  private calculateSweepStrength(
    wickPercent: number,
    recoveryPercent: number,
    volumeSpike: boolean,
  ): number {
    // Base strength from wick size (0-0.4)
    const wickScore = Math.min(wickPercent / 0.5, 1) * 0.4;

    // Recovery score (0-0.4)
    const recoveryScore = (recoveryPercent / 100) * 0.4;

    // Volume spike bonus (0-0.2)
    const volumeScore = volumeSpike ? 0.2 : 0;

    return Math.min(wickScore + recoveryScore + volumeScore, 1);
  }

  /**
   * Calculate average volume from candles
   */
  private calculateAverageVolume(candles: Candle[]): number {
    const lookback = Math.min(this.config.lookbackCandles, candles.length);
    const recentCandles = candles.slice(-lookback);
    const totalVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0);
    return totalVolume / recentCandles.length;
  }

  /**
   * Find the most relevant sweep for the given direction
   */
  private findRelevantSweep(sweeps: SweepEvent[], direction: 'LONG' | 'SHORT'): SweepEvent | null {
    // For LONG: bullish sweep is relevant (sweep below support = bullish)
    // For SHORT: bearish sweep is relevant (sweep above resistance = bearish)
    const relevantType = direction === 'LONG' ? SweepType.BULLISH_SWEEP : SweepType.BEARISH_SWEEP;

    const relevantSweeps = sweeps.filter(s => s.type === relevantType);

    if (relevantSweeps.length === 0) {
      return null;
    }

    // Return the strongest relevant sweep
    return relevantSweeps.reduce((best, current) =>
      current.strength > best.strength ? current : best,
    );
  }

  /**
   * Calculate suggested SL based on sweep
   * For LONG: SL just below sweep low
   * For SHORT: SL just above sweep high
   */
  private calculateSuggestedSL(
    sweep: SweepEvent | null,
    direction?: 'LONG' | 'SHORT',
  ): number | null {
    if (!sweep || !this.config.trailSlOnSweep) {
      return null;
    }

    const buffer = sweep.sweepPrice * (this.config.trailSlBufferPercent / PERCENT_MULTIPLIER);

    if (direction === 'LONG' && sweep.type === SweepType.BULLISH_SWEEP) {
      // For LONG after bullish sweep: SL below the sweep low
      return sweep.sweepPrice - buffer;
    } else if (direction === 'SHORT' && sweep.type === SweepType.BEARISH_SWEEP) {
      // For SHORT after bearish sweep: SL above the sweep high
      return sweep.sweepPrice + buffer;
    }

    return null;
  }

  /**
   * Calculate confidence boost from sweep (0-0.15)
   */
  private calculateConfidenceBoost(
    sweep: SweepEvent | null,
    direction?: 'LONG' | 'SHORT',
  ): number {
    if (!sweep) {
      return 0;
    }

    // Check if sweep aligns with direction
    const isAligned =
      (direction === 'LONG' && sweep.type === SweepType.BULLISH_SWEEP) ||
      (direction === 'SHORT' && sweep.type === SweepType.BEARISH_SWEEP);

    if (!isAligned) {
      return 0;
    }

    // Max 15% boost based on sweep strength
    return sweep.strength * 0.15;
  }

  /**
   * Get recent sweeps
   */
  getRecentSweeps(): SweepEvent[] {
    return this.recentSweeps;
  }

  /**
   * Check if there was a recent bullish sweep
   */
  hasRecentBullishSweep(): boolean {
    return this.recentSweeps.some(s => s.type === SweepType.BULLISH_SWEEP);
  }

  /**
   * Check if there was a recent bearish sweep
   */
  hasRecentBearishSweep(): boolean {
    return this.recentSweeps.some(s => s.type === SweepType.BEARISH_SWEEP);
  }

  /**
   * Return empty sweep analysis
   */
  private noSweep(): SweepAnalysis {
    return {
      hasSweep: false,
      sweep: null,
      recentSweeps: [],
      suggestedSL: null,
      confidenceBoost: 0,
    };
  }
}
