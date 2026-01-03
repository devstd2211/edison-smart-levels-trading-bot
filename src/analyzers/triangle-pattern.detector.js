"use strict";
/**
 * Triangle Pattern Detector
 *
 * Detects triangle continuation patterns (Ascending, Descending, Symmetrical).
 * These are consolidation patterns that typically continue the previous trend.
 *
 * Ascending Triangle (Bullish):
 *     __________ Flat resistance
 *    /  /  /  /
 *   /  /  /  /   Rising support
 *  /  /  /  /    → LONG on breakout
 *
 * Descending Triangle (Bearish):
 *  \  \  \  \   Falling resistance
 *   \  \  \  \
 *    \__\__\__\ Flat support
 *              → SHORT on breakout
 *
 * Symmetrical Triangle (Continuation):
 *      /\
 *     /  \      Both lines converging
 *    /    \     → Breakout direction = trend direction
 *   /      \
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrianglePatternDetector = exports.TrianglePatternType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var TrianglePatternType;
(function (TrianglePatternType) {
    TrianglePatternType["ASCENDING"] = "ASCENDING_TRIANGLE";
    TrianglePatternType["DESCENDING"] = "DESCENDING_TRIANGLE";
    TrianglePatternType["SYMMETRICAL"] = "SYMMETRICAL_TRIANGLE";
    TrianglePatternType["NONE"] = "NONE";
})(TrianglePatternType || (exports.TrianglePatternType = TrianglePatternType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var BASE_CONFIDENCE = 65;
var MIN_TOUCHES = 2; // Minimum touches per trendline
var FLAT_SLOPE_THRESHOLD = 0.00005; // Slope considered "flat"
var CONVERGENCE_THRESHOLD = 0.0001; // Minimum convergence required
var MIN_PATTERN_BARS = 30;
var MAX_PATTERN_BARS = 200;
// ============================================================================
// TRIANGLE PATTERN DETECTOR
// ============================================================================
var TrianglePatternDetector = /** @class */ (function () {
    function TrianglePatternDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect triangle pattern from swing points
     */
    TrianglePatternDetector.prototype.detect = function (swingPoints, currentTrend) {
        if (swingPoints.length < 6) {
            return this.noPattern('Not enough swing points (need 6+)');
        }
        var recent = swingPoints.slice(-12); // Last 12 swing points
        // Separate highs and lows
        var highs = recent.filter(function (p) { return p.type === types_1.SwingPointType.HIGH; });
        var lows = recent.filter(function (p) { return p.type === types_1.SwingPointType.LOW; });
        if (highs.length < MIN_TOUCHES || lows.length < MIN_TOUCHES) {
            return this.noPattern('Not enough highs/lows for trendlines');
        }
        // Calculate trendlines
        var resistanceLine = this.calculateTrendline(highs);
        var supportLine = this.calculateTrendline(lows);
        // Check pattern timespan
        var firstPoint = recent[0];
        var lastPoint = recent[recent.length - 1];
        var patternMinutes = (lastPoint.timestamp - firstPoint.timestamp) / 60000;
        if (patternMinutes < MIN_PATTERN_BARS || patternMinutes > MAX_PATTERN_BARS) {
            return this.noPattern('Pattern timespan invalid');
        }
        // Determine triangle type based on slopes
        var resistanceFlat = Math.abs(resistanceLine.slope) < FLAT_SLOPE_THRESHOLD;
        var supportFlat = Math.abs(supportLine.slope) < FLAT_SLOPE_THRESHOLD;
        var converging = resistanceLine.slope - supportLine.slope < -CONVERGENCE_THRESHOLD;
        // Ascending Triangle: flat resistance + rising support
        if (resistanceFlat && supportLine.slope > 0 && converging) {
            return this.buildPattern(TrianglePatternType.ASCENDING, 'LONG', resistanceLine, supportLine, highs, lows, currentTrend);
        }
        // Descending Triangle: falling resistance + flat support
        if (supportFlat && resistanceLine.slope < 0 && converging) {
            return this.buildPattern(TrianglePatternType.DESCENDING, 'SHORT', resistanceLine, supportLine, highs, lows, currentTrend);
        }
        // Symmetrical Triangle: both converging
        if (converging && !resistanceFlat && !supportFlat && resistanceLine.slope < 0 && supportLine.slope > 0) {
            // Direction depends on trend
            var direction = currentTrend === 'BULLISH' ? 'LONG' : currentTrend === 'BEARISH' ? 'SHORT' : 'LONG';
            return this.buildPattern(TrianglePatternType.SYMMETRICAL, direction, resistanceLine, supportLine, highs, lows, currentTrend);
        }
        return this.noPattern('No valid triangle pattern');
    };
    /**
     * Calculate trendline using linear regression
     */
    TrianglePatternDetector.prototype.calculateTrendline = function (points) {
        var n = points.length;
        var sumX = 0;
        var sumY = 0;
        var sumXY = 0;
        var sumX2 = 0;
        // Use timestamp as X, price as Y
        var baseTime = points[0].timestamp;
        for (var _i = 0, points_1 = points; _i < points_1.length; _i++) {
            var point = points_1[_i];
            var x = (point.timestamp - baseTime) / 60000; // Minutes from start
            var y = point.price;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        var intercept = (sumY - slope * sumX) / n;
        return { slope: slope, intercept: intercept };
    };
    /**
     * Build triangle pattern result
     */
    TrianglePatternDetector.prototype.buildPattern = function (type, direction, resistanceLine, supportLine, highs, lows, currentTrend) {
        // Calculate apex (where lines meet)
        var latestHigh = highs[highs.length - 1];
        var latestLow = lows[lows.length - 1];
        var currentPrice = (latestHigh.price + latestLow.price) / 2;
        // Triangle height (widest part)
        var firstHigh = highs[0].price;
        var firstLow = lows[0].price;
        var triangleHeight = firstHigh - firstLow;
        // Target: project triangle height from breakout
        var target = direction === 'LONG'
            ? currentPrice + triangleHeight
            : currentPrice - triangleHeight;
        // Stop loss: opposite side of triangle
        var stopLoss = direction === 'LONG'
            ? latestLow.price - triangleHeight * 0.15
            : latestHigh.price + triangleHeight * 0.15;
        // Calculate confidence
        var confidence = BASE_CONFIDENCE;
        // Bonus for trend alignment
        if (type === TrianglePatternType.ASCENDING && currentTrend === 'BULLISH') {
            confidence += 15;
        }
        else if (type === TrianglePatternType.DESCENDING && currentTrend === 'BEARISH') {
            confidence += 15;
        }
        else if (type === TrianglePatternType.SYMMETRICAL) {
            confidence += 10; // Symmetrical is more neutral
        }
        // Bonus for more touches
        var totalTouches = highs.length + lows.length;
        if (totalTouches >= 6) {
            confidence += 10;
        }
        return {
            detected: true,
            type: type,
            direction: direction,
            confidence: Math.min(100, confidence),
            apex: currentPrice,
            target: target,
            stopLoss: stopLoss,
            resistanceLine: { slope: resistanceLine.slope, highs: highs },
            supportLine: { slope: supportLine.slope, lows: lows },
            explanation: "".concat(type, ": ").concat(highs.length, " highs, ").concat(lows.length, " lows, ").concat(totalTouches, " touches"),
        };
    };
    /**
     * Return no pattern result
     */
    TrianglePatternDetector.prototype.noPattern = function (reason) {
        return {
            detected: false,
            type: TrianglePatternType.NONE,
            direction: 'LONG',
            confidence: 0,
            apex: 0,
            target: 0,
            stopLoss: 0,
            resistanceLine: { slope: 0, highs: [] },
            supportLine: { slope: 0, lows: [] },
            explanation: reason,
        };
    };
    return TrianglePatternDetector;
}());
exports.TrianglePatternDetector = TrianglePatternDetector;
