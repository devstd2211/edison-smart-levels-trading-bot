"use strict";
/**
 * ATR Indicator (Average True Range)
 * Measures market volatility
 *
 * Formula:
 * 1. True Range (TR) = max of:
 *    - High - Low
 *    - |High - Previous Close|
 *    - |Low - Previous Close|
 * 2. ATR = EMA of TR over period (Wilder's smoothing)
 *
 * Returns: ATR value as percentage of current price
 * - Low volatility: < 0.5%
 * - Normal volatility: 0.5% - 2%
 * - High volatility: 2% - 5%
 * - Extreme volatility: > 5%
 *
 * Implementation: Wilder's smoothing (same as RSI)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATRIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var PERCENT_MULTIPLIER = 100;
var MIN_CANDLES = 2; // Need at least 2 candles for TR calculation
// ============================================================================
// ATR CALCULATOR
// ============================================================================
var ATRIndicator = /** @class */ (function () {
    function ATRIndicator(period) {
        this.atr = 0;
        this.initialized = false;
        if (period < 1) {
            throw new Error('ATR period must be at least 1');
        }
        this.period = period;
    }
    /**
     * Calculate True Range for a single candle
     *
     * @param current - Current candle
     * @param previous - Previous candle
     * @returns True Range value
     */
    ATRIndicator.prototype.calculateTrueRange = function (current, previous) {
        var highLow = current.high - current.low;
        var highClose = Math.abs(current.high - previous.close);
        var lowClose = Math.abs(current.low - previous.close);
        return Math.max(highLow, highClose, lowClose);
    };
    /**
     * Calculate ATR for a series of candles
     *
     * @param candles - Array of candles (must be at least period + 1 length)
     * @returns ATR value as percentage of current price
     * @throws {Error} If not enough candles
     */
    ATRIndicator.prototype.calculate = function (candles) {
        if (candles.length < this.period + 1) {
            throw new Error("Not enough candles for ATR calculation. Need ".concat(this.period + 1, ", got ").concat(candles.length));
        }
        // Reset state
        this.initialized = false;
        // Calculate True Range for each candle
        var trueRanges = [];
        for (var i = 1; i < candles.length; i++) {
            var tr = this.calculateTrueRange(candles[i], candles[i - 1]);
            trueRanges.push(tr);
        }
        // Initial ATR (simple average for first period)
        var sumTR = 0;
        for (var i = 0; i < this.period; i++) {
            sumTR += trueRanges[i];
        }
        this.atr = sumTR / this.period;
        this.initialized = true;
        // Wilder's smoothing for remaining periods
        for (var i = this.period; i < trueRanges.length; i++) {
            this.atr = (this.atr * (this.period - 1) + trueRanges[i]) / this.period;
        }
        // Convert to percentage of current price
        var currentPrice = candles[candles.length - 1].close;
        var atrPercent = (this.atr / currentPrice) * PERCENT_MULTIPLIER;
        return atrPercent;
    };
    /**
     * Update ATR with a new candle (incremental calculation)
     *
     * @param newCandle - New candle
     * @param previousCandle - Previous candle
     * @returns Updated ATR value as percentage
     * @throws {Error} If not initialized
     */
    ATRIndicator.prototype.update = function (newCandle, previousCandle) {
        if (!this.initialized) {
            throw new Error('ATR not initialized. Call calculate() first.');
        }
        // Calculate new True Range
        var tr = this.calculateTrueRange(newCandle, previousCandle);
        // Wilder's smoothing
        this.atr = (this.atr * (this.period - 1) + tr) / this.period;
        // Convert to percentage of current price
        var atrPercent = (this.atr / newCandle.close) * PERCENT_MULTIPLIER;
        return atrPercent;
    };
    /**
     * Get current ATR value (must be initialized)
     *
     * @returns ATR value
     * @throws {Error} If not initialized
     */
    ATRIndicator.prototype.getValue = function () {
        if (!this.initialized) {
            throw new Error('ATR not initialized. Call calculate() first.');
        }
        return this.atr;
    };
    /**
     * Check if ATR is initialized
     */
    ATRIndicator.prototype.isInitialized = function () {
        return this.initialized;
    };
    /**
     * Reset ATR state
     */
    ATRIndicator.prototype.reset = function () {
        this.atr = 0;
        this.initialized = false;
    };
    /**
     * Get current state (for serialization/debugging)
     */
    ATRIndicator.prototype.getState = function () {
        return {
            period: this.period,
            atr: this.atr,
            initialized: this.initialized,
        };
    };
    return ATRIndicator;
}());
exports.ATRIndicator = ATRIndicator;
