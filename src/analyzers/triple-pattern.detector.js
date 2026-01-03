"use strict";
/**
 * Triple Top/Bottom Pattern Detector
 *
 * Detects triple top (bearish) and triple bottom (bullish) reversal patterns.
 * These are stronger reversal signals than double patterns - 3 failed attempts
 * to break a level indicates strong resistance/support.
 *
 * Triple Top:
 *  Peak1  Peak2  Peak3
 *    |     |     |      → 3 peaks at same level
 *    |_____|_____|      → break neckline = SHORT
 *
 * Triple Bottom:
 *     ______               ← Neckline
 *    /  |  \
 * Bot1 Bot2 Bot3          → 3 bottoms at same level = LONG
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriplePatternDetector = exports.TriplePatternType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var TriplePatternType;
(function (TriplePatternType) {
    TriplePatternType["TRIPLE_TOP"] = "TRIPLE_TOP";
    TriplePatternType["TRIPLE_BOTTOM"] = "TRIPLE_BOTTOM";
    TriplePatternType["NONE"] = "NONE";
})(TriplePatternType || (exports.TriplePatternType = TriplePatternType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var BASE_CONFIDENCE = 70; // Higher than double patterns (3 tests > 2 tests)
var PEAK_TOLERANCE_PERCENT = 3.0; // Peaks/bottoms must be within ±3%
var MIN_PATTERN_BARS = 20; // Minimum timespan
var MAX_PATTERN_BARS = 150; // Maximum timespan
// ============================================================================
// TRIPLE PATTERN DETECTOR
// ============================================================================
var TriplePatternDetector = /** @class */ (function () {
    function TriplePatternDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect triple pattern from swing points
     * @param swingPoints - Array of swing points (minimum 5 required)
     * @returns TriplePattern result
     */
    TriplePatternDetector.prototype.detect = function (swingPoints) {
        if (swingPoints.length < 5) {
            return this.noPattern('Not enough swing points (need 5+)');
        }
        // Try triple top
        var tripleTop = this.detectTripleTop(swingPoints);
        if (tripleTop.detected) {
            return tripleTop;
        }
        // Try triple bottom
        var tripleBottom = this.detectTripleBottom(swingPoints);
        if (tripleBottom.detected) {
            return tripleBottom;
        }
        return this.noPattern('No triple pattern detected');
    };
    /**
     * Detect Triple Top pattern
     * Structure: HIGH, LOW, HIGH, LOW, HIGH
     * All 3 HIGHs should be at approximately same level (±3%)
     */
    TriplePatternDetector.prototype.detectTripleTop = function (swingPoints) {
        var recent = swingPoints.slice(-10); // Look at last 10 swing points
        // Search for pattern: HIGH, LOW, HIGH, LOW, HIGH
        for (var i = 0; i <= recent.length - 5; i++) {
            var peak1 = recent[i];
            var valley1 = recent[i + 1];
            var peak2 = recent[i + 2];
            var valley2 = recent[i + 3];
            var peak3 = recent[i + 4];
            // Validate structure: HIGH -> LOW -> HIGH -> LOW -> HIGH
            if (peak1.type !== types_1.SwingPointType.HIGH ||
                valley1.type !== types_1.SwingPointType.LOW ||
                peak2.type !== types_1.SwingPointType.HIGH ||
                valley2.type !== types_1.SwingPointType.LOW ||
                peak3.type !== types_1.SwingPointType.HIGH) {
                continue;
            }
            // Validate: all 3 peaks at approximately same level (±3%)
            var avgPeak = (peak1.price + peak2.price + peak3.price) / 3;
            var peak1Diff = Math.abs((peak1.price - avgPeak) / avgPeak) * 100;
            var peak2Diff = Math.abs((peak2.price - avgPeak) / avgPeak) * 100;
            var peak3Diff = Math.abs((peak3.price - avgPeak) / avgPeak) * 100;
            if (peak1Diff > PEAK_TOLERANCE_PERCENT ||
                peak2Diff > PEAK_TOLERANCE_PERCENT ||
                peak3Diff > PEAK_TOLERANCE_PERCENT) {
                continue; // Peaks too different
            }
            // Validate: valleys should be lower than peaks
            if (valley1.price >= peak1.price || valley2.price >= peak2.price) {
                continue;
            }
            // Check pattern timespan
            var patternMinutes = (peak3.timestamp - peak1.timestamp) / 60000;
            if (patternMinutes < MIN_PATTERN_BARS || patternMinutes > MAX_PATTERN_BARS) {
                continue; // Pattern too short or too long
            }
            // Calculate pattern metrics
            var neckline = (valley1.price + valley2.price) / 2;
            var patternHeight = avgPeak - neckline;
            var target = neckline - patternHeight; // Project downward
            var stopLoss = avgPeak + patternHeight * 0.15; // 15% above peaks
            // Calculate confidence
            var maxDiff = Math.max(peak1Diff, peak2Diff, peak3Diff);
            var confidence = BASE_CONFIDENCE + (3.0 - maxDiff) * 5; // Bonus for closer peaks
            return {
                detected: true,
                type: TriplePatternType.TRIPLE_TOP,
                direction: 'SHORT',
                confidence: Math.min(100, confidence),
                neckline: neckline,
                target: target,
                stopLoss: stopLoss,
                points: [peak1, valley1, peak2, valley2, peak3],
                explanation: "Triple Top: peaks ".concat(peak1.price.toFixed(4), "/").concat(peak2.price.toFixed(4), "/").concat(peak3.price.toFixed(4), ", neckline ").concat(neckline.toFixed(4)),
            };
        }
        return this.noPattern('No valid Triple Top pattern');
    };
    /**
     * Detect Triple Bottom pattern
     * Structure: LOW, HIGH, LOW, HIGH, LOW
     * All 3 LOWs should be at approximately same level (±3%)
     */
    TriplePatternDetector.prototype.detectTripleBottom = function (swingPoints) {
        var recent = swingPoints.slice(-10);
        // Search for pattern: LOW, HIGH, LOW, HIGH, LOW
        for (var i = 0; i <= recent.length - 5; i++) {
            var bottom1 = recent[i];
            var peak1 = recent[i + 1];
            var bottom2 = recent[i + 2];
            var peak2 = recent[i + 3];
            var bottom3 = recent[i + 4];
            // Validate structure: LOW -> HIGH -> LOW -> HIGH -> LOW
            if (bottom1.type !== types_1.SwingPointType.LOW ||
                peak1.type !== types_1.SwingPointType.HIGH ||
                bottom2.type !== types_1.SwingPointType.LOW ||
                peak2.type !== types_1.SwingPointType.HIGH ||
                bottom3.type !== types_1.SwingPointType.LOW) {
                continue;
            }
            // Validate: all 3 bottoms at approximately same level (±3%)
            var avgBottom = (bottom1.price + bottom2.price + bottom3.price) / 3;
            var bottom1Diff = Math.abs((bottom1.price - avgBottom) / avgBottom) * 100;
            var bottom2Diff = Math.abs((bottom2.price - avgBottom) / avgBottom) * 100;
            var bottom3Diff = Math.abs((bottom3.price - avgBottom) / avgBottom) * 100;
            if (bottom1Diff > PEAK_TOLERANCE_PERCENT ||
                bottom2Diff > PEAK_TOLERANCE_PERCENT ||
                bottom3Diff > PEAK_TOLERANCE_PERCENT) {
                continue; // Bottoms too different
            }
            // Validate: peaks should be higher than bottoms
            if (peak1.price <= bottom1.price || peak2.price <= bottom2.price) {
                continue;
            }
            // Check pattern timespan
            var patternMinutes = (bottom3.timestamp - bottom1.timestamp) / 60000;
            if (patternMinutes < MIN_PATTERN_BARS || patternMinutes > MAX_PATTERN_BARS) {
                continue;
            }
            // Calculate pattern metrics
            var neckline = (peak1.price + peak2.price) / 2;
            var patternHeight = neckline - avgBottom;
            var target = neckline + patternHeight; // Project upward
            var stopLoss = avgBottom - patternHeight * 0.15; // 15% below bottoms
            // Calculate confidence
            var maxDiff = Math.max(bottom1Diff, bottom2Diff, bottom3Diff);
            var confidence = BASE_CONFIDENCE + (3.0 - maxDiff) * 5;
            return {
                detected: true,
                type: TriplePatternType.TRIPLE_BOTTOM,
                direction: 'LONG',
                confidence: Math.min(100, confidence),
                neckline: neckline,
                target: target,
                stopLoss: stopLoss,
                points: [bottom1, peak1, bottom2, peak2, bottom3],
                explanation: "Triple Bottom: bottoms ".concat(bottom1.price.toFixed(4), "/").concat(bottom2.price.toFixed(4), "/").concat(bottom3.price.toFixed(4), ", neckline ").concat(neckline.toFixed(4)),
            };
        }
        return this.noPattern('No valid Triple Bottom pattern');
    };
    /**
     * Return no pattern result
     */
    TriplePatternDetector.prototype.noPattern = function (reason) {
        return {
            detected: false,
            type: TriplePatternType.NONE,
            direction: 'LONG',
            confidence: 0,
            neckline: 0,
            target: 0,
            stopLoss: 0,
            points: [],
            explanation: reason,
        };
    };
    return TriplePatternDetector;
}());
exports.TriplePatternDetector = TriplePatternDetector;
