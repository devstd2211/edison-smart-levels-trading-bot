"use strict";
/**
 * EMA Indicator (Exponential Moving Average)
 * Smooths price data with more weight on recent prices
 *
 * Formula:
 * 1. Multiplier = 2 / (period + 1)
 * 2. EMA = (Close - EMA_prev) * Multiplier + EMA_prev
 *
 * First EMA = SMA (Simple Moving Average) of first N periods
 *
 * Use cases:
 * - Trend identification (price above EMA = uptrend)
 * - Support/resistance levels
 * - Entry confirmation (price crosses EMA)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIndicator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var MULTIPLIER_NUMERATOR = 2;
var MULTIPLIER_DENOMINATOR_OFFSET = 1;
// ============================================================================
// EMA CALCULATOR
// ============================================================================
var EMAIndicator = /** @class */ (function () {
    function EMAIndicator(period) {
        this.ema = 0;
        this.initialized = false;
        this.period = period;
        this.multiplier = MULTIPLIER_NUMERATOR / (period + MULTIPLIER_DENOMINATOR_OFFSET);
    }
    /**
     * Calculate EMA for a series of candles
     *
     * @param candles - Array of candles (must be at least period length)
     * @returns EMA value
     * @throws {Error} If not enough candles
     */
    EMAIndicator.prototype.calculate = function (candles) {
        if (candles.length < this.period) {
            throw new Error("Not enough candles for EMA calculation. Need ".concat(this.period, ", got ").concat(candles.length));
        }
        // Reset state
        this.initialized = false;
        // Calculate initial SMA
        var sum = 0;
        for (var i = 0; i < this.period; i++) {
            sum += candles[i].close;
        }
        this.ema = sum / this.period;
        this.initialized = true;
        // Apply EMA formula for remaining candles
        for (var i = this.period; i < candles.length; i++) {
            this.ema = (candles[i].close - this.ema) * this.multiplier + this.ema;
        }
        return this.ema;
    };
    /**
     * Update EMA with a new price (incremental calculation)
     *
     * @param price - Current close price
     * @returns Updated EMA value
     * @throws {Error} If not initialized
     */
    EMAIndicator.prototype.update = function (price) {
        if (!this.initialized) {
            throw new Error('EMA not initialized. Call calculate() first.');
        }
        this.ema = (price - this.ema) * this.multiplier + this.ema;
        return this.ema;
    };
    /**
     * Get current EMA value
     *
     * @returns Current EMA
     * @throws {Error} If not initialized
     */
    EMAIndicator.prototype.getValue = function () {
        if (!this.initialized) {
            throw new Error('EMA not initialized. Call calculate() first.');
        }
        return this.ema;
    };
    /**
     * Get current state
     *
     * @returns Current EMA and initialization status
     */
    EMAIndicator.prototype.getState = function () {
        return {
            ema: this.ema,
            initialized: this.initialized,
        };
    };
    /**
     * Reset indicator state
     */
    EMAIndicator.prototype.reset = function () {
        this.ema = 0;
        this.initialized = false;
    };
    return EMAIndicator;
}());
exports.EMAIndicator = EMAIndicator;
