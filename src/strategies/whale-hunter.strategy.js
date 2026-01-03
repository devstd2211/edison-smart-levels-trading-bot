"use strict";
/**
 * Whale Hunter Strategy
 *
 * Aggressive strategy that rides with whale movements detected in order book.
 *
 * Uses WhaleDetectorService with 3 detection modes:
 * - IMBALANCE_SPIKE: Highest priority (immediate momentum)
 * - WALL_BREAK: Medium priority (breakout momentum)
 * - WALL_DISAPPEARANCE: Lowest priority (reversal play)
 *
 * Risk Management:
 * - Small position size (high risk)
 * - Tight stop-loss (whales can deceive)
 * - Quick take-profit (exit before whale changes mind)
 * - Time-based exit (if no movement in 30s)
 *
 * IMPORTANT: Requires frequent order book updates!
 * - WebSocket orderbook stream recommended
 * - REST API polling should be < 5 seconds
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
exports.WhaleHunterStrategy = void 0;
var types_1 = require("../types");
var whale_detector_service_1 = require("../services/whale-detector.service");
var session_detector_1 = require("../utils/session-detector");
// ============================================================================
// WHALE HUNTER STRATEGY
// ============================================================================
var WhaleHunterStrategy = /** @class */ (function () {
    function WhaleHunterStrategy(config, whaleDetector, orderbookAnalyzer, logger) {
        this.config = config;
        this.whaleDetector = whaleDetector;
        this.orderbookAnalyzer = orderbookAnalyzer;
        this.logger = logger;
        this.name = 'WHALE_HUNTER';
        this.lastTradeTime = 0;
        this.consecutiveSignals = 0;
        this.lastSignalMode = null;
        this.priority = config.priority;
    }
    /**
     * Evaluate whale hunter strategy
     *
     * @param marketData - Market data (must include orderbook)
     * @returns Strategy signal
     */
    WhaleHunterStrategy.prototype.evaluate = function (marketData) {
        return __awaiter(this, void 0, void 0, function () {
            var currentPrice, bids, asks, orderbookData, orderbookAnalysis, btcMomentum, btcDirection, whaleSignal, atrPercent, strategySignal;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                // Check if strategy is enabled
                if (!this.config.enabled) {
                    return [2 /*return*/, this.noSignal('Strategy disabled')];
                }
                // Check cooldown (avoid over-trading)
                if (this.isInCooldown()) {
                    return [2 /*return*/, this.noSignal('In cooldown period')];
                }
                // Check if we have order book data
                if (!marketData.orderbook) {
                    this.logger.warn('WhaleHunterStrategy: No orderbook data available');
                    return [2 /*return*/, this.noSignal('No orderbook data')];
                }
                currentPrice = marketData.candles[marketData.candles.length - 1].close;
                bids = Array.isArray(marketData.orderbook.bids[0])
                    ? marketData.orderbook.bids.map(function (_a) {
                        var price = _a[0], quantity = _a[1];
                        return ({ price: price, quantity: quantity });
                    })
                    : marketData.orderbook.bids.map(function (b) { return ({ price: b.price, quantity: b.size || b.quantity }); });
                asks = Array.isArray(marketData.orderbook.asks[0])
                    ? marketData.orderbook.asks.map(function (_a) {
                        var price = _a[0], quantity = _a[1];
                        return ({ price: price, quantity: quantity });
                    })
                    : marketData.orderbook.asks.map(function (a) { return ({ price: a.price, quantity: a.size || a.quantity }); });
                orderbookData = {
                    bids: bids,
                    asks: asks,
                    timestamp: marketData.orderbook.timestamp,
                };
                orderbookAnalysis = this.orderbookAnalyzer.analyze(orderbookData, currentPrice);
                btcMomentum = (_b = (_a = marketData.context) === null || _a === void 0 ? void 0 : _a.btcAnalysis) === null || _b === void 0 ? void 0 : _b.momentum;
                btcDirection = (_d = (_c = marketData.context) === null || _c === void 0 ? void 0 : _c.btcAnalysis) === null || _d === void 0 ? void 0 : _d.direction;
                whaleSignal = this.whaleDetector.detectWhale(orderbookAnalysis, currentPrice, btcMomentum, btcDirection);
                // Check if whale detected
                if (!whaleSignal.detected) {
                    this.resetConsecutiveSignals();
                    return [2 /*return*/, this.noSignal('No whale detected')];
                }
                // Check confidence threshold
                if (whaleSignal.confidence < this.config.minConfidence) {
                    this.logger.debug('WhaleHunterStrategy: Confidence too low', {
                        confidence: whaleSignal.confidence,
                        threshold: this.config.minConfidence,
                    });
                    this.resetConsecutiveSignals();
                    return [2 /*return*/, this.noSignal("Confidence too low: ".concat(whaleSignal.confidence))];
                }
                // Check ATR volatility threshold (block signals during extreme volatility)
                if (this.config.maxAtrPercent && ((_e = marketData.context) === null || _e === void 0 ? void 0 : _e.atrPercent)) {
                    atrPercent = marketData.context.atrPercent;
                    if (atrPercent > this.config.maxAtrPercent) {
                        this.logger.info('❌ WhaleHunter BLOCKED', {
                            blockedBy: ['HIGH_ATR_VOLATILITY'],
                            reason: "ATR volatility too high: ".concat(atrPercent.toFixed(2), "% > ").concat(this.config.maxAtrPercent, "%"),
                            atrPercent: atrPercent.toFixed(2),
                            threshold: this.config.maxAtrPercent,
                            whaleMode: whaleSignal.mode,
                        });
                        this.resetConsecutiveSignals();
                        return [2 /*return*/, this.noSignal("ATR volatility too high: ".concat(atrPercent.toFixed(2), "%"))];
                    }
                }
                // Track consecutive signals
                this.trackConsecutiveSignals(whaleSignal);
                // Check if we need multiple signals
                if (this.config.requireMultipleSignals && this.consecutiveSignals < 2) {
                    this.logger.debug('WhaleHunterStrategy: Waiting for consecutive signal', {
                        current: this.consecutiveSignals,
                        required: 2,
                    });
                    return [2 /*return*/, this.noSignal('Waiting for consecutive signal')];
                }
                strategySignal = this.generateStrategySignal(whaleSignal, marketData, orderbookAnalysis);
                // Mark trade time for cooldown
                this.lastTradeTime = Date.now();
                this.resetConsecutiveSignals();
                return [2 /*return*/, strategySignal];
            });
        });
    };
    // ==========================================================================
    // PRIVATE METHODS - Signal Generation
    // ==========================================================================
    /**
     * Generate strategy signal from whale signal
     */
    WhaleHunterStrategy.prototype.generateStrategySignal = function (whaleSignal, marketData, orderbookAnalysis) {
        var _a, _b;
        var currentCandle = marketData.candles[marketData.candles.length - 1];
        var currentPrice = currentCandle.close;
        // Calculate risk/reward based on whale mode
        var _c = this.calculateRiskReward(whaleSignal.mode), stopLossPercent = _c.stopLossPercent, takeProfitPercent = _c.takeProfitPercent;
        // Calculate entry, SL prices
        var direction = whaleSignal.direction;
        var entryPrice = currentPrice;
        // Calculate base SL distance
        var stopLossDistance = entryPrice * (stopLossPercent / 100);
        // Apply session-based SL widening if enabled
        stopLossDistance = session_detector_1.SessionDetector.applySessionBasedSL(stopLossDistance, this.config.sessionBasedSL, this.logger, this.name);
        var stopLoss = direction === types_1.SignalDirection.LONG
            ? entryPrice - stopLossDistance
            : entryPrice + stopLossDistance;
        // Check if adaptive TP is enabled
        var useMicroProfits = ((_a = this.config.adaptiveTakeProfit) === null || _a === void 0 ? void 0 : _a.enabled) === true;
        var takeProfits;
        if (useMicroProfits && ((_b = this.config.adaptiveTakeProfit) === null || _b === void 0 ? void 0 : _b.levels)) {
            // Use adaptive TP levels from config (micro-profits: 0.3%, 0.6%, 1.2%)
            this.logger.debug('🎯 Using adaptive TP levels (micro-profit mode)', {
                mode: whaleSignal.mode,
                levels: this.config.adaptiveTakeProfit.levels.map(function (l) { return "".concat(l.percent, "%"); })
            });
            takeProfits = this.config.adaptiveTakeProfit.levels.map(function (tpConfig) {
                var tpPrice = direction === types_1.SignalDirection.LONG
                    ? entryPrice * (1 + tpConfig.percent / 100)
                    : entryPrice * (1 - tpConfig.percent / 100);
                return {
                    level: tpConfig.level,
                    percent: tpConfig.percent,
                    sizePercent: tpConfig.sizePercent,
                    price: tpPrice,
                    hit: false,
                };
            });
        }
        else {
            // Use default TP levels (old behavior)
            var takeProfit = direction === types_1.SignalDirection.LONG
                ? entryPrice * (1 + takeProfitPercent / 100)
                : entryPrice * (1 - takeProfitPercent / 100);
            var tp1Percent = takeProfitPercent * 0.5; // First TP at 50% of target
            var tp1Price = direction === types_1.SignalDirection.LONG
                ? entryPrice * (1 + tp1Percent / 100)
                : entryPrice * (1 - tp1Percent / 100);
            takeProfits = [
                {
                    level: 1,
                    percent: tp1Percent,
                    sizePercent: 50, // Close 50% → activate breakeven
                    price: tp1Price,
                    hit: false,
                },
                {
                    level: 2,
                    percent: takeProfitPercent,
                    sizePercent: 50, // Close remaining 50% → activate trailing
                    price: takeProfit,
                    hit: false,
                },
            ];
        }
        // Apply dynamic TP multiplier based on market conditions
        var dynamicMultiplier = this.calculateDynamicTPMultiplier(orderbookAnalysis, marketData);
        if (dynamicMultiplier > 1.0) {
            takeProfits = takeProfits.map(function (tp) {
                var adjustedPercent = tp.percent * dynamicMultiplier;
                var adjustedPrice = direction === types_1.SignalDirection.LONG
                    ? entryPrice * (1 + adjustedPercent / 100)
                    : entryPrice * (1 - adjustedPercent / 100);
                return __assign(__assign({}, tp), { percent: adjustedPercent, price: adjustedPrice });
            });
            this.logger.info('🎯 Dynamic TP applied', {
                multiplier: dynamicMultiplier.toFixed(2),
                adjustedLevels: takeProfits.map(function (tp) { return "".concat(tp.percent.toFixed(2), "%"); }),
            });
        }
        var signal = {
            type: types_1.SignalType.WHALE_HUNTER,
            direction: direction,
            price: entryPrice,
            confidence: whaleSignal.confidence / 100, // Convert to 0-1 range
            reason: "\uD83D\uDC0B WHALE [".concat(whaleSignal.mode, "]: ").concat(whaleSignal.reason),
            timestamp: Date.now(),
            entryPrice: entryPrice,
            stopLoss: stopLoss,
            takeProfits: takeProfits,
            marketData: {
                rsi: marketData.rsi,
                rsiTrend1: marketData.rsiTrend1,
                ema20: marketData.ema.fast,
                ema50: marketData.ema.slow,
                atr: marketData.atr || 1.0,
                trend: marketData.trend,
                whaleMode: whaleSignal.mode || undefined,
                wallSize: orderbookAnalysis.walls.length > 0
                    ? Math.max.apply(Math, orderbookAnalysis.walls.map(function (w) { return w.quantity; })) : undefined,
                imbalance: orderbookAnalysis.imbalance.ratio,
                stochastic: marketData.stochastic,
                bollingerBands: marketData.bollingerBands,
                breakoutPrediction: marketData.breakoutPrediction,
            },
        };
        return {
            valid: true,
            signal: signal,
            strategyName: this.name,
            priority: this.priority,
            reason: signal.reason,
        };
    };
    /**
     * Calculate dynamic TP multiplier based on market conditions
     *
     * @param orderbookAnalysis - Current orderbook analysis
     * @param marketData - Market data (for ATR)
     * @returns Combined TP multiplier (1.0 = no adjustment)
     */
    WhaleHunterStrategy.prototype.calculateDynamicTPMultiplier = function (orderbookAnalysis, marketData) {
        var _a;
        // Check if dynamic TP is enabled
        if (!((_a = this.config.dynamicTakeProfit) === null || _a === void 0 ? void 0 : _a.enabled)) {
            return 1.0;
        }
        var multiplier = 1.0;
        // 1. Wall size-based adjustment
        if (this.config.dynamicTakeProfit.wallSizeBased.enabled) {
            var wallThreshold = this.config.dynamicTakeProfit.wallSizeBased.threshold;
            var wallMultiplier = this.config.dynamicTakeProfit.wallSizeBased.multiplier;
            // Find largest wall (bid or ask) by percentOfTotal
            var maxWallSize = orderbookAnalysis.walls.length > 0
                ? Math.max.apply(Math, orderbookAnalysis.walls.map(function (w) { return w.percentOfTotal; })) : 0;
            if (maxWallSize > wallThreshold) {
                multiplier *= wallMultiplier;
                this.logger.debug('📊 Dynamic TP: Wall size triggered', {
                    wallSize: maxWallSize.toFixed(1),
                    threshold: wallThreshold,
                    multiplier: wallMultiplier,
                });
            }
        }
        // 2. ATR-based adjustment
        if (this.config.dynamicTakeProfit.atrBased.enabled && marketData.atr) {
            var atrThreshold = this.config.dynamicTakeProfit.atrBased.threshold;
            var atrMultiplier = this.config.dynamicTakeProfit.atrBased.multiplier;
            // Calculate ATR as percentage of current price
            var currentPrice = marketData.candles[marketData.candles.length - 1].close;
            var atrPercent = (marketData.atr / currentPrice) * 100;
            if (atrPercent > atrThreshold) {
                multiplier *= atrMultiplier;
                this.logger.debug('📊 Dynamic TP: ATR volatility triggered', {
                    atrPercent: atrPercent.toFixed(2),
                    threshold: atrThreshold,
                    multiplier: atrMultiplier,
                });
            }
        }
        if (multiplier > 1.0) {
            this.logger.info('🎯 Dynamic TP multiplier activated', {
                totalMultiplier: multiplier.toFixed(2),
            });
        }
        return multiplier;
    };
    /**
     * Calculate risk/reward ratios based on whale detection mode
     *
     * Different modes have different reliability:
     * - IMBALANCE_SPIKE: Tight SL/TP (quick momentum play)
     * - WALL_BREAK: Medium SL/TP (breakout play)
     * - WALL_DISAPPEARANCE: Wider SL/TP (reversal play)
     */
    WhaleHunterStrategy.prototype.calculateRiskReward = function (mode) {
        switch (mode) {
            case whale_detector_service_1.WhaleDetectionMode.IMBALANCE_SPIKE:
                return {
                    stopLossPercent: 0.5, // 0.5% SL (very tight)
                    takeProfitPercent: 0.75, // 0.75% TP (quick profit)
                };
            case whale_detector_service_1.WhaleDetectionMode.WALL_BREAK:
                return {
                    stopLossPercent: 0.5, // 0.8% SL (medium)
                    takeProfitPercent: 0.75, // 1.2% TP (medium profit)
                };
            case whale_detector_service_1.WhaleDetectionMode.WALL_DISAPPEARANCE:
                return {
                    stopLossPercent: 1.0, // 1.0% SL (wider)
                    takeProfitPercent: 1.5, // 1.5% TP (larger profit)
                };
            default:
                return {
                    stopLossPercent: 0.8,
                    takeProfitPercent: 0.75,
                };
        }
    };
    // ==========================================================================
    // PRIVATE METHODS - Signal Tracking
    // ==========================================================================
    /**
     * Track consecutive whale signals (same mode)
     */
    WhaleHunterStrategy.prototype.trackConsecutiveSignals = function (whaleSignal) {
        if (this.lastSignalMode === whaleSignal.mode) {
            this.consecutiveSignals++;
        }
        else {
            this.consecutiveSignals = 1;
            this.lastSignalMode = whaleSignal.mode;
        }
    };
    /**
     * Reset consecutive signals counter
     */
    WhaleHunterStrategy.prototype.resetConsecutiveSignals = function () {
        this.consecutiveSignals = 0;
        this.lastSignalMode = null;
    };
    /**
     * Check if strategy is in cooldown period
     */
    WhaleHunterStrategy.prototype.isInCooldown = function () {
        if (this.lastTradeTime === 0) {
            return false;
        }
        var timeSinceLastTrade = Date.now() - this.lastTradeTime;
        return timeSinceLastTrade < this.config.cooldownMs;
    };
    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================
    /**
     * Get strategy statistics
     */
    WhaleHunterStrategy.prototype.getStats = function () {
        return {
            name: this.name,
            enabled: this.config.enabled,
            priority: this.priority,
            inCooldown: this.isInCooldown(),
            whaleDetectorStats: this.whaleDetector.getStats(),
        };
    };
    /**
     * Reset strategy state (useful for testing)
     */
    WhaleHunterStrategy.prototype.reset = function () {
        this.lastTradeTime = 0;
        this.resetConsecutiveSignals();
        this.whaleDetector.clear();
        this.logger.debug('WhaleHunterStrategy reset');
    };
    /**
     * Return no signal result
     */
    WhaleHunterStrategy.prototype.noSignal = function (reason) {
        return {
            valid: false,
            strategyName: this.name,
            priority: this.priority,
            reason: reason,
        };
    };
    return WhaleHunterStrategy;
}());
exports.WhaleHunterStrategy = WhaleHunterStrategy;
