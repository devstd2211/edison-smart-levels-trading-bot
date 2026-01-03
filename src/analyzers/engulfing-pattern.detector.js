"use strict";
/**
 * Engulfing Pattern Detector
 *
 * Detects bullish and bearish engulfing candlestick patterns.
 * These are strong reversal signals when a candle's body completely
 * engulfs the previous candle's body.
 *
 * Bullish Engulfing:
 *  |░|     Red (bearish) candle
 * |▓▓▓|    Green (bullish) candle ENGULFS red → LONG signal
 *
 * Bearish Engulfing:
 *  |▓|     Green (bullish) candle
 * |░░░|    Red (bearish) candle ENGULFS green → SHORT signal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngulfingPatternDetector = exports.EngulfingPatternType = void 0;
// ============================================================================
// TYPES
// ============================================================================
var EngulfingPatternType;
(function (EngulfingPatternType) {
    EngulfingPatternType["BULLISH_ENGULFING"] = "BULLISH_ENGULFING";
    EngulfingPatternType["BEARISH_ENGULFING"] = "BEARISH_ENGULFING";
    EngulfingPatternType["NONE"] = "NONE";
})(EngulfingPatternType || (exports.EngulfingPatternType = EngulfingPatternType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var BASE_CONFIDENCE = 60; // Base confidence for detected pattern
var MIN_ENGULFING_RATIO = 1.0; // Current body must be at least same size as prev
// ============================================================================
// ENGULFING PATTERN DETECTOR
// ============================================================================
var EngulfingPatternDetector = /** @class */ (function () {
    function EngulfingPatternDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect engulfing pattern from last 2 candles
     * @param candles - Array of candles (minimum 2 required)
     * @returns EngulfingPattern result
     */
    EngulfingPatternDetector.prototype.detect = function (candles) {
        if (candles.length < 2) {
            return this.noPattern('Not enough candles (need 2)');
        }
        var prevCandle = candles[candles.length - 2];
        var currentCandle = candles[candles.length - 1];
        // Try bullish engulfing
        var bullishEngulfing = this.detectBullishEngulfing(prevCandle, currentCandle);
        if (bullishEngulfing.detected) {
            return bullishEngulfing;
        }
        // Try bearish engulfing
        var bearishEngulfing = this.detectBearishEngulfing(prevCandle, currentCandle);
        if (bearishEngulfing.detected) {
            return bearishEngulfing;
        }
        return this.noPattern('No engulfing pattern detected');
    };
    /**
     * Detect Bullish Engulfing
     * Previous candle: bearish (close < open)
     * Current candle: bullish (close > open) and ENGULFS previous
     */
    EngulfingPatternDetector.prototype.detectBullishEngulfing = function (prev, current) {
        // 1. Check previous candle is bearish
        var prevIsBearish = prev.close < prev.open;
        if (!prevIsBearish) {
            return this.noPattern('Previous candle not bearish');
        }
        // 2. Check current candle is bullish
        var currentIsBullish = current.close > current.open;
        if (!currentIsBullish) {
            return this.noPattern('Current candle not bullish');
        }
        // 3. Check engulfing: current body engulfs previous body
        var prevBody = Math.abs(prev.close - prev.open);
        var currentBody = Math.abs(current.close - current.open);
        // Current open should be at or below previous close
        // Current close should be at or above previous open
        var engulfs = current.open <= prev.close && current.close >= prev.open;
        if (!engulfs) {
            return this.noPattern('Current candle does not engulf previous');
        }
        // 4. Calculate engulfing ratio
        var engulfingRatio = currentBody / prevBody;
        if (engulfingRatio < MIN_ENGULFING_RATIO) {
            return this.noPattern("Engulfing ratio too small: ".concat(engulfingRatio.toFixed(2)));
        }
        // 5. Calculate confidence based on engulfing ratio
        var confidence = this.calculateConfidence(engulfingRatio);
        return {
            detected: true,
            type: EngulfingPatternType.BULLISH_ENGULFING,
            direction: 'LONG',
            confidence: confidence,
            engulfingRatio: engulfingRatio,
            prevCandle: prev,
            currentCandle: current,
            explanation: "Bullish Engulfing: ".concat(engulfingRatio.toFixed(2), "x bigger, confidence ").concat(confidence.toFixed(0), "%"),
        };
    };
    /**
     * Detect Bearish Engulfing
     * Previous candle: bullish (close > open)
     * Current candle: bearish (close < open) and ENGULFS previous
     */
    EngulfingPatternDetector.prototype.detectBearishEngulfing = function (prev, current) {
        // 1. Check previous candle is bullish
        var prevIsBullish = prev.close > prev.open;
        if (!prevIsBullish) {
            return this.noPattern('Previous candle not bullish');
        }
        // 2. Check current candle is bearish
        var currentIsBearish = current.close < current.open;
        if (!currentIsBearish) {
            return this.noPattern('Current candle not bearish');
        }
        // 3. Check engulfing: current body engulfs previous body
        var prevBody = Math.abs(prev.close - prev.open);
        var currentBody = Math.abs(current.close - current.open);
        // Current open should be at or above previous close
        // Current close should be at or below previous open
        var engulfs = current.open >= prev.close && current.close <= prev.open;
        if (!engulfs) {
            return this.noPattern('Current candle does not engulf previous');
        }
        // 4. Calculate engulfing ratio
        var engulfingRatio = currentBody / prevBody;
        if (engulfingRatio < MIN_ENGULFING_RATIO) {
            return this.noPattern("Engulfing ratio too small: ".concat(engulfingRatio.toFixed(2)));
        }
        // 5. Calculate confidence based on engulfing ratio
        var confidence = this.calculateConfidence(engulfingRatio);
        return {
            detected: true,
            type: EngulfingPatternType.BEARISH_ENGULFING,
            direction: 'SHORT',
            confidence: confidence,
            engulfingRatio: engulfingRatio,
            prevCandle: prev,
            currentCandle: current,
            explanation: "Bearish Engulfing: ".concat(engulfingRatio.toFixed(2), "x bigger, confidence ").concat(confidence.toFixed(0), "%"),
        };
    };
    /**
     * Calculate confidence based on engulfing ratio
     * Bigger engulfing = higher confidence
     */
    EngulfingPatternDetector.prototype.calculateConfidence = function (engulfingRatio) {
        // Base confidence: 60%
        var confidence = BASE_CONFIDENCE;
        // Bonus for larger engulfing
        // 1.5x = +10%, 2.0x = +20%, 3.0x = +40%
        var bonus = (engulfingRatio - 1.0) * 20;
        confidence += bonus;
        // Cap at 100%
        return Math.min(100, confidence);
    };
    /**
     * Return no pattern result
     */
    EngulfingPatternDetector.prototype.noPattern = function (reason) {
        return {
            detected: false,
            type: EngulfingPatternType.NONE,
            direction: 'LONG',
            confidence: 0,
            engulfingRatio: 0,
            prevCandle: {},
            currentCandle: {},
            explanation: reason,
        };
    };
    return EngulfingPatternDetector;
}());
exports.EngulfingPatternDetector = EngulfingPatternDetector;
