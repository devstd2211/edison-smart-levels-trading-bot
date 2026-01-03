"use strict";
/**
 * ZigZag Indicator
 * Identifies swing highs and swing lows (support/resistance levels)
 *
 * Algorithm:
 * 1. Look back N candles (length parameter)
 * 2. Swing High: candle.high is highest among N candles before and after
 * 3. Swing Low: candle.low is lowest among N candles before and after
 *
 * Use cases:
 * - Identify key support/resistance levels
 * - Trade from levels (buy at swing low, sell at swing high)
 * - Measure price swings and trends
 *
 * Note: This is a simplified ZigZag based on pivot points
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZigZagIndicator = void 0;
var types_1 = require("../types");
// ============================================================================
// CONSTANTS
// ============================================================================
var LOOKBACK_MULTIPLIER = 2;
// ============================================================================
// ZIGZAG CALCULATOR
// ============================================================================
var ZigZagIndicator = /** @class */ (function () {
    function ZigZagIndicator(length) {
        this.length = length;
    }
    /**
     * Find all swing highs in candles
     *
     * @param candles - Array of candles
     * @returns Array of swing high points
     */
    ZigZagIndicator.prototype.findSwingHighs = function (candles) {
        var swingHighs = [];
        var minRequired = this.length * LOOKBACK_MULTIPLIER + 1;
        if (candles.length < minRequired) {
            return swingHighs;
        }
        // Start from 'length' and end at 'length' from the end
        for (var i = this.length; i < candles.length - this.length; i++) {
            if (this.isSwingHigh(candles, i)) {
                swingHighs.push({
                    price: candles[i].high,
                    timestamp: candles[i].timestamp,
                    type: types_1.SwingPointType.HIGH,
                });
            }
        }
        return swingHighs;
    };
    /**
     * Find all swing lows in candles
     *
     * @param candles - Array of candles
     * @returns Array of swing low points
     */
    ZigZagIndicator.prototype.findSwingLows = function (candles) {
        var swingLows = [];
        var minRequired = this.length * LOOKBACK_MULTIPLIER + 1;
        if (candles.length < minRequired) {
            return swingLows;
        }
        // Start from 'length' and end at 'length' from the end
        for (var i = this.length; i < candles.length - this.length; i++) {
            if (this.isSwingLow(candles, i)) {
                swingLows.push({
                    price: candles[i].low,
                    timestamp: candles[i].timestamp,
                    type: types_1.SwingPointType.LOW,
                });
            }
        }
        return swingLows;
    };
    /**
     * Find both swing highs and lows
     *
     * @param candles - Array of candles
     * @returns Object with swing highs and lows
     */
    ZigZagIndicator.prototype.findSwingPoints = function (candles) {
        return {
            swingHighs: this.findSwingHighs(candles),
            swingLows: this.findSwingLows(candles),
        };
    };
    /**
     * Get most recent swing high
     *
     * @param candles - Array of candles
     * @returns Most recent swing high or null
     */
    ZigZagIndicator.prototype.getLastSwingHigh = function (candles) {
        var swingHighs = this.findSwingHighs(candles);
        if (swingHighs.length === 0) {
            return null;
        }
        return swingHighs[swingHighs.length - 1];
    };
    /**
     * Get most recent swing low
     *
     * @param candles - Array of candles
     * @returns Most recent swing low or null
     */
    ZigZagIndicator.prototype.getLastSwingLow = function (candles) {
        var swingLows = this.findSwingLows(candles);
        if (swingLows.length === 0) {
            return null;
        }
        return swingLows[swingLows.length - 1];
    };
    /**
     * Get N most recent swing highs
     *
     * @param candles - Array of candles
     * @param count - Number of swing highs to get
     * @returns Array of most recent swing highs
     */
    ZigZagIndicator.prototype.getRecentSwingHighs = function (candles, count) {
        var swingHighs = this.findSwingHighs(candles);
        return swingHighs.slice(-count);
    };
    /**
     * Get N most recent swing lows
     *
     * @param candles - Array of candles
     * @param count - Number of swing lows to get
     * @returns Array of most recent swing lows
     */
    ZigZagIndicator.prototype.getRecentSwingLows = function (candles, count) {
        var swingLows = this.findSwingLows(candles);
        return swingLows.slice(-count);
    };
    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================
    /**
     * Check if candle at index is a swing high
     *
     * @param candles - Array of candles
     * @param index - Index to check
     * @returns True if swing high
     */
    ZigZagIndicator.prototype.isSwingHigh = function (candles, index) {
        var currentHigh = candles[index].high;
        // Check left side (previous N candles)
        for (var i = index - this.length; i < index; i++) {
            if (candles[i].high > currentHigh) {
                return false;
            }
        }
        // Check right side (next N candles)
        for (var i = index + 1; i <= index + this.length; i++) {
            if (candles[i].high > currentHigh) {
                return false;
            }
        }
        return true;
    };
    /**
     * Check if candle at index is a swing low
     *
     * @param candles - Array of candles
     * @param index - Index to check
     * @returns True if swing low
     */
    ZigZagIndicator.prototype.isSwingLow = function (candles, index) {
        var currentLow = candles[index].low;
        // Check left side (previous N candles)
        for (var i = index - this.length; i < index; i++) {
            if (candles[i].low < currentLow) {
                return false;
            }
        }
        // Check right side (next N candles)
        for (var i = index + 1; i <= index + this.length; i++) {
            if (candles[i].low < currentLow) {
                return false;
            }
        }
        return true;
    };
    return ZigZagIndicator;
}());
exports.ZigZagIndicator = ZigZagIndicator;
