"use strict";
/**
 * Wick Analyzer
 *
 * Detects large wicks (rejection candles) that signal potential reversals or resistance.
 * Wick > 2x body size indicates strong rejection at that level.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WickAnalyzer = exports.WickDirection = void 0;
var types_1 = require("../types");
// ============================================================================
// CONSTANTS
// ============================================================================
var LARGE_WICK_THRESHOLD = 2.0; // Wick > 2x body = large wick
// ============================================================================
// TYPES
// ============================================================================
var WickDirection;
(function (WickDirection) {
    WickDirection["UP"] = "UP";
    WickDirection["DOWN"] = "DOWN";
    WickDirection["NONE"] = "NONE";
})(WickDirection || (exports.WickDirection = WickDirection = {}));
// ============================================================================
// WICK ANALYZER
// ============================================================================
var WickAnalyzer = /** @class */ (function () {
    function WickAnalyzer(logger) {
        this.logger = logger;
    }
    /**
     * Detect large wicks on a candle
     * @param candle - Candle to analyze
     * @returns Wick analysis result
     */
    WickAnalyzer.prototype.analyze = function (candle) {
        var bodySize = Math.abs(candle.close - candle.open);
        // Handle doji/very small body
        if (bodySize < 0.0001) {
            this.logger.debug('Doji candle detected (no body)', {
                timestamp: candle.timestamp,
            });
            return this.noWick(0);
        }
        var upperWick = candle.high - Math.max(candle.open, candle.close);
        var lowerWick = Math.min(candle.open, candle.close) - candle.low;
        // Check upper wick
        if (upperWick > bodySize * LARGE_WICK_THRESHOLD) {
            var ratio = upperWick / bodySize;
            this.logger.debug('Large upper wick detected', {
                upperWick: upperWick.toFixed(4),
                bodySize: bodySize.toFixed(4),
                ratio: ratio.toFixed(2),
            });
            return {
                hasLargeWick: true,
                wickDirection: WickDirection.UP,
                wickSize: upperWick,
                bodySize: bodySize,
                wickToBodyRatio: ratio,
                blocksDirection: types_1.SignalDirection.LONG, // Upper wick blocks LONG (resistance)
            };
        }
        // Check lower wick
        if (lowerWick > bodySize * LARGE_WICK_THRESHOLD) {
            var ratio = lowerWick / bodySize;
            this.logger.debug('Large lower wick detected', {
                lowerWick: lowerWick.toFixed(4),
                bodySize: bodySize.toFixed(4),
                ratio: ratio.toFixed(2),
            });
            return {
                hasLargeWick: true,
                wickDirection: WickDirection.DOWN,
                wickSize: lowerWick,
                bodySize: bodySize,
                wickToBodyRatio: ratio,
                blocksDirection: types_1.SignalDirection.SHORT, // Lower wick blocks SHORT (support)
            };
        }
        // No large wick
        return this.noWick(bodySize);
    };
    /**
     * Check if wick blocks a specific signal direction
     * @param wickAnalysis - Wick analysis result
     * @param signalDirection - Signal direction to check
     * @returns True if wick blocks this direction
     */
    WickAnalyzer.prototype.blocksSignal = function (wickAnalysis, signalDirection) {
        if (!wickAnalysis.hasLargeWick || !wickAnalysis.blocksDirection) {
            return false;
        }
        return wickAnalysis.blocksDirection === signalDirection;
    };
    /**
     * Return no wick result
     */
    WickAnalyzer.prototype.noWick = function (bodySize) {
        return {
            hasLargeWick: false,
            wickDirection: WickDirection.NONE,
            wickSize: 0,
            bodySize: bodySize,
            wickToBodyRatio: 0,
        };
    };
    return WickAnalyzer;
}());
exports.WickAnalyzer = WickAnalyzer;
