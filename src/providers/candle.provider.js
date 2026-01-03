"use strict";
/**
 * CandleProvider
 *
 * Manages multi-timeframe candle caching with separate LRU caches per timeframe.
 * Replaces MarketDataCollectorService for candle management.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleProvider = void 0;
var lru_cache_1 = require("../utils/lru-cache");
var CandleProvider = /** @class */ (function () {
    function CandleProvider(timeframeProvider, bybitService, logger, symbol) {
        this.timeframeProvider = timeframeProvider;
        this.bybitService = bybitService;
        this.logger = logger;
        this.symbol = symbol;
        this.ttl = 60000; // 1 minute TTL
        this.caches = new Map();
        this.lastUpdate = new Map();
        this.initializeCaches();
    }
    /**
     * Initialize LRU caches for all enabled timeframes
     */
    CandleProvider.prototype.initializeCaches = function () {
        var timeframes = this.timeframeProvider.getAllTimeframes();
        for (var _i = 0, timeframes_1 = timeframes; _i < timeframes_1.length; _i++) {
            var _a = timeframes_1[_i], role = _a[0], config = _a[1];
            var cache = new lru_cache_1.ArrayLRUCache(config.candleLimit);
            this.caches.set(role, cache);
            this.lastUpdate.set(role, 0);
            this.logger.info("Initialized cache for ".concat(role, " (").concat(config.interval, "m, limit: ").concat(config.candleLimit, ")"));
        }
    };
    /**
     * Load initial candles for all timeframes
     */
    CandleProvider.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timeframes, loadPromises, _i, timeframes_2, _a, role, config;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.logger.info('🔄 Loading initial candles for all timeframes...');
                        timeframes = this.timeframeProvider.getAllTimeframes();
                        loadPromises = [];
                        for (_i = 0, timeframes_2 = timeframes; _i < timeframes_2.length; _i++) {
                            _a = timeframes_2[_i], role = _a[0], config = _a[1];
                            loadPromises.push(this.loadTimeframeCandles(role, config.interval, config.candleLimit));
                        }
                        return [4 /*yield*/, Promise.all(loadPromises)];
                    case 1:
                        _b.sent();
                        this.logger.info('✅ All timeframe candles loaded successfully');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load candles for a specific timeframe
     */
    CandleProvider.prototype.loadTimeframeCandles = function (role, interval, limit) {
        return __awaiter(this, void 0, void 0, function () {
            var candles, cache, _i, candles_1, candle, error_1, errorObj;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.info("Loading ".concat(limit, " candles for ").concat(role, " (").concat(interval, "m)..."));
                        return [4 /*yield*/, this.bybitService.getCandles(this.symbol, interval, limit)];
                    case 1:
                        candles = _a.sent();
                        cache = this.caches.get(role);
                        if (!cache) {
                            throw new Error("Cache not found for ".concat(role));
                        }
                        // Add all candles to cache
                        for (_i = 0, candles_1 = candles; _i < candles_1.length; _i++) {
                            candle = candles_1[_i];
                            cache.push(candle);
                        }
                        this.lastUpdate.set(role, Date.now());
                        this.logger.info("\u2705 Loaded ".concat(candles.length, " candles for ").concat(role));
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        errorObj = error_1 instanceof Error ? { error: error_1.message } : { error: String(error_1) };
                        this.logger.error("Failed to load candles for ".concat(role), errorObj);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle candle closed event and update cache
     */
    CandleProvider.prototype.onCandleClosed = function (role, candle) {
        var cache = this.caches.get(role);
        if (!cache) {
            this.logger.warn("Cache not found for ".concat(role, ", skipping update"));
            return;
        }
        cache.push(candle);
        this.lastUpdate.set(role, Date.now());
        this.logger.debug("\uD83D\uDCCA Cache updated for ".concat(role), {
            timestamp: new Date(candle.timestamp).toISOString(),
            close: candle.close,
        });
    };
    /**
     * Get candles for a specific timeframe
     * @param role - Timeframe role
     * @param limit - Optional limit (defaults to all candles in cache)
     */
    CandleProvider.prototype.getCandles = function (role, limit) {
        return __awaiter(this, void 0, void 0, function () {
            var cache, config, candles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cache = this.caches.get(role);
                        if (!cache) {
                            throw new Error("Cache not found for ".concat(role));
                        }
                        if (!!this.isCacheValid(role)) return [3 /*break*/, 2];
                        this.logger.warn("Cache for ".concat(role, " is stale, reloading..."));
                        config = this.timeframeProvider.getTimeframe(role);
                        if (!config) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.loadTimeframeCandles(role, config.interval, config.candleLimit)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        candles = cache.getAll();
                        return [2 /*return*/, limit ? candles.slice(-limit) : candles];
                }
            });
        });
    };
    /**
     * Check if cache is valid (within TTL)
     */
    CandleProvider.prototype.isCacheValid = function (role) {
        var lastUpdate = this.lastUpdate.get(role) || 0;
        return Date.now() - lastUpdate < this.ttl;
    };
    /**
     * Get cache metrics for a specific timeframe
     * Note: ArrayLRUCache doesn't track hits/misses internally, so we return basic metrics
     */
    CandleProvider.prototype.getCacheMetrics = function (role) {
        var cache = this.caches.get(role);
        if (!cache) {
            return null;
        }
        return {
            hits: 0, // Not tracked by ArrayLRUCache
            misses: 0, // Not tracked by ArrayLRUCache
            hitRate: 1.0, // Assume 100% since we always use cache after initialization
        };
    };
    /**
     * Get cache metrics for all timeframes
     */
    CandleProvider.prototype.getAllCacheMetrics = function () {
        var metricsMap = new Map();
        for (var _i = 0, _a = this.caches.keys(); _i < _a.length; _i++) {
            var role = _a[_i];
            var metrics = this.getCacheMetrics(role);
            if (metrics) {
                metricsMap.set(role, metrics);
            }
        }
        return metricsMap;
    };
    /**
     * Get cache size for a timeframe
     */
    CandleProvider.prototype.getCacheSize = function (role) {
        var cache = this.caches.get(role);
        return cache ? cache.size() : 0;
    };
    /**
     * Clear cache for a specific timeframe
     */
    CandleProvider.prototype.clearCache = function (role) {
        var cache = this.caches.get(role);
        if (cache) {
            cache.clear();
            this.lastUpdate.set(role, 0);
            this.logger.info("Cache cleared for ".concat(role));
        }
    };
    /**
     * Clear all caches
     */
    CandleProvider.prototype.clearAllCaches = function () {
        for (var _i = 0, _a = this.caches.keys(); _i < _a.length; _i++) {
            var role = _a[_i];
            this.clearCache(role);
        }
        this.logger.info('All caches cleared');
    };
    return CandleProvider;
}());
exports.CandleProvider = CandleProvider;
