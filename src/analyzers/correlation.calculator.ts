import { CONFIDENCE_THRESHOLDS, MULTIPLIERS, PERCENT_MULTIPLIER, THRESHOLD_VALUES } from '../constants';
import { formatToDecimal, DECIMAL_PLACES, INTEGER_MULTIPLIERS } from '../constants/technical.constants';
/**
 * Correlation Calculator
 *
 * Calculates rolling Pearson correlation between BTC and altcoin price movements.
 * Used to dynamically adjust BTC filter strength based on correlation.
 *
 * High correlation (>0.7) → Strict BTC filter
 * Medium correlation (0.4-0.7) → Moderate BTC filter
 * Low correlation (<0.4) → Weak/skip BTC filter
 */

import { Candle } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Correlation strength thresholds (technical - for pattern detection)
const CORRELATION_STRONG = THRESHOLD_VALUES.SEVENTY_PERCENT;      // >= 0.7 → Strong correlation
const CORRELATION_MODERATE = THRESHOLD_VALUES.FORTY_PERCENT;      // >= 0.4 → Moderate correlation
const CORRELATION_WEAK = THRESHOLD_VALUES.TWENTY_PERCENT;         // >= 0.2 → Weak correlation
const CORRELATION_FILTER_BOUNDARY = THRESHOLD_VALUES.THIRTY_PERCENT; // >= 0.3 → Weak filter threshold

// ============================================================================
// TYPES
// ============================================================================

export interface CorrelationResult {
  coefficient: number; // Pearson correlation coefficient (-1 to 1)
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'; // Correlation strength
  filterStrength: 'STRICT' | 'MODERATE' | 'WEAK' | 'SKIP'; // Recommended filter strength
  sampleSize: number; // Number of data points used
  btcVolatility: number; // BTC price volatility (%)
  altVolatility: number; // Altcoin price volatility (%)
}

// ============================================================================
// CORRELATION CALCULATOR
// ============================================================================

export class CorrelationCalculator {
  /**
   * Calculate Pearson correlation between BTC and altcoin
   *
   * @param btcCandles - BTC candles (must be same length as altCandles)
   * @param altCandles - Altcoin candles (must be same length as btcCandles)
   * @param period - Rolling window size (default 50)
   * @returns Correlation result
   */
  calculate(
    btcCandles: Candle[],
    altCandles: Candle[],
    period: number = CONFIDENCE_THRESHOLDS.MODERATE,
  ): CorrelationResult | null {
    // Validate inputs
    if (btcCandles.length !== altCandles.length) {
      return null;
    }

    if (btcCandles.length < period) {
      return null;
    }

    // Take last N candles
    const btcWindow = btcCandles.slice(-period);
    const altWindow = altCandles.slice(-period);

    // Calculate price changes (returns)
    const btcReturns = this.calculateReturns(btcWindow);
    const altReturns = this.calculateReturns(altWindow);

    // Calculate Pearson correlation
    const coefficient = this.pearsonCorrelation(btcReturns, altReturns);

    // Determine strength
    const strength = this.determineStrength(coefficient);

    // Determine recommended filter strength
    const filterStrength = this.determineFilterStrength(coefficient);

    // Calculate volatilities
    const btcVolatility = this.calculateVolatility(btcReturns);
    const altVolatility = this.calculateVolatility(altReturns);

    return {
      coefficient,
      strength,
      filterStrength,
      sampleSize: period,
      btcVolatility,
      altVolatility,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Calculate price returns (percentage changes)
   */
  private calculateReturns(candles: Candle[]): number[] {
    const returns: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      const currClose = candles[i].close;
      const change = (currClose - prevClose) / prevClose;
      returns.push(change);
    }

    return returns;
  }

  /**
   * Calculate Pearson correlation coefficient
   *
   * Formula: r = Σ[(x - x̄)(y - ȳ)] / √[Σ(x - x̄)² * Σ(y - ȳ)²]
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }

    const n = x.length;

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate components
    let numerator = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;

      numerator += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }

    // Calculate correlation
    const denominator = Math.sqrt(xVariance * yVariance);

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) {
      return 0;
    }

    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const variance =
      returns.reduce((sum, val) => sum + Math.pow(val - mean, INTEGER_MULTIPLIERS.TWO), 0) / returns.length;

    return Math.sqrt(variance) * PERCENT_MULTIPLIER; // Convert to percentage
  }

  /**
   * Determine correlation strength
   */
  private determineStrength(coefficient: number): 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' {
    const abs = Math.abs(coefficient);

    if (abs >= CORRELATION_STRONG) {
      return 'STRONG';
    } else if (abs >= CORRELATION_MODERATE) {
      return 'MODERATE';
    } else if (abs >= CORRELATION_WEAK) {
      return 'WEAK';
    } else {
      return 'NONE';
    }
  }

  /**
   * Determine recommended BTC filter strength based on correlation
   */
  private determineFilterStrength(
    coefficient: number,
  ): 'STRICT' | 'MODERATE' | 'WEAK' | 'SKIP' {
    const abs = Math.abs(coefficient);

    if (abs >= CORRELATION_STRONG) {
      // High correlation - strict BTC filter required
      return 'STRICT';
    } else if (abs >= CORRELATION_MODERATE) {
      // Moderate correlation - moderate BTC filter
      return 'MODERATE';
    } else if (abs >= CORRELATION_FILTER_BOUNDARY) {
      // Low correlation - weak BTC filter
      return 'WEAK';
    } else {
      // Very low/no correlation - skip BTC filter
      return 'SKIP';
    }
  }

  /**
   * Get human-readable description of correlation
   */
  getDescription(result: CorrelationResult): string {
    const sign = result.coefficient >= 0 ? 'positive' : 'negative';
    const absCoef = Math.abs(result.coefficient);

    return `${result.strength} ${sign} correlation (r=${formatToDecimal(absCoef, DECIMAL_PLACES.CORRELATION)}) - Recommend ${result.filterStrength} BTC filter`;
  }
}
