"use strict";
/**
 * Bollinger Bands Indicator
 * Measures volatility and potential reversal zones
 *
 * Formula:
 * 1. Middle Band = SMA(close, period)
 * 2. Upper Band = Middle + (stdDev × Standard Deviation)
 * 3. Lower Band = Middle - (stdDev × Standard Deviation)
 * 4. Width % = ((Upper - Lower) / Middle) × 100
 * 5. %B = (Price - Lower) / (Upper - Lower)
 *
 * Usage:
 * - Price near lower band (< 0.15%B): Potential long entry
 * - Price near upper band (> 0.85%B): Potential short entry
 * - Squeeze (narrow bands): Low volatility, expect breakout
 * - Width expansion: High volatility, strong move
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BollingerBandsIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var DEFAULT_PERIOD = 20;
var DEFAULT_STD_DEV = 2.0;
var MAX_HISTORY_LENGTH = 100;
var PERCENT_MULTIPLIER = 100;
var PERCENT_B_MIN = 0;
var PERCENT_B_MAX = 1;
// Volatility thresholds for adaptive parameters
var HIGH_VOLATILITY_THRESHOLD = 0.05; // 5% ATR/price ratio
var MEDIUM_VOLATILITY_THRESHOLD = 0.03; // 3% ATR/price ratio
// Adaptive stdDev values
var HIGH_VOLATILITY_STD_DEV = 2.5;
var MEDIUM_VOLATILITY_STD_DEV = 2.0;
var LOW_VOLATILITY_STD_DEV = 1.5;
// Squeeze detection
var DEFAULT_SQUEEZE_THRESHOLD = 0.8; // 80% of average width
// ============================================================================
// BOLLINGER BANDS CALCULATOR
// ============================================================================
var BollingerBandsIndicator = /** @class */ (function () {
    /**
     * Create Bollinger Bands indicator
     *
     * @param period - SMA period (default: 20)
     * @param stdDev - Standard deviation multiplier (default: 2.0)
     */
    function BollingerBandsIndicator(period, stdDev) {
        if (period === void 0) { period = DEFAULT_PERIOD; }
        if (stdDev === void 0) { stdDev = DEFAULT_STD_DEV; }
        this.history = [];
        this.period = period;
        this.stdDev = stdDev;
    }
    /**
     * Calculate Bollinger Bands for a series of candles
     *
     * @param candles - Array of candles (must be at least period length)
     * @returns Bollinger Bands result
     * @throws {Error} If not enough candles
     */
    BollingerBandsIndicator.prototype.calculate = function (candles) {
        if (candles.length < this.period) {
            throw new Error("Not enough candles for Bollinger Bands calculation. Need ".concat(this.period, ", got ").concat(candles.length));
        }
        // Get last N candles for calculation
        var recentCandles = candles.slice(-this.period);
        var closePrices = recentCandles.map(function (c) { return c.close; });
        var currentPrice = closePrices[closePrices.length - 1];
        // Calculate SMA (middle band)
        var middle = this.calculateSMA(closePrices);
        // Calculate standard deviation
        var stdDeviation = this.calculateStdDev(closePrices, middle);
        // Calculate bands
        var upper = middle + this.stdDev * stdDeviation;
        var lower = middle - this.stdDev * stdDeviation;
        // Calculate width percentage
        var width = ((upper - lower) / middle) * PERCENT_MULTIPLIER;
        // Calculate %B (price position)
        var percentB;
        if (upper === lower) {
            // No volatility, price is at middle
            percentB = 0.5;
        }
        else {
            percentB = (currentPrice - lower) / (upper - lower);
            percentB = Math.max(PERCENT_B_MIN, Math.min(PERCENT_B_MAX, percentB));
        }
        // Store in history
        var timestamp = candles[candles.length - 1].timestamp;
        this.addToHistory({ timestamp: timestamp, upper: upper, middle: middle, lower: lower, width: width });
        return {
            upper: upper,
            middle: middle,
            lower: lower,
            width: width,
            percentB: percentB,
        };
    };
    /**
     * Calculate Simple Moving Average
     *
     * @param values - Array of values
     * @returns SMA
     */
    BollingerBandsIndicator.prototype.calculateSMA = function (values) {
        var sum = values.reduce(function (acc, val) { return acc + val; }, 0);
        return sum / values.length;
    };
    /**
     * Calculate Standard Deviation
     *
     * @param values - Array of values
     * @param mean - Mean (average) of values
     * @returns Standard deviation
     */
    BollingerBandsIndicator.prototype.calculateStdDev = function (values, mean) {
        var squaredDiffs = values.map(function (val) { return Math.pow(val - mean, 2); });
        var variance = this.calculateSMA(squaredDiffs);
        return Math.sqrt(variance);
    };
    /**
     * Add entry to history (limited to MAX_HISTORY_LENGTH)
     *
     * @param entry - History entry
     */
    BollingerBandsIndicator.prototype.addToHistory = function (entry) {
        this.history.push(entry);
        // Trim history if too long
        if (this.history.length > MAX_HISTORY_LENGTH) {
            this.history.shift();
        }
    };
    /**
     * Detect Bollinger Squeeze
     * Squeeze occurs when bands are narrower than average (low volatility)
     *
     * @param threshold - Squeeze threshold (default: 0.8 = 80% of average)
     * @returns True if squeeze detected
     */
    BollingerBandsIndicator.prototype.isSqueeze = function (threshold) {
        if (threshold === void 0) { threshold = DEFAULT_SQUEEZE_THRESHOLD; }
        if (this.history.length < DEFAULT_PERIOD) {
            return false; // Not enough history
        }
        // Calculate average width over last N periods
        var recentWidths = this.history.slice(-DEFAULT_PERIOD).map(function (h) { return h.width; });
        var avgWidth = this.calculateSMA(recentWidths);
        // Current width
        var currentWidth = this.history[this.history.length - 1].width;
        // Squeeze: current width < threshold * average width
        return currentWidth < avgWidth * threshold;
    };
    /**
     * Get adaptive parameters based on market volatility
     * High volatility → wider bands (stdDev 2.5)
     * Medium volatility → normal bands (stdDev 2.0)
     * Low volatility → tighter bands (stdDev 1.5)
     *
     * @param atr - Average True Range
     * @param price - Current price
     * @returns Adaptive parameters
     */
    BollingerBandsIndicator.prototype.getAdaptiveParams = function (atr, price) {
        var volatility = atr / price;
        if (volatility > HIGH_VOLATILITY_THRESHOLD) {
            return { period: DEFAULT_PERIOD, stdDev: HIGH_VOLATILITY_STD_DEV };
        }
        if (volatility > MEDIUM_VOLATILITY_THRESHOLD) {
            return { period: DEFAULT_PERIOD, stdDev: MEDIUM_VOLATILITY_STD_DEV };
        }
        return { period: DEFAULT_PERIOD, stdDev: LOW_VOLATILITY_STD_DEV };
    };
    /**
     * Apply adaptive parameters to indicator
     *
     * @param params - Adaptive parameters
     */
    BollingerBandsIndicator.prototype.applyAdaptiveParams = function (params) {
        this.period = params.period;
        this.stdDev = params.stdDev;
    };
    /**
     * Check if price is near lower band (potential long entry)
     *
     * @param percentB - Current %B value
     * @param threshold - Threshold for "near" (default: 0.15 = 15%)
     * @returns True if near lower band
     */
    BollingerBandsIndicator.prototype.isNearLowerBand = function (percentB, threshold) {
        if (threshold === void 0) { threshold = 0.15; }
        return percentB <= threshold;
    };
    /**
     * Check if price is near upper band (potential short entry)
     *
     * @param percentB - Current %B value
     * @param threshold - Threshold for "near" (default: 0.85 = 85%)
     * @returns True if near upper band
     */
    BollingerBandsIndicator.prototype.isNearUpperBand = function (percentB, threshold) {
        if (threshold === void 0) { threshold = 0.85; }
        return percentB >= threshold;
    };
    /**
     * Check if price is in middle zone (avoid trading)
     *
     * @param percentB - Current %B value
     * @returns True if in middle zone (0.3 - 0.7)
     */
    BollingerBandsIndicator.prototype.isInMiddleZone = function (percentB) {
        return percentB > 0.3 && percentB < 0.7;
    };
    /**
     * Get history
     *
     * @param length - Number of history entries (optional, default: all)
     * @returns Array of history entries
     */
    BollingerBandsIndicator.prototype.getHistory = function (length) {
        if (length === undefined) {
            return __spreadArray([], this.history, true);
        }
        return this.history.slice(-length);
    };
    /**
     * Get current parameters
     *
     * @returns Current period and stdDev
     */
    BollingerBandsIndicator.prototype.getParams = function () {
        return {
            period: this.period,
            stdDev: this.stdDev,
        };
    };
    /**
     * Reset indicator state
     */
    BollingerBandsIndicator.prototype.reset = function () {
        this.history = [];
    };
    return BollingerBandsIndicator;
}());
exports.BollingerBandsIndicator = BollingerBandsIndicator;
