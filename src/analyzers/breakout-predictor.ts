import { BREAKOUT_CONSTANTS, CONFIDENCE_BOUNDS, CONFIDENCE_THRESHOLDS, MULTIPLIERS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS } from '../constants';
import { LoggerService } from '../types';

/**
 * Breakout Direction Predictor (BB.MD Section 4.4)
 *
 * Predicts the direction of breakout after Bollinger Bands squeeze.
 * Uses 3 factors:
 * 1. EMA trend direction (fast vs slow)
 * 2. RSI momentum (bullish/bearish bias)
 * 3. Volume strength (accumulation indicator)
 *
 * Returns prediction with confidence score.
 */

export interface BreakoutPredictorConfig {
  rsiLongThreshold: number; // From config.breakoutRetest.rsiLongThreshold
  rsiShortThreshold: number; // From config.breakoutRetest.rsiShortThreshold
}

// ============================================================================
// ENUMS & INTERFACES
// ============================================================================

export enum BreakoutDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export interface BreakoutPrediction {
  direction: BreakoutDirection;
  confidence: number; // 0-100
  factors: {
    emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // 40 points max
    rsiMomentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // 30 points max
    volumeStrength: 'HIGH' | 'MEDIUM' | 'LOW'; // 30 points max
  };
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VOLUME_HIGH_THRESHOLD = BREAKOUT_CONSTANTS.SL_MULTIPLIER; // BREAKOUT_CONSTANTS.SL_MULTIPLIERx average
const VOLUME_MEDIUM_THRESHOLD = MULTIPLIERS.NEUTRAL; // 1.0x average

// Point allocation (TECHNICAL - math constants)
const EMA_POINTS = PERCENTAGE_THRESHOLDS.MODERATE_HIGH;
const RSI_POINTS = PERCENTAGE_THRESHOLDS.MODERATE;
const VOLUME_POINTS = PERCENTAGE_THRESHOLDS.MODERATE;

// ============================================================================
// BREAKOUT PREDICTOR
// ============================================================================

export class BreakoutPredictor {
  private rsiLongThreshold: number;
  private rsiShortThreshold: number;

  constructor(
    private logger: LoggerService,
    config: BreakoutPredictorConfig
  ) {
    this.rsiLongThreshold = config.rsiLongThreshold;
    this.rsiShortThreshold = config.rsiShortThreshold;
  }

  /**
   * Predict breakout direction based on market conditions
   *
   * @param emaFast - Fast EMA value (e.g., EMA20)
   * @param emaSlow - Slow EMA value (e.g., EMA50)
   * @param rsi - RSI value (0-100)
   * @param volumeRatio - Current volume / average volume
   * @returns Breakout prediction with confidence
   */
  predict(
    emaFast: number,
    emaSlow: number,
    rsi: number,
    volumeRatio: number,
  ): BreakoutPrediction {
    // Factor 1: EMA Trend Direction (40 points)
    const emaTrend = this.analyzeEmaTrend(emaFast, emaSlow);
    const emaScore = emaTrend === 'BULLISH' ? EMA_POINTS : emaTrend === 'BEARISH' ? -EMA_POINTS : 0;

    // Factor 2: RSI Momentum (30 points)
    const rsiMomentum = this.analyzeRsiMomentum(rsi);
    const rsiScore =
      rsiMomentum === 'BULLISH' ? RSI_POINTS : rsiMomentum === 'BEARISH' ? -RSI_POINTS : 0;

    // Factor 3: Volume Strength (30 points)
    const volumeStrength = this.analyzeVolumeStrength(volumeRatio);
    const VOLUME_MEDIUM_REDUCTION = MULTIPLIERS.HALF;
    const volumeScore =
      volumeStrength === 'HIGH'
        ? VOLUME_POINTS
        : volumeStrength === 'MEDIUM'
          ? VOLUME_POINTS * VOLUME_MEDIUM_REDUCTION
          : 0;

    // Total score: -100 to +100
    const totalScore = emaScore + rsiScore + volumeScore;

    // Determine direction and confidence
    let direction: BreakoutDirection;
    let confidence: number;

    const CONFIDENCE_BASE = PERCENTAGE_THRESHOLDS.MODERATE_HIGH; // 50
    const CONFIDENCE_DIVISOR = MULTIPLIERS.DOUBLE; // 2
    const BEARISH_THRESHOLD = -PERCENTAGE_THRESHOLDS.MODERATE_HIGH; // -40
    const MAX_CONFIDENCE = CONFIDENCE_BOUNDS.MAXIMUM; // 100

    if (totalScore >= PERCENTAGE_THRESHOLDS.MODERATE_HIGH) {
      // Strong bullish (40-100 points)
      direction = BreakoutDirection.BULLISH;
      confidence = Math.min(MAX_CONFIDENCE, CONFIDENCE_BASE + totalScore / CONFIDENCE_DIVISOR); // 70-100% confidence
    } else if (totalScore <= BEARISH_THRESHOLD) {
      // Strong bearish (-40 to -100 points)
      direction = BreakoutDirection.BEARISH;
      confidence = Math.min(MAX_CONFIDENCE, CONFIDENCE_BASE + Math.abs(totalScore) / CONFIDENCE_DIVISOR); // 70-100% confidence
    } else {
      // Neutral (-39 to +39 points)
      direction = BreakoutDirection.NEUTRAL;
      confidence = CONFIDENCE_THRESHOLDS.MODERATE - Math.abs(totalScore) / CONFIDENCE_DIVISOR; // Lower confidence for neutral
    }

    const reason = this.buildReason(emaTrend, rsiMomentum, volumeStrength, totalScore);

    this.logger.info('🔮 Breakout Direction Predicted', {
      direction,
      confidence: confidence.toFixed(1) + '%',
      totalScore,
      emaTrend,
      rsiMomentum,
      volumeStrength,
    });

    return {
      direction,
      confidence,
      factors: {
        emaTrend,
        rsiMomentum,
        volumeStrength,
      },
      reason,
    };
  }

  /**
   * Analyze EMA trend direction
   */
  private analyzeEmaTrend(emaFast: number, emaSlow: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const diff = ((emaFast - emaSlow) / emaSlow) * PERCENT_MULTIPLIER;

    if (diff > BREAKOUT_CONSTANTS.TP_MODERATE) {
      // Fast > Slow by >BREAKOUT_CONSTANTS.TP_MODERATE%
      return 'BULLISH';
    } else if (diff < -BREAKOUT_CONSTANTS.TP_MODERATE) {
      // Fast < Slow by >BREAKOUT_CONSTANTS.TP_MODERATE%
      return 'BEARISH';
    } else {
      // EMAs too close
      return 'NEUTRAL';
    }
  }

  /**
   * Analyze RSI momentum
   */
  private analyzeRsiMomentum(rsi: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (rsi > this.rsiLongThreshold) {
      return 'BULLISH';
    } else if (rsi < this.rsiShortThreshold) {
      return 'BEARISH';
    } else {
      return 'NEUTRAL';
    }
  }

  /**
   * Analyze volume strength
   */
  private analyzeVolumeStrength(volumeRatio: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (volumeRatio >= VOLUME_HIGH_THRESHOLD) {
      return 'HIGH';
    } else if (volumeRatio >= VOLUME_MEDIUM_THRESHOLD) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Build human-readable reason
   */
  private buildReason(
    emaTrend: string,
    rsiMomentum: string,
    volumeStrength: string,
    totalScore: number,
  ): string {
    const factors = [];

    if (emaTrend === 'BULLISH') {
      factors.push('EMA bullish trend');
    } else if (emaTrend === 'BEARISH') {
      factors.push('EMA bearish trend');
    }

    if (rsiMomentum === 'BULLISH') {
      factors.push('RSI bullish momentum');
    } else if (rsiMomentum === 'BEARISH') {
      factors.push('RSI bearish momentum');
    }

    if (volumeStrength === 'HIGH') {
      factors.push('high volume');
    } else if (volumeStrength === 'MEDIUM') {
      factors.push('medium volume');
    }

    if (factors.length === 0) {
      return `Neutral market (score: ${totalScore})`;
    }

    return factors.join(' + ');
  }
}
