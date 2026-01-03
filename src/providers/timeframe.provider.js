"use strict";
/**
 * TimeframeProvider
 *
 * Manages multi-timeframe configuration and provides access to timeframe settings.
 * Validates that entry and primary timeframes are always enabled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeframeProvider = void 0;
var types_1 = require("../types");
var TimeframeProvider = /** @class */ (function () {
    function TimeframeProvider(timeframesConfig) {
        this.timeframes = new Map();
        this.loadTimeframes(timeframesConfig);
        this.validateTimeframes();
    }
    /**
     * Load timeframes from config
     */
    TimeframeProvider.prototype.loadTimeframes = function (config) {
        var roleMapping = {
            entry: types_1.TimeframeRole.ENTRY,
            primary: types_1.TimeframeRole.PRIMARY,
            trend1: types_1.TimeframeRole.TREND1,
            trend2: types_1.TimeframeRole.TREND2,
            context: types_1.TimeframeRole.CONTEXT,
        };
        for (var _i = 0, _a = Object.entries(config); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], tfConfig = _b[1];
            var role = roleMapping[key];
            if (role && tfConfig.enabled) {
                this.timeframes.set(role, tfConfig);
            }
        }
    };
    /**
     * Validate that required timeframes are present
     */
    TimeframeProvider.prototype.validateTimeframes = function () {
        if (!this.timeframes.has(types_1.TimeframeRole.PRIMARY)) {
            throw new Error('PRIMARY timeframe is required but not enabled in config');
        }
        if (!this.timeframes.has(types_1.TimeframeRole.ENTRY)) {
            throw new Error('ENTRY timeframe is required but not enabled in config');
        }
    };
    /**
     * Get timeframe config by role
     */
    TimeframeProvider.prototype.getTimeframe = function (role) {
        return this.timeframes.get(role);
    };
    /**
     * Get all active timeframes
     */
    TimeframeProvider.prototype.getAllTimeframes = function () {
        return new Map(this.timeframes);
    };
    /**
     * Check if timeframe is enabled
     */
    TimeframeProvider.prototype.isTimeframeEnabled = function (role) {
        return this.timeframes.has(role);
    };
    /**
     * Convert Bybit interval to minutes
     * Examples: "1" -> 1, "5" -> 5, "60" -> 60, "240" -> 240
     */
    TimeframeProvider.prototype.intervalToMinutes = function (interval) {
        return parseInt(interval, 10);
    };
    /**
     * Get all enabled timeframe roles
     */
    TimeframeProvider.prototype.getEnabledRoles = function () {
        return Array.from(this.timeframes.keys());
    };
    /**
     * Get timeframe interval by role
     */
    TimeframeProvider.prototype.getInterval = function (role) {
        var _a;
        return (_a = this.timeframes.get(role)) === null || _a === void 0 ? void 0 : _a.interval;
    };
    /**
     * Get candle limit for timeframe
     */
    TimeframeProvider.prototype.getCandleLimit = function (role) {
        var _a;
        return (_a = this.timeframes.get(role)) === null || _a === void 0 ? void 0 : _a.candleLimit;
    };
    return TimeframeProvider;
}());
exports.TimeframeProvider = TimeframeProvider;
