"use strict";
/**
 * Confidence Helper
 *
 * Centralized utility for confidence calculation and normalization.
 * Ensures consistent confidence handling across all strategies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfidenceHelper = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var MIN_CONFIDENCE = 0.3; // 30%
var MAX_CONFIDENCE = 1.0; // 100%
// ============================================================================
// CONFIDENCE HELPER
// ============================================================================
var ConfidenceHelper = /** @class */ (function () {
    function ConfidenceHelper() {
    }
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
    ConfidenceHelper.normalize = function (rawConfidence) {
        // Clamp to valid range (0.3 to 1.0)
        return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, rawConfidence));
    };
    /**
     * Check if confidence meets minimum threshold
     *
     * @param confidence - Confidence value (0.0-1.0)
     * @param threshold - Minimum threshold (0.0-1.0, default 0.5)
     * @returns true if confidence >= threshold
     *
     * @example
     * meetsThreshold(0.75, 0.5) // true
     * meetsThreshold(0.45, 0.5) // false
     */
    ConfidenceHelper.meetsThreshold = function (confidence, threshold) {
        if (threshold === void 0) { threshold = 0.5; }
        return confidence >= threshold;
    };
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
    ConfidenceHelper.getLevel = function (confidence) {
        if (confidence < 0.5)
            return 'LOW';
        if (confidence < 0.8)
            return 'MEDIUM';
        return 'HIGH';
    };
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
    ConfidenceHelper.format = function (confidence, decimals) {
        if (decimals === void 0) { decimals = 1; }
        return "".concat((confidence * 100).toFixed(decimals), "%");
    };
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
     * combine([0.8, 0.6, 0.7]) // 0.7 (simple average)
     * combine([0.8, 0.6], [2, 1]) // 0.73 (weighted: (0.8*2 + 0.6*1) / 3)
     */
    ConfidenceHelper.combine = function (scores, weights) {
        if (scores.length === 0)
            return MIN_CONFIDENCE;
        if (weights && weights.length === scores.length) {
            // Weighted average
            var totalWeight = weights.reduce(function (sum, w) { return sum + w; }, 0);
            if (totalWeight === 0)
                return MIN_CONFIDENCE;
            var weightedSum = scores.reduce(function (sum, score, i) { return sum + score * weights[i]; }, 0);
            return weightedSum / totalWeight;
        }
        // Simple average
        var sum = scores.reduce(function (acc, score) { return acc + score; }, 0);
        return sum / scores.length;
    };
    return ConfidenceHelper;
}());
exports.ConfidenceHelper = ConfidenceHelper;
