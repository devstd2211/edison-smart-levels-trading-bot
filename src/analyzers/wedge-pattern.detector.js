"use strict";
/**
 * Wedge Pattern Detector
 *
 * Detects wedge reversal patterns (Rising Wedge, Falling Wedge).
 * Unlike triangles which are continuation patterns, wedges are REVERSAL patterns.
 *
 * Rising Wedge (Bearish Reversal):
 *    /|        Both lines rising
 *   / |        but converging
 *  /  |        → SHORT on break
 * /   |        Price exhaustion
 *
 * Falling Wedge (Bullish Reversal):
 * |\          Both lines falling
 * | \         but converging
 * |  \        → LONG on break
 * |   \       Selling exhaustion
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WedgePatternDetector = exports.WedgePatternType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var WedgePatternType;
(function (WedgePatternType) {
    WedgePatternType["RISING"] = "RISING_WEDGE";
    WedgePatternType["FALLING"] = "FALLING_WEDGE";
    WedgePatternType["NONE"] = "NONE";
})(WedgePatternType || (exports.WedgePatternType = WedgePatternType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var BASE_CONFIDENCE = 65;
var MIN_TOUCHES = 2; // Minimum touches per trendline
var CONVERGENCE_THRESHOLD = 0.0001; // Minimum convergence required
var MIN_PATTERN_BARS = 25; // Wedges need time to develop
var MAX_PATTERN_BARS = 180;
// ============================================================================
// WEDGE PATTERN DETECTOR
// ============================================================================
var WedgePatternDetector = /** @class */ (function () {
    function WedgePatternDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect wedge pattern from swing points
     */
    WedgePatternDetector.prototype.detect = function (swingPoints, currentTrend) {
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
        // Check if lines converge
        var converging = resistanceLine.slope - supportLine.slope < -CONVERGENCE_THRESHOLD;
        if (!converging) {
            return this.noPattern('Lines not converging');
        }
        // Rising Wedge: BOTH lines rising (bearish reversal)
        if (resistanceLine.slope > 0 && supportLine.slope > 0) {
            // Support line MUST be steeper (rising faster) for valid rising wedge
            if (supportLine.slope > resistanceLine.slope * 0.5) {
                return this.buildPattern(WedgePatternType.RISING, 'SHORT', resistanceLine, supportLine, highs, lows, currentTrend);
            }
        }
        // Falling Wedge: BOTH lines falling (bullish reversal)
        if (resistanceLine.slope < 0 && supportLine.slope < 0) {
            // Resistance line MUST be steeper (falling faster) for valid falling wedge
            if (resistanceLine.slope < supportLine.slope * 0.5) {
                return this.buildPattern(WedgePatternType.FALLING, 'LONG', resistanceLine, supportLine, highs, lows, currentTrend);
            }
        }
        return this.noPattern('No valid wedge pattern');
    };
    /**
     * Calculate trendline using linear regression
     */
    WedgePatternDetector.prototype.calculateTrendline = function (points) {
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
     * Build wedge pattern result
     */
    WedgePatternDetector.prototype.buildPattern = function (type, direction, resistanceLine, supportLine, highs, lows, currentTrend) {
        // Calculate apex (where lines meet)
        var latestHigh = highs[highs.length - 1];
        var latestLow = lows[lows.length - 1];
        var currentPrice = (latestHigh.price + latestLow.price) / 2;
        // Wedge height (widest part)
        var firstHigh = highs[0].price;
        var firstLow = lows[0].price;
        var wedgeHeight = firstHigh - firstLow;
        // Target: project wedge height from breakout
        var target = direction === 'LONG'
            ? currentPrice + wedgeHeight
            : currentPrice - wedgeHeight;
        // Stop loss: opposite side of wedge
        var stopLoss = direction === 'LONG'
            ? latestLow.price - wedgeHeight * 0.15
            : latestHigh.price + wedgeHeight * 0.15;
        // Calculate confidence
        var confidence = BASE_CONFIDENCE;
        // Bonus for trend exhaustion (wedge against trend = more reliable)
        if (type === WedgePatternType.RISING && currentTrend === 'BULLISH') {
            confidence += 15; // Rising wedge in bullish trend = exhaustion signal
        }
        else if (type === WedgePatternType.FALLING && currentTrend === 'BEARISH') {
            confidence += 15; // Falling wedge in bearish trend = exhaustion signal
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
    WedgePatternDetector.prototype.noPattern = function (reason) {
        return {
            detected: false,
            type: WedgePatternType.NONE,
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
    return WedgePatternDetector;
}());
exports.WedgePatternDetector = WedgePatternDetector;
