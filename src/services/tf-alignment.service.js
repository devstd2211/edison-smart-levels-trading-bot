"use strict";
/**
 * Timeframe Alignment Service (PHASE 6)
 *
 * Calculates multi-timeframe alignment score to boost signal confidence.
 * When all timeframes agree on direction, signal gets higher confidence.
 *
 * Scoring Logic:
 * - Entry TF (M1): price > EMA20 → +20 points
 * - Primary TF (M5): price > EMA20 → +30, price > EMA50 → +20
 * - Trend1 TF (M30): EMA20 > EMA50 → +30 points
 *
 * Total: 0-100 points
 * If score >= minAlignmentScore → aligned = true
 *
 * Example:
 * LONG signal at $100
 * - Entry M1: $100 > EMA20($99) ✅ +20 points
 * - Primary M5: $100 > EMA20($98) ✅ +30, $100 > EMA50($97) ✅ +20
 * - Trend1 M30: EMA20($99) > EMA50($96) ✅ +30 points
 * Total: 100 points → fully aligned → boost confidence
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TFAlignmentService = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var PERCENT_MULTIPLIER = 100;
var PRIMARY_EMA20_WEIGHT = 0.6; // 60% of primary weight
var PRIMARY_EMA50_WEIGHT = 0.4; // 40% of primary weight
// ============================================================================
// TF ALIGNMENT SERVICE
// ============================================================================
var TFAlignmentService = /** @class */ (function () {
    function TFAlignmentService(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Calculate timeframe alignment score
     *
     * @param direction - Trade direction ('LONG' or 'SHORT')
     * @param currentPrice - Current market price
     * @param indicators - Indicator values from all timeframes
     * @returns TFAlignmentResult with score, aligned flag, contributions, and details
     */
    TFAlignmentService.prototype.calculateAlignment = function (direction, currentPrice, indicators) {
        if (!this.config.enabled) {
            return this.createDisabledResult();
        }
        var score = 0;
        var contributions = { entry: 0, primary: 0, trend1: 0 };
        // ========================================================================
        // Entry TF (M1): Price vs EMA20
        // ========================================================================
        var entryAligned = direction === 'LONG'
            ? currentPrice > indicators.entry.ema20
            : currentPrice < indicators.entry.ema20;
        if (entryAligned) {
            contributions.entry = this.config.timeframes.entry.weight;
            score += contributions.entry;
        }
        // ========================================================================
        // Primary TF (M5): Price vs EMA20 + EMA50
        // ========================================================================
        var primaryEMA20Aligned = direction === 'LONG'
            ? currentPrice > indicators.primary.ema20
            : currentPrice < indicators.primary.ema20;
        var primaryEMA50Aligned = direction === 'LONG'
            ? currentPrice > indicators.primary.ema50
            : currentPrice < indicators.primary.ema50;
        if (primaryEMA20Aligned) {
            contributions.primary +=
                this.config.timeframes.primary.weight * PRIMARY_EMA20_WEIGHT;
        }
        if (primaryEMA50Aligned) {
            contributions.primary +=
                this.config.timeframes.primary.weight * PRIMARY_EMA50_WEIGHT;
        }
        score += contributions.primary;
        // ========================================================================
        // Trend1 TF (M30): EMA20 vs EMA50 (trend direction)
        // ========================================================================
        var trend1Aligned = direction === 'LONG'
            ? indicators.trend1.ema20 > indicators.trend1.ema50
            : indicators.trend1.ema20 < indicators.trend1.ema50;
        if (trend1Aligned) {
            contributions.trend1 = this.config.timeframes.trend1.weight;
            score += contributions.trend1;
        }
        // ========================================================================
        // Result
        // ========================================================================
        var aligned = score >= this.config.minAlignmentScore;
        var details = "Entry: ".concat(contributions.entry, ", Primary: ").concat(contributions.primary.toFixed(0), ", Trend1: ").concat(contributions.trend1);
        this.logger.debug('TF Alignment calculated', {
            direction: direction,
            score: score.toFixed(0),
            aligned: aligned,
            details: details,
        });
        return {
            score: score,
            aligned: aligned,
            contributions: contributions,
            details: details,
        };
    };
    /**
     * Create result for disabled service
     */
    TFAlignmentService.prototype.createDisabledResult = function () {
        return {
            score: 0,
            aligned: false,
            contributions: { entry: 0, primary: 0, trend1: 0 },
            details: 'TF Alignment disabled',
        };
    };
    /**
     * Get configuration
     */
    TFAlignmentService.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    return TFAlignmentService;
}());
exports.TFAlignmentService = TFAlignmentService;
