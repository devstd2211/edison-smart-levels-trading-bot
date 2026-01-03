"use strict";
/**
 * Timeframe Validator
 *
 * Validates that indicator data is from closed candles only.
 * Prevents look-ahead bias in backtesting by ensuring we don't use
 * data from candles that haven't closed yet.
 *
 * Example:
 * Time: 10:00 (M1 candle closes)
 * Bot checks M30 trend...
 * ❌ WRONG: Uses M30 candle at 10:00-10:30 (not closed yet!)
 * ✅ RIGHT: Uses M30 candle at 09:30-10:00 (last closed candle)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeframeValidator = void 0;
var TimeframeValidator = /** @class */ (function () {
    function TimeframeValidator() {
    }
    /**
     * Validate that indicator data is from closed candles only
     *
     * @param currentTime - Current timestamp (ms)
     * @param indicatorTime - Timestamp of indicator data (ms)
     * @param timeframeMinutes - Timeframe in minutes (e.g., 1, 5, 30)
     * @returns true if indicator is from a closed candle, false otherwise
     */
    TimeframeValidator.validateNoLookAhead = function (currentTime, indicatorTime, timeframeMinutes) {
        // Indicator must be from a closed candle (before or at last closed candle time)
        var lastClosedCandleTime = this.getLastClosedCandleTime(currentTime, timeframeMinutes);
        return indicatorTime <= lastClosedCandleTime;
    };
    /**
     * Get last closed candle time for timeframe
     *
     * @param currentTime - Current timestamp (ms)
     * @param timeframeMinutes - Timeframe in minutes (e.g., 1, 5, 30)
     * @returns Timestamp of last closed candle (ms)
     *
     * @example
     * currentTime = 10:05:30 (M1)
     * returns = 10:04:00 (last closed M1 candle: 10:04-10:05)
     *
     * @example
     * currentTime = 10:05:00 (exact M1 open)
     * returns = 10:04:00 (last closed M1 candle: 10:04-10:05)
     */
    TimeframeValidator.getLastClosedCandleTime = function (currentTime, timeframeMinutes) {
        var intervalMs = timeframeMinutes * 60 * 1000;
        var currentCandleStart = Math.floor(currentTime / intervalMs) * intervalMs;
        // Last closed candle = current candle start - interval
        // This works for both mid-candle (10:05:30) and exact candle open (10:05:00)
        return currentCandleStart - intervalMs;
    };
    /**
     * Filter candles to only include closed candles for given timeframe
     *
     * @param candles - Array of candles
     * @param currentTime - Current timestamp (ms)
     * @param timeframeMinutes - Timeframe in minutes
     * @returns Filtered array of closed candles
     */
    TimeframeValidator.getClosedCandles = function (candles, currentTime, timeframeMinutes) {
        var lastClosedTime = this.getLastClosedCandleTime(currentTime, timeframeMinutes);
        return candles.filter(function (c) { return c.timestamp <= lastClosedTime; });
    };
    return TimeframeValidator;
}());
exports.TimeframeValidator = TimeframeValidator;
