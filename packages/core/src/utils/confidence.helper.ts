import { CONFIDENCE_WEIGHTS, MULTIPLIERS, PERCENT_MULTIPLIER, DECIMAL_PLACES } from '../constants';
/**
 * Confidence Helper
 *
 * Centralized utility for confidence calculation and normalization.
 * Ensures consistent confidence handling across all strategies.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CONFIDENCE = 0.3; // 30%
const MAX_CONFIDENCE = MULTIPLIERS.NEUTRAL; // PERCENT_MULTIPLIER%

// ============================================================================
// CONFIDENCE HELPER
// ============================================================================

export class ConfidenceHelper {
  /**
   * Normalize confidence to 0.0-1.0 range
   *
   * Takes a raw confidence value (0.0-1.0+) and:
   * 1. Clamps it between MIN_CONFIDENCE and MAX_CONFIDENCE
   * 2. Returns as decimal (0.3 to 1.0)
   *
   * @param rawConfidence - Raw confidence value (0.0 to 1.0+)
   * @returns Normalized confidence (0.3 to 1.0)
   *
   * @example
   * normalize(0.75) // Returns 0.75
   * normalize(0.2)  // Returns 0.3 (clamped to MIN)
   * normalize(1.5)  // Returns 1.0 (clamped to MAX)
   */
  static normalize(rawConfidence: number): number {
    // Clamp to valid range (0.3 to 1.0)
    return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, rawConfidence));
  }

  /**
   * Check if confidence meets minimum threshold
   *
   * @param confidence - Confidence value (0.0-1.0)
   * @param threshold - Minimum threshold (0.0-1.0, default CONFIDENCE_WEIGHTS.MODERATE)
   * @returns true if confidence >= threshold
   *
   * @example
   * meetsThreshold(0.75, CONFIDENCE_WEIGHTS.MODERATE) // true
   * meetsThreshold(0.45, CONFIDENCE_WEIGHTS.MODERATE) // false
   */
  static meetsThreshold(confidence: number, threshold: number = CONFIDENCE_WEIGHTS.MODERATE): boolean {
    return confidence >= threshold;
  }

  /**
   * Get confidence level category
   *
   * @param confidence - Confidence value (0.0-1.0)
   * @returns 'LOW' | 'MEDIUM' | 'HIGH'
   *
   * @example
   * getLevel(0.35) // 'LOW'
   * getLevel(0.65) // 'MEDIUM'
   * getLevel(0.85) // 'HIGH'
   */
  static getLevel(confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (confidence < CONFIDENCE_WEIGHTS.MODERATE) {
      return 'LOW';
    }
    if (confidence < CONFIDENCE_WEIGHTS.HIGH) {
      return 'MEDIUM';
    }
    return 'HIGH';
  }

  /**
   * Format confidence for display
   *
   * @param confidence - Confidence value (0.0-1.0)
   * @param decimals - Number of decimal places (default 1)
   * @returns Formatted string with % sign
   *
   * @example
   * format(0.755) // '75.5%'
   * format(0.75567, 2) // '75.57%'
   */
  static format(confidence: number, decimals: number = DECIMAL_PLACES.CONFIDENCE): string {
    return `${(confidence * PERCENT_MULTIPLIER).toFixed(decimals)}%`;
  }

  /**
   * Combine multiple confidence scores
   *
   * Useful when a signal has multiple confirmation factors.
   * Uses weighted average if weights provided, otherwise simple average.
   *
   * @param scores - Array of confidence scores (0.0-1.0)
   * @param weights - Optional array of weights (must match scores length)
   * @returns Combined confidence (0.0-1.0)
   *
   * @example
   * combine([CONFIDENCE_WEIGHTS.HIGH, 0.6, 0.7]) // 0.7 (simple average)
   * combine([CONFIDENCE_WEIGHTS.HIGH, 0.6], [2, 1]) // 0.73 (weighted: (CONFIDENCE_WEIGHTS.HIGH*2 + 0.6*1) / 3)
   */
  static combine(scores: number[], weights?: number[]): number {
    if (scores.length === 0) {
      return MIN_CONFIDENCE;
    }

    if (weights && weights.length === scores.length) {
      // Weighted average
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      if (totalWeight === 0) {
        return MIN_CONFIDENCE;
      }

      const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
      return weightedSum / totalWeight;
    }

    // Simple average
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }
}
