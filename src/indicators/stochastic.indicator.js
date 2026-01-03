"use strict";
/**
 * Stochastic Oscillator Indicator
 * Measures momentum by comparing closing price to price range over a period
 *
 * Formula:
 * 1. %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
 * 2. %D = SMA of %K over smoothing period
 *
 * Range: 0-100
 * - Above 80: Overbought
 * - Below 20: Oversold
 *
 * Common settings:
 * - K period: 14 (lookback period)
 * - D period: 3 (smoothing period for %D)
 * - Smooth: 3 (smooth %K before calculating %D)
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
exports.StochasticIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var STOCH_MIN = 0;
var STOCH_MAX = 100;
var STOCH_OVERBOUGHT = 80;
var STOCH_OVERSOLD = 20;
var PERCENT_MULTIPLIER = 100;
var ZERO_RANGE_FALLBACK = 50; // If high === low, return neutral value
// ============================================================================
// STOCHASTIC CALCULATOR
// ============================================================================
var StochasticIndicator = /** @class */ (function () {
    /**
     * Create Stochastic Oscillator indicator
     *
     * @param kPeriod - Lookback period for %K (default: 14)
     * @param dPeriod - Smoothing period for %D (default: 3)
     * @param smooth - Smoothing for %K before %D (default: 3)
     */
    function StochasticIndicator(kPeriod, dPeriod, smooth) {
        if (kPeriod === void 0) { kPeriod = 14; }
        if (dPeriod === void 0) { dPeriod = 3; }
        if (smooth === void 0) { smooth = 3; }
        this.kHistory = [];
        this.kPeriod = kPeriod;
        this.dPeriod = dPeriod;
        this.smooth = smooth;
    }
    /**
     * Calculate Stochastic for a series of candles
     *
     * @param candles - Array of candles (must be at least kPeriod length)
     * @returns Object with %K and %D values
     * @throws {Error} If not enough candles
     */
    StochasticIndicator.prototype.calculate = function (candles) {
        var minCandles = this.kPeriod + this.smooth + this.dPeriod - 2;
        if (candles.length < minCandles) {
            throw new Error("Not enough candles for Stochastic calculation. Need ".concat(minCandles, ", got ").concat(candles.length));
        }
        // Reset history
        this.kHistory = [];
        // Calculate %K for all periods
        var rawKValues = [];
        for (var i = this.kPeriod - 1; i < candles.length; i++) {
            var slice = candles.slice(i - this.kPeriod + 1, i + 1);
            var rawK = this.calculateRawK(slice);
            rawKValues.push(rawK);
        }
        // Smooth %K if smooth > 1
        var smoothedKValues = [];
        for (var i = this.smooth - 1; i < rawKValues.length; i++) {
            var slice = rawKValues.slice(i - this.smooth + 1, i + 1);
            var smoothedK = this.calculateSMA(slice);
            smoothedKValues.push(smoothedK);
            this.kHistory.push(smoothedK);
        }
        // Calculate %D (SMA of smoothed %K)
        var currentK = smoothedKValues[smoothedKValues.length - 1];
        var currentD;
        if (smoothedKValues.length < this.dPeriod) {
            // Not enough data for %D yet, return current %K as %D
            currentD = currentK;
        }
        else {
            var dSlice = smoothedKValues.slice(-this.dPeriod);
            currentD = this.calculateSMA(dSlice);
        }
        return {
            k: this.clamp(currentK),
            d: this.clamp(currentD),
        };
    };
    /**
     * Calculate raw %K for a period
     *
     * @param candles - Candles for this period (kPeriod length)
     * @returns Raw %K value (0-100)
     */
    StochasticIndicator.prototype.calculateRawK = function (candles) {
        var currentClose = candles[candles.length - 1].close;
        var lowestLow = Math.min.apply(Math, candles.map(function (c) { return c.low; }));
        var highestHigh = Math.max.apply(Math, candles.map(function (c) { return c.high; }));
        // Handle edge case: no price movement
        if (highestHigh === lowestLow) {
            return ZERO_RANGE_FALLBACK;
        }
        var k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * PERCENT_MULTIPLIER;
        return k;
    };
    /**
     * Calculate Simple Moving Average
     *
     * @param values - Array of values
     * @returns SMA
     */
    StochasticIndicator.prototype.calculateSMA = function (values) {
        var sum = values.reduce(function (acc, val) { return acc + val; }, 0);
        return sum / values.length;
    };
    /**
     * Clamp value to valid range [0, 100]
     *
     * @param value - Value to clamp
     * @returns Clamped value
     */
    StochasticIndicator.prototype.clamp = function (value) {
        return Math.max(STOCH_MIN, Math.min(STOCH_MAX, value));
    };
    /**
     * Check if Stochastic is in oversold zone
     *
     * @param k - Current %K value
     * @returns True if oversold (< 20)
     */
    StochasticIndicator.prototype.isOversold = function (k) {
        return k < STOCH_OVERSOLD;
    };
    /**
     * Check if Stochastic is in overbought zone
     *
     * @param k - Current %K value
     * @returns True if overbought (> 80)
     */
    StochasticIndicator.prototype.isOverbought = function (k) {
        return k > STOCH_OVERBOUGHT;
    };
    /**
     * Detect bullish divergence with RSI
     * Both RSI and Stochastic should be oversold for strong signal
     *
     * @param k - Current Stochastic %K
     * @param rsi - Current RSI value
     * @returns True if both confirm oversold
     */
    StochasticIndicator.prototype.confirmOversoldWithRSI = function (k, rsi) {
        var rsiOversold = rsi < 30;
        var stochOversold = this.isOversold(k);
        return rsiOversold && stochOversold;
    };
    /**
     * Detect bearish divergence with RSI
     * Both RSI and Stochastic should be overbought for strong signal
     *
     * @param k - Current Stochastic %K
     * @param rsi - Current RSI value
     * @returns True if both confirm overbought
     */
    StochasticIndicator.prototype.confirmOverboughtWithRSI = function (k, rsi) {
        var rsiOverbought = rsi > 70;
        var stochOverbought = this.isOverbought(k);
        return rsiOverbought && stochOverbought;
    };
    /**
     * Detect %K and %D crossover
     * Bullish: %K crosses above %D in oversold zone
     * Bearish: %K crosses below %D in overbought zone
     *
     * @param currentK - Current %K
     * @param currentD - Current %D
     * @param previousK - Previous %K
     * @param previousD - Previous %D
     * @returns 'BULLISH', 'BEARISH', or 'NONE'
     */
    StochasticIndicator.prototype.detectCrossover = function (currentK, currentD, previousK, previousD) {
        // Bullish crossover: %K crosses above %D
        if (previousK <= previousD && currentK > currentD) {
            return 'BULLISH';
        }
        // Bearish crossover: %K crosses below %D
        if (previousK >= previousD && currentK < currentD) {
            return 'BEARISH';
        }
        return 'NONE';
    };
    /**
     * Get %K history (for %D calculation or analysis)
     *
     * @returns Array of %K values
     */
    StochasticIndicator.prototype.getKHistory = function () {
        return __spreadArray([], this.kHistory, true);
    };
    /**
     * Reset indicator state
     */
    StochasticIndicator.prototype.reset = function () {
        this.kHistory = [];
    };
    return StochasticIndicator;
}());
exports.StochasticIndicator = StochasticIndicator;
