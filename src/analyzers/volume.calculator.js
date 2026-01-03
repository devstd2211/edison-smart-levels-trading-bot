"use strict";
/**
 * Volume Calculator
 *
 * Calculates volume metrics and confirmations for trading signals.
 * Used to filter out low liquidity entries and boost high volume signals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeCalculator = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var DEFAULT_ROLLING_PERIOD = 20; // Candles for average calculation
var LOW_VOLUME_THRESHOLD = 0.5; // Volume < 0.5x avg = low liquidity
var HIGH_VOLUME_THRESHOLD = 2.0; // Volume > 2x avg = high volume
// ============================================================================
// VOLUME CALCULATOR
// ============================================================================
var VolumeCalculator = /** @class */ (function () {
    function VolumeCalculator(logger, rollingPeriod) {
        if (rollingPeriod === void 0) { rollingPeriod = DEFAULT_ROLLING_PERIOD; }
        this.logger = logger;
        this.rollingPeriod = rollingPeriod;
    }
    /**
     * Calculate volume analysis
     * @param candles - Recent candles (at least rollingPeriod candles)
     * @returns Volume analysis result
     */
    VolumeCalculator.prototype.calculate = function (candles) {
        if (candles.length < this.rollingPeriod) {
            this.logger.warn('Not enough candles for volume analysis', {
                required: this.rollingPeriod,
                available: candles.length,
            });
            return this.noVolumeData();
        }
        // Calculate average volume over rolling period
        var recentCandles = candles.slice(-this.rollingPeriod);
        var avgVolume = recentCandles.reduce(function (sum, c) { return sum + c.volume; }, 0) / this.rollingPeriod;
        // Current candle volume
        var currentCandle = candles[candles.length - 1];
        var currentVolume = currentCandle.volume;
        // Volume ratio
        var volumeRatio = currentVolume / avgVolume;
        // Low/High volume detection
        var isLowVolume = volumeRatio < LOW_VOLUME_THRESHOLD;
        var isHighVolume = volumeRatio > HIGH_VOLUME_THRESHOLD;
        // Volume modifier for confidence
        var volumeModifier = this.calculateVolumeModifier(volumeRatio);
        this.logger.debug('Volume analysis', {
            currentVolume: currentVolume.toFixed(2),
            avgVolume: avgVolume.toFixed(2),
            volumeRatio: volumeRatio.toFixed(2),
            isLowVolume: isLowVolume,
            isHighVolume: isHighVolume,
            volumeModifier: (volumeModifier * 100 - 100).toFixed(1) + '%',
        });
        return {
            currentVolume: currentVolume,
            avgVolume: avgVolume,
            volumeRatio: volumeRatio,
            isLowVolume: isLowVolume,
            isHighVolume: isHighVolume,
            volumeModifier: volumeModifier,
        };
    };
    /**
     * Calculate volume modifier for confidence
     * @param volumeRatio - Current volume / average volume
     * @returns Modifier (0.90 to 1.10)
     */
    VolumeCalculator.prototype.calculateVolumeModifier = function (volumeRatio) {
        if (volumeRatio > HIGH_VOLUME_THRESHOLD) {
            // High volume: +10% confidence
            return 1.1;
        }
        else if (volumeRatio < LOW_VOLUME_THRESHOLD) {
            // Low volume: -10% confidence
            return 0.9;
        }
        // Normal volume: no modifier
        return 1.0;
    };
    /**
     * Return no volume data result
     */
    VolumeCalculator.prototype.noVolumeData = function () {
        return {
            currentVolume: 0,
            avgVolume: 0,
            volumeRatio: 0,
            isLowVolume: false,
            isHighVolume: false,
            volumeModifier: 1.0,
        };
    };
    return VolumeCalculator;
}());
exports.VolumeCalculator = VolumeCalculator;
