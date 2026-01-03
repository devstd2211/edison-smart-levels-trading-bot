"use strict";
/**
 * VWAP Indicator (Volume Weighted Average Price)
 *
 * VWAP is the average price weighted by volume.
 * Used by institutional traders as a benchmark.
 *
 * Formula:
 * VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * where Typical Price = (High + Low + Close) / 3
 *
 * Interpretation:
 * - Price > VWAP = Bullish (buyers in control)
 * - Price < VWAP = Bearish (sellers in control)
 * - Institutional traders aim to buy below VWAP, sell above VWAP
 *
 * Use Cases:
 * - Senior timeframe filter (M5, M30)
 * - Trend confirmation
 * - Entry timing (buy when price dips to VWAP in uptrend)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VWAPIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var MIN_CANDLES = 1;
var TYPICAL_PRICE_DIVISOR = 3;
// ============================================================================
// VWAP CALCULATOR
// ============================================================================
var VWAPIndicator = /** @class */ (function () {
    function VWAPIndicator() {
    }
    /**
     * Calculate VWAP from candles
     *
     * @param candles - Array of candles (ordered by timestamp)
     * @returns VWAP value, or 0 if no volume
     */
    VWAPIndicator.prototype.calculate = function (candles) {
        if (candles.length < MIN_CANDLES) {
            return 0;
        }
        var sumPriceVolume = 0;
        var sumVolume = 0;
        for (var _i = 0, candles_1 = candles; _i < candles_1.length; _i++) {
            var candle = candles_1[_i];
            var typicalPrice = (candle.high + candle.low + candle.close) / TYPICAL_PRICE_DIVISOR;
            sumPriceVolume += typicalPrice * candle.volume;
            sumVolume += candle.volume;
        }
        return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
    };
    /**
     * Calculate VWAP and determine position relative to price
     *
     * @param candles - Array of candles
     * @param currentPrice - Current market price
     * @returns Object with VWAP value and position (above/below/at)
     */
    VWAPIndicator.prototype.analyze = function (candles, currentPrice) {
        var vwap = this.calculate(candles);
        // Determine position
        var threshold = vwap * 0.0001; // 0.01% threshold for "AT"
        var position;
        if (currentPrice > vwap + threshold) {
            position = 'ABOVE';
        }
        else if (currentPrice < vwap - threshold) {
            position = 'BELOW';
        }
        else {
            position = 'AT';
        }
        // Distance from VWAP
        var distance = currentPrice - vwap;
        var distancePercent = vwap > 0 ? (distance / vwap) * 100 : 0;
        return {
            vwap: vwap,
            position: position,
            distance: distance,
            distancePercent: distancePercent,
        };
    };
    /**
     * Check if price is aligned with VWAP for given direction
     *
     * @param candles - Array of candles
     * @param currentPrice - Current market price
     * @param direction - Trade direction ('LONG' or 'SHORT')
     * @returns true if aligned (LONG above VWAP, SHORT below VWAP)
     */
    VWAPIndicator.prototype.isAligned = function (candles, currentPrice, direction) {
        var position = this.analyze(candles, currentPrice).position;
        if (direction === 'LONG') {
            return position === 'ABOVE' || position === 'AT';
        }
        else {
            return position === 'BELOW' || position === 'AT';
        }
    };
    return VWAPIndicator;
}());
exports.VWAPIndicator = VWAPIndicator;
