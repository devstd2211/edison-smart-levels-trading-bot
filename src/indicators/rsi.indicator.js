"use strict";
/**
 * RSI Indicator (Relative Strength Index)
 * Measures momentum and overbought/oversold conditions
 *
 * Formula:
 * 1. Calculate price changes (gains and losses)
 * 2. Average gain = EMA of gains over period
 * 3. Average loss = EMA of losses over period
 * 4. RS = Average Gain / Average Loss
 * 5. RSI = 100 - (100 / (1 + RS))
 *
 * Range: 0-100
 * - Above 70: Overbought
 * - Below 30: Oversold
 *
 * Implementation: Wilder's smoothing (modified EMA)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSIIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var RSI_MIN = 0;
var RSI_MAX = 100;
var RSI_NEUTRAL = 50;
var ZERO_DIVISION_FALLBACK = RSI_NEUTRAL;
var PERCENT_DIVISOR = 100;
// ============================================================================
// RSI CALCULATOR
// ============================================================================
var RSIIndicator = /** @class */ (function () {
    function RSIIndicator(period) {
        this.avgGain = 0;
        this.avgLoss = 0;
        this.initialized = false;
        this.period = period;
    }
    /**
     * Calculate RSI for a series of candles
     *
     * @param candles - Array of candles (must be at least period + 1 length)
     * @returns RSI value (0-100)
     * @throws {Error} If not enough candles
     */
    RSIIndicator.prototype.calculate = function (candles) {
        if (candles.length < this.period + 1) {
            throw new Error("Not enough candles for RSI calculation. Need ".concat(this.period + 1, ", got ").concat(candles.length));
        }
        // Reset state
        this.initialized = false;
        // Calculate price changes
        var changes = [];
        for (var i = 1; i < candles.length; i++) {
            changes.push(candles[i].close - candles[i - 1].close);
        }
        // Initial averages (simple average for first period)
        var sumGain = 0;
        var sumLoss = 0;
        for (var i = 0; i < this.period; i++) {
            if (changes[i] > 0) {
                sumGain += changes[i];
            }
            else {
                sumLoss += Math.abs(changes[i]);
            }
        }
        this.avgGain = sumGain / this.period;
        this.avgLoss = sumLoss / this.period;
        this.initialized = true;
        // Wilder's smoothing for remaining periods
        for (var i = this.period; i < changes.length; i++) {
            var change = changes[i];
            var gain = change > 0 ? change : 0;
            var loss = change < 0 ? Math.abs(change) : 0;
            this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
            this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
        }
        // Calculate RSI
        return this.calculateRSI();
    };
    /**
     * Update RSI with a new candle (incremental calculation)
     *
     * @param previousClose - Previous candle close
     * @param currentClose - Current candle close
     * @returns Updated RSI value
     * @throws {Error} If not initialized
     */
    RSIIndicator.prototype.update = function (previousClose, currentClose) {
        if (!this.initialized) {
            throw new Error('RSI not initialized. Call calculate() first.');
        }
        var change = currentClose - previousClose;
        var gain = change > 0 ? change : 0;
        var loss = change < 0 ? Math.abs(change) : 0;
        // Wilder's smoothing
        this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
        this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
        return this.calculateRSI();
    };
    /**
     * Calculate RSI from current avg gain/loss
     *
     * @returns RSI value (0-100)
     */
    RSIIndicator.prototype.calculateRSI = function () {
        if (this.avgLoss === 0) {
            // No losses means RSI = 100 (or 50 if no gains either)
            return this.avgGain === 0 ? ZERO_DIVISION_FALLBACK : RSI_MAX;
        }
        var rs = this.avgGain / this.avgLoss;
        var rsi = RSI_MAX - (PERCENT_DIVISOR / (1 + rs));
        // Clamp to valid range
        return Math.max(RSI_MIN, Math.min(RSI_MAX, rsi));
    };
    /**
     * Get current state
     *
     * @returns Current avg gain and loss
     */
    RSIIndicator.prototype.getState = function () {
        return {
            avgGain: this.avgGain,
            avgLoss: this.avgLoss,
            initialized: this.initialized,
        };
    };
    /**
     * Reset indicator state
     */
    RSIIndicator.prototype.reset = function () {
        this.avgGain = 0;
        this.avgLoss = 0;
        this.initialized = false;
    };
    return RSIIndicator;
}());
exports.RSIIndicator = RSIIndicator;
