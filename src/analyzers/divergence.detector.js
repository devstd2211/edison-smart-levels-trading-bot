"use strict";
/**
 * Divergence Detector
 *
 * Detects divergences between price action and RSI indicator.
 * Divergences are powerful reversal signals used by professional traders.
 *
 * Types of divergences:
 * - BULLISH: Price makes lower low, RSI makes higher low → Potential reversal UP
 * - BEARISH: Price makes higher high, RSI makes lower high → Potential reversal DOWN
 *
 * Based on classical technical analysis and momentum theory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DivergenceDetector = exports.DivergenceType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var DivergenceType;
(function (DivergenceType) {
    DivergenceType["BULLISH"] = "BULLISH";
    DivergenceType["BEARISH"] = "BEARISH";
    DivergenceType["NONE"] = "NONE";
})(DivergenceType || (exports.DivergenceType = DivergenceType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var MIN_DIVERGENCE_STRENGTH = 0.3; // Minimum strength to report divergence
var PRICE_DIFF_THRESHOLD = 0.2; // 0.2% - minimum price difference
var RSI_DIFF_THRESHOLD = 2; // 2 points - minimum RSI difference
var MAX_TIME_BETWEEN_POINTS_MS = 24 * 60 * 60 * 1000; // 24 hours
// ============================================================================
// DIVERGENCE DETECTOR
// ============================================================================
var DivergenceDetector = /** @class */ (function () {
    function DivergenceDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect divergence from swing points and RSI values
     */
    DivergenceDetector.prototype.detect = function (swingPoints, rsiValues // timestamp -> RSI value
    ) {
        if (swingPoints.length < 2) {
            return this.noDivergence();
        }
        // Get last two swing highs (for bearish divergence)
        var lastTwoHighs = swingPoints
            .filter(function (p) { return p.type === types_1.SwingPointType.HIGH; })
            .slice(-2);
        // Get last two swing lows (for bullish divergence)
        var lastTwoLows = swingPoints
            .filter(function (p) { return p.type === types_1.SwingPointType.LOW; })
            .slice(-2);
        // Check for bearish divergence (price HH, RSI LH)
        if (lastTwoHighs.length === 2) {
            var bearish = this.checkBearishDivergence(lastTwoHighs, rsiValues);
            if (bearish.type !== DivergenceType.NONE) {
                this.logger.debug('Bearish divergence detected', {
                    strength: bearish.strength,
                    pricePoints: bearish.pricePoints,
                    rsiPoints: bearish.rsiPoints,
                });
                return bearish;
            }
        }
        // Check for bullish divergence (price LL, RSI HL)
        if (lastTwoLows.length === 2) {
            var bullish = this.checkBullishDivergence(lastTwoLows, rsiValues);
            if (bullish.type !== DivergenceType.NONE) {
                this.logger.debug('Bullish divergence detected', {
                    strength: bullish.strength,
                    pricePoints: bullish.pricePoints,
                    rsiPoints: bullish.rsiPoints,
                });
                return bullish;
            }
        }
        return this.noDivergence();
    };
    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================
    /**
     * Check for bearish divergence (price HH, RSI LH)
     */
    DivergenceDetector.prototype.checkBearishDivergence = function (swingHighs, rsiValues) {
        var old = swingHighs[0], recent = swingHighs[1];
        // Get RSI values at swing points
        var oldRSI = rsiValues.get(old.timestamp);
        var recentRSI = rsiValues.get(recent.timestamp);
        if (oldRSI === undefined || recentRSI === undefined) {
            return this.noDivergence();
        }
        // Check if time between points is not too large
        if (recent.timestamp - old.timestamp > MAX_TIME_BETWEEN_POINTS_MS) {
            return this.noDivergence();
        }
        // Bearish divergence: Price makes HH, RSI makes LH
        var priceIsHigher = recent.price > old.price;
        var rsiIsLower = recentRSI < oldRSI;
        if (priceIsHigher && rsiIsLower) {
            var priceDiff = Math.abs(recent.price - old.price) / old.price * 100;
            var rsiDiff = Math.abs(recentRSI - oldRSI);
            // Check if differences are significant
            if (priceDiff >= PRICE_DIFF_THRESHOLD && rsiDiff >= RSI_DIFF_THRESHOLD) {
                var strength = this.calculateStrength(priceDiff, rsiDiff);
                if (strength >= MIN_DIVERGENCE_STRENGTH) {
                    return {
                        type: DivergenceType.BEARISH,
                        strength: strength,
                        pricePoints: [old.price, recent.price],
                        rsiPoints: [oldRSI, recentRSI],
                        timePoints: [old.timestamp, recent.timestamp],
                    };
                }
            }
        }
        return this.noDivergence();
    };
    /**
     * Check for bullish divergence (price LL, RSI HL)
     */
    DivergenceDetector.prototype.checkBullishDivergence = function (swingLows, rsiValues) {
        var old = swingLows[0], recent = swingLows[1];
        // Get RSI values at swing points
        var oldRSI = rsiValues.get(old.timestamp);
        var recentRSI = rsiValues.get(recent.timestamp);
        if (oldRSI === undefined || recentRSI === undefined) {
            return this.noDivergence();
        }
        // Check if time between points is not too large
        if (recent.timestamp - old.timestamp > MAX_TIME_BETWEEN_POINTS_MS) {
            return this.noDivergence();
        }
        // Bullish divergence: Price makes LL, RSI makes HL
        var priceIsLower = recent.price < old.price;
        var rsiIsHigher = recentRSI > oldRSI;
        if (priceIsLower && rsiIsHigher) {
            var priceDiff = Math.abs(recent.price - old.price) / old.price * 100;
            var rsiDiff = Math.abs(recentRSI - oldRSI);
            // Check if differences are significant
            if (priceDiff >= PRICE_DIFF_THRESHOLD && rsiDiff >= RSI_DIFF_THRESHOLD) {
                var strength = this.calculateStrength(priceDiff, rsiDiff);
                if (strength >= MIN_DIVERGENCE_STRENGTH) {
                    return {
                        type: DivergenceType.BULLISH,
                        strength: strength,
                        pricePoints: [old.price, recent.price],
                        rsiPoints: [oldRSI, recentRSI],
                        timePoints: [old.timestamp, recent.timestamp],
                    };
                }
            }
        }
        return this.noDivergence();
    };
    /**
     * Calculate divergence strength (0-1)
     */
    DivergenceDetector.prototype.calculateStrength = function (priceDiffPercent, rsiDiff) {
        // Strength based on:
        // 1. Price difference (larger = stronger)
        // 2. RSI difference (larger = stronger)
        // Normalize price diff (0-5% range)
        var priceScore = Math.min(priceDiffPercent / 5, 1);
        // Normalize RSI diff (0-20 points range)
        var rsiScore = Math.min(rsiDiff / 20, 1);
        // Average of both scores
        var strength = (priceScore + rsiScore) / 2;
        return Math.min(Math.max(strength, 0), 1); // Clamp to 0-1
    };
    /**
     * Return "no divergence" result
     */
    DivergenceDetector.prototype.noDivergence = function () {
        return {
            type: DivergenceType.NONE,
            strength: 0,
            pricePoints: [0, 0],
            rsiPoints: [0, 0],
            timePoints: [0, 0],
        };
    };
    return DivergenceDetector;
}());
exports.DivergenceDetector = DivergenceDetector;
