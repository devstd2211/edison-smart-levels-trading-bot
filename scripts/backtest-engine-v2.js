"use strict";
/**
 * Backtest Engine V2
 *
 * Uses REAL bot classes for accurate simulation:
 * - LevelBasedStrategy, TrendFollowingStrategy, CounterTrendStrategy
 * - RSIAnalyzer, EMAAnalyzer, ATRIndicator
 * - ZigZagIndicator, LiquidityDetector
 * - StrategyCoordinator
 *
 * LIMITATIONS:
 * - FastEntry NOT supported (requires intra-candle simulation)
 * - SmartBreakeven NOT supported (requires position monitoring)
 * - RetestEntry NOT supported (requires time-based waiting)
 * - Backtest simulates only CLOSED candles (no partial fills)
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestEngineV2 = void 0;
var types_1 = require("../src/types");
var level_based_strategy_1 = require("../src/strategies/level-based.strategy");
var trend_following_strategy_1 = require("../src/strategies/trend-following.strategy");
var counter_trend_strategy_1 = require("../src/strategies/counter-trend.strategy");
var whale_hunter_strategy_1 = require("../src/strategies/whale-hunter.strategy");
var rsi_indicator_1 = require("../src/indicators/rsi.indicator");
var ema_indicator_1 = require("../src/indicators/ema.indicator");
var atr_indicator_1 = require("../src/indicators/atr.indicator");
var zigzag_indicator_1 = require("../src/indicators/zigzag.indicator");
var liquidity_detector_1 = require("../src/analyzers/liquidity.detector");
var divergence_detector_1 = require("../src/analyzers/divergence.detector");
var stochastic_indicator_1 = require("../src/indicators/stochastic.indicator");
var bollinger_indicator_1 = require("../src/indicators/bollinger.indicator");
var entry_confirmation_service_1 = require("../src/services/entry-confirmation.service");
var context_analyzer_1 = require("../src/analyzers/context.analyzer");
var entry_scanner_1 = require("../src/analyzers/entry.scanner");
var types_2 = require("../src/types");
var weight_matrix_calculator_service_1 = require("../src/services/weight-matrix-calculator.service");
var whale_detector_service_1 = require("../src/services/whale-detector.service");
var orderbook_analyzer_1 = require("../src/analyzers/orderbook.analyzer");
// PHASE 5: Risk Management Services
var daily_limits_service_1 = require("../src/services/daily-limits.service");
var risk_based_sizing_service_1 = require("../src/services/risk-based-sizing.service");
var loss_streak_service_1 = require("../src/services/loss-streak.service");
var vwap_indicator_1 = require("../src/indicators/vwap.indicator");
var tf_alignment_service_1 = require("../src/services/tf-alignment.service");
// ============================================================================
// MOCK CANDLE PROVIDER FOR BACKTEST
// ============================================================================
var MockCandleProvider = /** @class */ (function () {
    function MockCandleProvider(logger, symbol) {
        this.candles1m = [];
        this.candles5m = [];
        this.candles15m = [];
        this.currentTimestamp = 0;
        this.logger = logger;
    }
    MockCandleProvider.prototype.setHistoricalData = function (candles1m, candles5m, candles15m, currentTimestamp) {
        this.candles1m = candles1m;
        this.candles5m = candles5m;
        this.candles15m = candles15m;
        this.currentTimestamp = currentTimestamp;
    };
    MockCandleProvider.prototype.getCandles = function (role, limit) {
        return __awaiter(this, void 0, void 0, function () {
            var candles;
            var _this = this;
            return __generator(this, function (_a) {
                switch (role) {
                    case types_2.TimeframeRole.ENTRY:
                        candles = this.candles1m.filter(function (c) { return c.timestamp <= _this.currentTimestamp; });
                        break;
                    case types_2.TimeframeRole.PRIMARY:
                        candles = this.candles5m.filter(function (c) { return c.timestamp <= _this.currentTimestamp; });
                        break;
                    case types_2.TimeframeRole.TREND1:
                        candles = this.candles15m.filter(function (c) { return c.timestamp <= _this.currentTimestamp; });
                        break;
                    default:
                        candles = [];
                }
                if (limit) {
                    return [2 /*return*/, candles.slice(-limit)];
                }
                return [2 /*return*/, candles];
            });
        });
    };
    MockCandleProvider.prototype.getCurrentPrice = function () {
        return __awaiter(this, void 0, void 0, function () {
            var recent;
            var _this = this;
            return __generator(this, function (_a) {
                recent = this.candles1m.filter(function (c) { return c.timestamp <= _this.currentTimestamp; });
                return [2 /*return*/, recent.length > 0 ? recent[recent.length - 1].close : 0];
            });
        });
    };
    return MockCandleProvider;
}());
// ============================================================================
// BACKTEST ENGINE V2
// ============================================================================
var BacktestEngineV2 = /** @class */ (function () {
    function BacktestEngineV2(config) {
        var _a, _b, _c, _d, _e, _f;
        // Real bot components (multiple strategies like real bot)
        this.strategies = [];
        this.currentContext = null;
        // State
        this.currentPosition = null;
        this.currentIndex = 0;
        this.trades = [];
        this.equityCurve = [];
        this.maxDrawdown = 0;
        this.pendingSignals = new Map();
        this.weightMatrix = null;
        this.dataProvider = null;
        // PHASE 5: Risk Management Services
        this.dailyLimitsService = null;
        this.riskBasedSizingService = null;
        this.lossStreakService = null;
        // PHASE 6: Multi-Timeframe Services
        this.vwapIndicator = null;
        this.tfAlignmentService = null;
        this.config = config;
        this.logger = new types_1.LoggerService(types_1.LogLevel.ERROR, './logs', false);
        this.balance = config.initialBalance;
        this.peakBalance = config.initialBalance;
        // Initialize Weight Matrix if enabled
        if ((_a = config.config.weightMatrix) === null || _a === void 0 ? void 0 : _a.enabled) {
            this.weightMatrix = new weight_matrix_calculator_service_1.WeightMatrixCalculatorService(config.config.weightMatrix, this.logger);
            this.logger.info('✅ Weight Matrix enabled for backtest', {
                minConfidenceToEnter: config.config.weightMatrix.minConfidenceToEnter,
            });
        }
        // Initialize all 3 strategies (like real bot) with Weight Matrix
        this.strategies.push(new trend_following_strategy_1.TrendFollowingStrategy(config.config.strategies.trendFollowing, this.logger, this.weightMatrix || undefined));
        this.strategies.push(new level_based_strategy_1.LevelBasedStrategy(config.config.strategies.levelBased, this.logger, this.weightMatrix || undefined));
        this.strategies.push(new counter_trend_strategy_1.CounterTrendStrategy(config.config.strategies.counterTrend, this.logger, this.weightMatrix || undefined));
        // Initialize WhaleHunter Strategy (if enabled and orderbook available)
        if ((_b = config.config.whaleHunter) === null || _b === void 0 ? void 0 : _b.enabled) {
            var whaleDetector = new whale_detector_service_1.WhaleDetectorService(config.config.whaleHunter.detector, this.logger);
            var orderbookConfig = {
                enabled: true,
                depth: 50,
                wallThreshold: 0.1,
                imbalanceThreshold: 1.5,
                updateIntervalMs: 5000,
            };
            var orderbookAnalyzer = new orderbook_analyzer_1.OrderBookAnalyzer(orderbookConfig, this.logger);
            this.strategies.push(new whale_hunter_strategy_1.WhaleHunterStrategy(__assign(__assign({}, config.config.whaleHunter), { sessionBasedSL: config.config.sessionBasedSL }), whaleDetector, orderbookAnalyzer, this.logger));
            this.logger.info('🐋 WhaleHunter enabled for backtest');
        }
        this.rsiIndicator = new rsi_indicator_1.RSIIndicator(14);
        this.emaIndicator = new ema_indicator_1.EMAIndicator(9); // Fast EMA
        this.atrIndicator = new atr_indicator_1.ATRIndicator(14);
        // Use same ZigZag depth as strategies (from config)
        var zigzagDepth = (_c = config.config.strategies.levelBased.zigzagDepth) !== null && _c !== void 0 ? _c : 12;
        this.zigzagIndicator = new zigzag_indicator_1.ZigZagIndicator(zigzagDepth);
        this.liquidityDetector = new liquidity_detector_1.LiquidityDetector(this.logger);
        this.divergenceDetector = new divergence_detector_1.DivergenceDetector(this.logger);
        this.stochasticIndicator = new stochastic_indicator_1.StochasticIndicator(14, 3, 3);
        this.bollingerIndicator = new bollinger_indicator_1.BollingerBandsIndicator(20, 2.0);
        this.entryConfirmation = new entry_confirmation_service_1.EntryConfirmationManager(config.config.entryConfirmation, this.logger);
        // Initialize Context and Entry Scanner (like live bot)
        this.candleProvider = new MockCandleProvider(this.logger, config.symbol);
        this.contextAnalyzer = new context_analyzer_1.ContextAnalyzer(config.config.contextConfig || {
            atrPeriod: 14,
            emaPeriod: 50,
            zigzagDepth: 5,
            minimumATR: 0.5,
            maximumATR: 3.0,
            maxEmaDistance: 2.0,
            filteringMode: 'HARD_BLOCK',
        }, this.candleProvider, this.logger);
        this.entryScanner = new entry_scanner_1.EntryScanner(config.config.entryConfig || {
            rsiPeriod: 14,
            fastEmaPeriod: 9,
            slowEmaPeriod: 21,
            zigzagDepth: 5,
            rsiOversold: 30,
            rsiOverbought: 70,
            stopLossPercent: 1.5,
            takeProfits: config.config.strategies.levelBased.takeProfits.map(function (tp) { return ({
                level: tp.level,
                percent: tp.percent,
                sizePercent: tp.sizePercent,
            }); }),
        }, this.candleProvider, this.logger);
        // ======================================================================
        // PHASE 5: Initialize Risk Management Services
        // ======================================================================
        if ((_d = config.config.dailyLimits) === null || _d === void 0 ? void 0 : _d.enabled) {
            this.dailyLimitsService = new daily_limits_service_1.DailyLimitsService(config.config.dailyLimits, this.logger);
            this.dailyLimitsService.setStartingBalance(config.initialBalance);
            this.logger.info('✅ Daily Limits enabled for backtest', {
                maxLoss: "-".concat(config.config.dailyLimits.maxDailyLossPercent, "%"),
                maxProfit: config.config.dailyLimits.maxDailyProfitPercent
                    ? "+".concat(config.config.dailyLimits.maxDailyProfitPercent, "%")
                    : 'disabled',
            });
        }
        if ((_e = config.config.riskBasedSizing) === null || _e === void 0 ? void 0 : _e.enabled) {
            this.riskBasedSizingService = new risk_based_sizing_service_1.RiskBasedSizingService(config.config.riskBasedSizing, this.logger);
            this.logger.info('🎯 Risk-Based Sizing enabled for backtest', {
                riskPercent: config.config.riskBasedSizing.riskPerTradePercent + '%',
            });
        }
        if ((_f = config.config.lossStreak) === null || _f === void 0 ? void 0 : _f.enabled) {
            this.lossStreakService = new loss_streak_service_1.LossStreakService(config.config.lossStreak, this.logger);
            this.logger.info('🔻 Loss Streak enabled for backtest', {
                reductions: config.config.lossStreak.reductions,
                stopAfterLosses: config.config.lossStreak.stopAfterLosses || 'disabled',
            });
        }
        // ======================================================================
        // PHASE 6: Initialize Multi-Timeframe Services
        // ======================================================================
        this.vwapIndicator = new vwap_indicator_1.VWAPIndicator();
        this.tfAlignmentService = new tf_alignment_service_1.TFAlignmentService(this.logger);
        this.logger.info('✅ PHASE6 Multi-TF services initialized (VWAP + TF Alignment)');
    }
    /**
     * Run backtest on historical data
     */
    BacktestEngineV2.prototype.run = function (candles1m, candles5m, candles15m, dataProvider) {
        return __awaiter(this, void 0, void 0, function () {
            var progress, progressInterval, i, currentCandle, historicalCandles1m, historicalCandles5m, historicalCandles15m, _a, lastCandle;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        // Save dataProvider as instance field for orderbook loading
                        this.dataProvider = dataProvider || null;
                        console.log('🚀 Starting backtest V2 (Real Bot Emulation)...');
                        console.log("\uD83D\uDCCA Data: ".concat(candles1m.length, " 1m candles"));
                        console.log("\uD83D\uDCB0 Initial balance: ".concat(this.config.initialBalance, " USDT"));
                        if (this.dataProvider) {
                            console.log('📚 Orderbook data: ENABLED (SQLite)');
                        }
                        progress = 0;
                        progressInterval = Math.floor(candles1m.length / 100);
                        i = 0;
                        _d.label = 1;
                    case 1:
                        if (!(i < candles1m.length)) return [3 /*break*/, 7];
                        currentCandle = candles1m[i];
                        // Show progress
                        if (i % progressInterval === 0) {
                            progress = Math.floor((i / candles1m.length) * 100);
                            process.stdout.write("\r\u23F3 Progress: ".concat(progress, "%"));
                        }
                        historicalCandles1m = this.getHistoricalCandles(candles1m, currentCandle.timestamp, 200);
                        historicalCandles5m = this.getHistoricalCandles(candles5m, currentCandle.timestamp, 200);
                        historicalCandles15m = this.getHistoricalCandles(candles15m, currentCandle.timestamp, 200);
                        // Update CandleProvider (for ContextAnalyzer and EntryScanner)
                        this.candleProvider.setHistoricalData(historicalCandles1m, historicalCandles5m, historicalCandles15m, currentCandle.timestamp);
                        if (!(historicalCandles5m.length >= 50)) return [3 /*break*/, 3];
                        _a = this;
                        return [4 /*yield*/, this.contextAnalyzer.analyze()];
                    case 2:
                        _a.currentContext = _d.sent();
                        _d.label = 3;
                    case 3:
                        // Debug: Log position status every 500 candles
                        if (i % 500 === 0) {
                            console.log("\n[STATUS] Candle ".concat(i, " @ ").concat(new Date(currentCandle.timestamp).toISOString()));
                            console.log("  Position: ".concat(this.currentPosition ? "OPEN (".concat(this.currentPosition.direction, " @ ").concat(this.currentPosition.entryPrice.toFixed(4), ")") : 'CLOSED'));
                            console.log("  Context valid: ".concat((_c = (_b = this.currentContext) === null || _b === void 0 ? void 0 : _b.isValidContext) !== null && _c !== void 0 ? _c : 'not initialized'));
                            console.log("  Can check entry: ".concat(!this.currentPosition && historicalCandles5m.length >= 100 && historicalCandles15m.length >= 50));
                        }
                        // Check pending confirmations (every candle)
                        if (!this.currentPosition) {
                            this.checkPendingConfirmations(currentCandle);
                        }
                        // Check exit conditions if in position
                        if (this.currentPosition) {
                            this.checkExit(currentCandle, historicalCandles5m, i);
                        }
                        if (!(!this.currentPosition && historicalCandles5m.length >= 100 && historicalCandles15m.length >= 50)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.checkEntry(currentCandle, historicalCandles5m, historicalCandles15m, i)];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        // Update equity curve every 1000 candles
                        if (i % 1000 === 0) {
                            this.equityCurve.push({
                                time: currentCandle.timestamp,
                                balance: this.balance,
                            });
                        }
                        _d.label = 6;
                    case 6:
                        i++;
                        return [3 /*break*/, 1];
                    case 7:
                        console.log('\r✅ Progress: 100%    ');
                        // Close any open position at end
                        if (this.currentPosition) {
                            lastCandle = candles1m[candles1m.length - 1];
                            this.closePosition(lastCandle, lastCandle.close, 'END_OF_BACKTEST');
                        }
                        console.log("\u2705 Backtest complete! Total trades: ".concat(this.trades.length));
                        return [2 /*return*/, this.calculateResults()];
                }
            });
        });
    };
    /**
     * Get historical candles up to timestamp
     */
    BacktestEngineV2.prototype.getHistoricalCandles = function (candles, timestamp, maxCount) {
        var filtered = candles.filter(function (c) { return c.timestamp <= timestamp; });
        var sliced = filtered.slice(-maxCount);
        return sliced.map(function (c) { return ({
            timestamp: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
        }); });
    };
    /**
     * Check entry conditions using REAL strategy
     */
    BacktestEngineV2.prototype.checkEntry = function (currentCandle, historicalCandles5m, historicalCandles15m, candleIndex) {
        return __awaiter(this, void 0, void 0, function () {
            var currentPrice, rsi, rsiTrend1, emaFast, emaSlowIndicator, emaSlow, emaFastTrend1Indicator, emaFastTrend1, emaSlowTrend1Indicator, emaSlowTrend1, atr, undefinedIndicators, swingHighs, swingLows, swingPoints, liquidityAnalysis, divergence, stochasticRaw, stochastic, bollingerRaw, bollingerBands, trend, vwapData, tfAlignmentScore, marketData, _a, evaluations, _i, _b, strategy, evaluation, validSignals, bestSignal, direction, pendingId, entrySignal, direction, pendingId, error_1;
            var _c;
            var _this = this;
            var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            return __generator(this, function (_w) {
                switch (_w.label) {
                    case 0:
                        _w.trys.push([0, 12, , 13]);
                        currentPrice = currentCandle.close;
                        rsi = this.rsiIndicator.calculate(historicalCandles5m);
                        rsiTrend1 = this.rsiIndicator.calculate(historicalCandles15m);
                        emaFast = this.emaIndicator.calculate(historicalCandles5m);
                        emaSlowIndicator = new ema_indicator_1.EMAIndicator(21);
                        emaSlow = emaSlowIndicator.calculate(historicalCandles5m);
                        emaFastTrend1Indicator = new ema_indicator_1.EMAIndicator(9);
                        emaFastTrend1 = emaFastTrend1Indicator.calculate(historicalCandles15m);
                        emaSlowTrend1Indicator = new ema_indicator_1.EMAIndicator(21);
                        emaSlowTrend1 = emaSlowTrend1Indicator.calculate(historicalCandles15m);
                        atr = this.atrIndicator.calculate(historicalCandles5m);
                        // Check for undefined indicators (debug)
                        if (candleIndex % 5000 === 0) {
                            undefinedIndicators = [];
                            if (rsi === undefined || isNaN(rsi))
                                undefinedIndicators.push('RSI');
                            if (rsiTrend1 === undefined || isNaN(rsiTrend1))
                                undefinedIndicators.push('RSI15m');
                            if (emaFast === undefined || isNaN(emaFast))
                                undefinedIndicators.push('EMA_Fast');
                            if (emaSlow === undefined || isNaN(emaSlow))
                                undefinedIndicators.push('EMA_Slow');
                            if (atr === undefined || isNaN(atr))
                                undefinedIndicators.push('ATR');
                            if (undefinedIndicators.length > 0) {
                                console.warn("[WARNING] Candle ".concat(candleIndex, ": Undefined indicators: ").concat(undefinedIndicators.join(', ')));
                                console.warn("  5m candles available: ".concat(historicalCandles5m.length, ", 15m: ").concat(historicalCandles15m.length));
                            }
                        }
                        swingHighs = this.zigzagIndicator.findSwingHighs(historicalCandles5m);
                        swingLows = this.zigzagIndicator.findSwingLows(historicalCandles5m);
                        swingPoints = __spreadArray(__spreadArray([], swingHighs, true), swingLows, true).sort(function (a, b) { return a.timestamp - b.timestamp; });
                        liquidityAnalysis = undefined;
                        divergence = undefined;
                        stochasticRaw = this.stochasticIndicator.calculate(historicalCandles5m);
                        stochastic = {
                            k: stochasticRaw.k,
                            d: stochasticRaw.d,
                            isOversold: stochasticRaw.k < 20,
                            isOverbought: stochasticRaw.k > 80,
                        };
                        bollingerRaw = this.bollingerIndicator.calculate(historicalCandles5m);
                        bollingerBands = __assign(__assign({}, bollingerRaw), { isSqueeze: bollingerRaw.width < 2 });
                        trend = emaFast > emaSlow ? 'BULLISH' : emaFast < emaSlow ? 'BEARISH' : 'NEUTRAL';
                        // Debug: Log market data every 500 candles
                        if (candleIndex % 500 === 0) {
                            console.log("\n[MARKET DATA] Candle ".concat(candleIndex, " @ ").concat(new Date(currentCandle.timestamp).toISOString()));
                            console.log("  Price: ".concat(currentPrice.toFixed(4)));
                            console.log("  RSI: ".concat((_d = rsi === null || rsi === void 0 ? void 0 : rsi.toFixed(2)) !== null && _d !== void 0 ? _d : 'undefined', " / RSI15m: ").concat((_e = rsiTrend1 === null || rsiTrend1 === void 0 ? void 0 : rsiTrend1.toFixed(2)) !== null && _e !== void 0 ? _e : 'undefined'));
                            console.log("  EMA: fast=".concat((_f = emaFast === null || emaFast === void 0 ? void 0 : emaFast.toFixed(4)) !== null && _f !== void 0 ? _f : 'undefined', ", slow=").concat((_g = emaSlow === null || emaSlow === void 0 ? void 0 : emaSlow.toFixed(4)) !== null && _g !== void 0 ? _g : 'undefined'));
                            console.log("  EMA15m: fast=".concat((_h = emaFastTrend1 === null || emaFastTrend1 === void 0 ? void 0 : emaFastTrend1.toFixed(4)) !== null && _h !== void 0 ? _h : 'undefined', ", slow=").concat((_j = emaSlowTrend1 === null || emaSlowTrend1 === void 0 ? void 0 : emaSlowTrend1.toFixed(4)) !== null && _j !== void 0 ? _j : 'undefined'));
                            console.log("  ATR: ".concat((_k = atr === null || atr === void 0 ? void 0 : atr.toFixed(4)) !== null && _k !== void 0 ? _k : 'undefined', " (").concat(atr ? ((atr / currentPrice) * 100).toFixed(2) : 'undefined', "%)"));
                            console.log("  Swings: ".concat(swingPoints.length, " (highs=").concat(swingHighs.length, ", lows=").concat(swingLows.length, ")"));
                            console.log("  Swing details: highs=[".concat(swingHighs.slice(0, 3).map(function (s) { return s.price.toFixed(4); }).join(', '), "...], lows=[").concat(swingLows.slice(0, 3).map(function (s) { return s.price.toFixed(4); }).join(', '), "...]"));
                            console.log("  Candles passed to strategies: ".concat(historicalCandles5m.length));
                            console.log("  Trend: ".concat(trend));
                            console.log("  Stochastic: k=".concat((_m = (_l = stochastic.k) === null || _l === void 0 ? void 0 : _l.toFixed(2)) !== null && _m !== void 0 ? _m : 'undefined', ", oversold=").concat(stochastic.isOversold, ", overbought=").concat(stochastic.isOverbought));
                            console.log("  Context: ".concat(this.currentContext ? "valid=".concat(this.currentContext.isValidContext, ", blockedBy=[").concat((_p = (_o = this.currentContext.blockedBy) === null || _o === void 0 ? void 0 : _o.join(', ')) !== null && _p !== void 0 ? _p : 'none', "]") : 'not initialized'));
                        }
                        vwapData = this.vwapIndicator ? this.vwapIndicator.calculate(historicalCandles5m) : undefined;
                        tfAlignmentScore = this.tfAlignmentService ? this.tfAlignmentService.calculateAlignment({
                            entry: {
                                trend: emaFast > emaSlow ? 'BULLISH' : 'BEARISH',
                                momentum: rsi > 50 ? 'STRONG' : 'WEAK',
                                emaFast: emaFast,
                                emaSlow: emaSlow,
                                rsi: rsi,
                            },
                            primary: {
                                trend: trend,
                                momentum: rsi > 50 ? 'STRONG' : 'WEAK',
                                emaFast: emaFast,
                                emaSlow: emaSlow,
                                rsi: rsi,
                            },
                            trend1: {
                                trend: emaFastTrend1 > emaSlowTrend1 ? 'BULLISH' : 'BEARISH',
                                momentum: rsiTrend1 > 50 ? 'STRONG' : 'WEAK',
                                emaFast: emaFastTrend1,
                                emaSlow: emaSlowTrend1,
                                rsi: rsiTrend1,
                            },
                        }) : undefined;
                        _c = {
                            timestamp: currentCandle.timestamp,
                            currentPrice: currentPrice,
                            candles: historicalCandles5m,
                            swingPoints: swingPoints,
                            rsi: rsi,
                            rsiTrend1: rsiTrend1,
                            ema: { fast: emaFast, slow: emaSlow },
                            emaTrend1: { fast: emaFastTrend1, slow: emaSlowTrend1 },
                            atr: atr,
                            trend: trend,
                            liquidity: liquidityAnalysis,
                            divergence: divergence
                        };
                        if (!this.dataProvider) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.dataProvider.loadOrderbookForCandle(this.config.symbol, currentCandle.timestamp)];
                    case 1:
                        _a = (_w.sent()) || undefined;
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _w.label = 3;
                    case 3:
                        marketData = (_c.orderbook = _a,
                            _c.context = {
                                trend: trend,
                                momentum: rsi > 50 ? 'BULLISH' : 'BEARISH',
                                volatility: atr > 0.02 ? 'HIGH' : atr > 0.01 ? 'MEDIUM' : 'LOW',
                                timeframe: '5m',
                            },
                            _c.stochastic = stochastic,
                            _c.bollingerBands = bollingerBands,
                            _c.breakoutPrediction = undefined,
                            // PHASE 6: Multi-Timeframe data
                            _c.vwap = vwapData,
                            _c.tfAlignmentScore = tfAlignmentScore,
                            _c);
                        evaluations = [];
                        _i = 0, _b = this.strategies;
                        _w.label = 4;
                    case 4:
                        if (!(_i < _b.length)) return [3 /*break*/, 7];
                        strategy = _b[_i];
                        return [4 /*yield*/, strategy.evaluate(marketData)];
                    case 5:
                        evaluation = _w.sent();
                        evaluations.push(evaluation);
                        _w.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        validSignals = evaluations
                            .filter(function (e) { return e.valid && e.signal && e.signal.direction !== types_1.SignalDirection.HOLD; })
                            .sort(function (a, b) {
                            var _a, _b;
                            // Sort by priority (lower = higher priority)
                            if (a.priority !== b.priority)
                                return a.priority - b.priority;
                            // Then by confidence
                            return (((_a = b.signal) === null || _a === void 0 ? void 0 : _a.confidence) || 0) - (((_b = a.signal) === null || _b === void 0 ? void 0 : _b.confidence) || 0);
                        });
                        // Filter by Weight Matrix confidence threshold if enabled
                        if (this.weightMatrix && ((_q = this.config.config.weightMatrix) === null || _q === void 0 ? void 0 : _q.enabled)) {
                            validSignals = validSignals.filter(function (signal) {
                                var _a;
                                var confidencePercent = (((_a = signal.signal) === null || _a === void 0 ? void 0 : _a.confidence) || 0) * 100;
                                var passesThreshold = _this.weightMatrix.shouldEnter(confidencePercent);
                                if (!passesThreshold && candleIndex % 500 === 0) {
                                    _this.logger.debug("\u274C Weight Matrix filtered out signal", {
                                        strategy: signal.strategyName,
                                        confidence: confidencePercent.toFixed(1) + '%',
                                        required: _this.config.config.weightMatrix.minConfidenceToEnter + '%',
                                    });
                                }
                                return passesThreshold;
                            });
                        }
                        bestSignal = validSignals[0];
                        // Debug: Log evaluation result every 500 candles
                        if (candleIndex % 500 === 0) {
                            console.log("[STRATEGIES] Evaluated=".concat(evaluations.length, ", Valid signals=").concat(validSignals.length));
                            evaluations.forEach(function (e) {
                                var reasonPreview = e.reason ? (e.reason.length > 80 ? e.reason.substring(0, 80) + '...' : e.reason) : 'N/A';
                                console.log("  - ".concat(e.strategyName, ": valid=").concat(e.valid, ", priority=").concat(e.priority, ", reason=\"").concat(reasonPreview, "\""));
                            });
                        }
                        if (!bestSignal) return [3 /*break*/, 8];
                        direction = bestSignal.signal.direction;
                        // Check if entry confirmation is enabled for this direction
                        if (this.entryConfirmation.isEnabled(direction)) {
                            pendingId = this.entryConfirmation.addPending({
                                symbol: this.config.symbol,
                                direction: direction,
                                keyLevel: currentPrice, // Use current price as key level
                                detectedAt: currentCandle.timestamp,
                                signalData: { signal: bestSignal, atr: atr },
                            });
                            this.pendingSignals.set(pendingId, { signal: bestSignal, marketData: marketData, atr: atr });
                            console.log("[SIGNAL PENDING] ".concat(direction, " at ").concat(currentPrice, ", waiting for confirmation (id: ").concat(pendingId, ") - strategy=").concat(bestSignal.strategyName));
                        }
                        else {
                            // Entry confirmation disabled - open immediately
                            console.log("[SIGNAL FOUND] ".concat(direction, " at ").concat(currentPrice, ", confidence=").concat((_r = bestSignal.signal) === null || _r === void 0 ? void 0 : _r.confidence, ", strategy=").concat(bestSignal.strategyName));
                            this.openPosition(currentCandle, direction, currentPrice, atr, bestSignal.signal.confidence || 0.5, bestSignal.strategyName);
                        }
                        return [3 /*break*/, 11];
                    case 8:
                        if (!(this.currentContext && candleIndex % 10 === 0)) return [3 /*break*/, 10];
                        // Debug: Log scanner attempt
                        if (candleIndex % 500 === 0) {
                            console.log("[ENTRY SCANNER] Attempting scan at candle ".concat(candleIndex));
                        }
                        return [4 /*yield*/, this.entryScanner.scan(this.currentContext)];
                    case 9:
                        entrySignal = _w.sent();
                        // Debug: Log scanner result
                        if (candleIndex % 500 === 0) {
                            console.log("  Scanner result: shouldEnter=".concat(entrySignal.shouldEnter, ", direction=").concat((_s = entrySignal.direction) !== null && _s !== void 0 ? _s : 'N/A', ", confidence=").concat((_u = (_t = entrySignal.confidence) === null || _t === void 0 ? void 0 : _t.toFixed(2)) !== null && _u !== void 0 ? _u : 'N/A', ", reason=\"").concat((_v = entrySignal.reason) !== null && _v !== void 0 ? _v : 'N/A', "\""));
                        }
                        if (entrySignal.shouldEnter) {
                            direction = entrySignal.direction;
                            console.log("[ENTRY SCANNER] ".concat(direction, " at ").concat(currentPrice, ", confidence=").concat(entrySignal.confidence, ", reason=").concat(entrySignal.reason));
                            // Check if entry confirmation is enabled
                            if (this.entryConfirmation.isEnabled(direction)) {
                                pendingId = this.entryConfirmation.addPending({
                                    symbol: this.config.symbol,
                                    direction: direction,
                                    keyLevel: currentPrice,
                                    detectedAt: currentCandle.timestamp,
                                    signalData: { entrySignal: entrySignal, atr: atr },
                                });
                                this.pendingSignals.set(pendingId, { signal: { valid: true, signal: { direction: direction, confidence: entrySignal.confidence }, strategyName: 'EntryScanner' }, marketData: marketData, atr: atr });
                                console.log("[SCANNER PENDING] ".concat(direction, " at ").concat(currentPrice, ", waiting for confirmation (id: ").concat(pendingId, ")"));
                            }
                            else {
                                this.openPosition(currentCandle, direction, currentPrice, atr, entrySignal.confidence, 'EntryScanner');
                            }
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        if (!this.currentContext && candleIndex % 500 === 0) {
                            console.log("[ENTRY SCANNER] Skipped - context not initialized");
                        }
                        _w.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_1 = _w.sent();
                        console.error("\n[ERROR] Candle ".concat(candleIndex, " @ ").concat(new Date(currentCandle.timestamp).toISOString(), ":"));
                        console.error("  Message: ".concat((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || error_1));
                        console.error("  Stack: ".concat((error_1 === null || error_1 === void 0 ? void 0 : error_1.stack) || 'No stack trace'));
                        console.error("  Price: ".concat(currentCandle.close.toFixed(4)));
                        console.error("  Historical data: 5m=".concat(historicalCandles5m.length, ", 15m=").concat(historicalCandles15m.length, " candles"));
                        return [3 /*break*/, 13];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check pending entry confirmations on candle close
     */
    BacktestEngineV2.prototype.checkPendingConfirmations = function (currentCandle) {
        var _a;
        var allPending = this.entryConfirmation.getAllPending();
        var _loop_1 = function (pending_1) {
            var closePrice = currentCandle.close;
            // Check confirmation
            var result = this_1.entryConfirmation.checkConfirmation(pending_1.id, closePrice);
            if (result.confirmed) {
                // Confirmation successful - open position
                var signalData = this_1.pendingSignals.get(pending_1.id);
                if (signalData) {
                    console.log("[CONFIRMED] ".concat(pending_1.direction, " at ").concat(closePrice, " - ").concat(result.reason));
                    this_1.openPosition(currentCandle, pending_1.direction, closePrice, signalData.atr, ((_a = signalData.signal.signal) === null || _a === void 0 ? void 0 : _a.confidence) || 0.5, signalData.signal.strategyName);
                    this_1.pendingSignals.delete(pending_1.id);
                }
            }
            else {
                // Check if still pending (not removed by checkConfirmation)
                var stillPending = this_1.entryConfirmation.getAllPending().find(function (p) { return p.id === pending_1.id; });
                if (!stillPending) {
                    // Confirmation failed or expired - cleanup
                    console.log("[REJECTED] ".concat(pending_1.direction, " - ").concat(result.reason));
                    this_1.pendingSignals.delete(pending_1.id);
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, allPending_1 = allPending; _i < allPending_1.length; _i++) {
            var pending_1 = allPending_1[_i];
            _loop_1(pending_1);
        }
    };
    /**
     * Open position
     */
    BacktestEngineV2.prototype.openPosition = function (candle, direction, entryPrice, atr, confidence, strategyName) {
        // PHASE 5: Check Daily Limits
        if (this.dailyLimitsService) {
            var limitsCheck = this.dailyLimitsService.canTrade();
            if (!limitsCheck.allowed) {
                console.log("\u274C Trade blocked by daily limits: ".concat(limitsCheck.reason));
                return;
            }
        }
        // PHASE 5: Check Loss Streak
        if (this.lossStreakService) {
            var streakCheck = this.lossStreakService.canTrade();
            if (!streakCheck.allowed) {
                console.log("\u274C Trade blocked by loss streak: ".concat(streakCheck.reason));
                return;
            }
        }
        // Base position size
        var positionSizeUsdt = this.config.positionSizeUsdt;
        // Get SL multipliers from config
        var slMultiplier = direction === types_1.SignalDirection.LONG
            ? this.config.config.strategies.levelBased.stopLossAtrMultiplierLong
            : this.config.config.strategies.levelBased.stopLossAtrMultiplier;
        // ATR is returned as percentage, convert to price distance
        var atrDistance = entryPrice * (atr / 100) * slMultiplier;
        var stopLoss = direction === types_1.SignalDirection.LONG
            ? entryPrice - atrDistance
            : entryPrice + atrDistance;
        // PHASE 5: Apply Risk-Based Sizing (overrides base size)
        if (this.riskBasedSizingService) {
            positionSizeUsdt = this.riskBasedSizingService.calculatePositionSize(this.balance, entryPrice, stopLoss);
            console.log("  \uD83C\uDFAF Risk-Based Sizing: ".concat(this.config.positionSizeUsdt.toFixed(2), " \u2192 ").concat(positionSizeUsdt.toFixed(2), " USDT"));
        }
        // PHASE 5: Apply Loss Streak multiplier
        if (this.lossStreakService) {
            var multiplier = this.lossStreakService.getSizeMultiplier();
            var originalSize = positionSizeUsdt;
            positionSizeUsdt = positionSizeUsdt * multiplier;
            console.log("  \uD83D\uDD3B Loss Streak (".concat(this.lossStreakService.getConsecutiveLosses(), " losses): ").concat((multiplier * 100).toFixed(0), "% \u2192 ").concat(originalSize.toFixed(2), " \u2192 ").concat(positionSizeUsdt.toFixed(2), " USDT"));
        }
        var size = (positionSizeUsdt * this.config.leverage) / entryPrice;
        // Calculate take profits
        var takeProfits = this.config.config.strategies.levelBased.takeProfits.map(function (tp) {
            var priceMove = Math.abs(entryPrice - stopLoss) * tp.percent;
            var tpPrice = direction === types_1.SignalDirection.LONG
                ? entryPrice + priceMove
                : entryPrice - priceMove;
            return {
                level: tp.level,
                price: tpPrice,
                closePercent: tp.sizePercent,
            };
        });
        // Calculate entry fee (use actual position size, not base size)
        var entryFee = positionSizeUsdt * this.config.takerFee;
        this.balance -= entryFee;
        this.currentPosition = {
            entryTime: candle.timestamp,
            entryPrice: entryPrice,
            direction: direction,
            size: size,
            stopLoss: stopLoss,
            takeProfits: takeProfits,
            confidence: confidence,
            strategyName: strategyName,
        };
        console.log("\n[POSITION OPENED] ".concat(direction, " @ ").concat(entryPrice.toFixed(4)));
        console.log("  ATR: ".concat(atr.toFixed(4), " (").concat(((atr / entryPrice) * 100).toFixed(2), "% of price)"));
        console.log("  SL multiplier: ".concat(slMultiplier));
        console.log("  SL calculation: ".concat(entryPrice.toFixed(4), " ").concat(direction === types_1.SignalDirection.LONG ? '-' : '+', " (").concat(atr.toFixed(4), " * ").concat(slMultiplier, ") = ").concat(stopLoss.toFixed(4)));
        console.log("  SL: ".concat(stopLoss.toFixed(4), " (").concat(((Math.abs(stopLoss - entryPrice) / entryPrice) * 100).toFixed(2), "% distance)"));
        console.log("  TPs: ".concat(takeProfits.map(function (tp, i) { return "TP".concat(i + 1, "=").concat(tp.price.toFixed(4)); }).join(', ')));
        console.log("  Strategy: ".concat(strategyName, ", Confidence: ").concat((confidence * 100).toFixed(0), "%"));
    };
    /**
     * Check exit conditions
     */
    BacktestEngineV2.prototype.checkExit = function (candle, historicalCandles, candleIndex) {
        var _a, _b, _c, _d, _e, _f;
        if (!this.currentPosition)
            return;
        var position = this.currentPosition;
        // Debug: Log exit check every 1000 candles
        if (candleIndex % 1000 === 0) {
            console.log("\n[EXIT CHECK] Candle ".concat(candleIndex, " @ price ").concat(candle.close.toFixed(4), " (high=").concat(candle.high.toFixed(4), ", low=").concat(candle.low.toFixed(4), ")"));
            console.log("  Position: ".concat(position.direction, " @ ").concat(position.entryPrice.toFixed(4)));
            console.log("  SL: ".concat(position.stopLoss.toFixed(4), " | Current TPs: ").concat(position.takeProfits.map(function (tp, i) { return "TP".concat(i + 1, "=").concat(tp.price.toFixed(4)); }).join(', ')));
            if (position.direction === types_1.SignalDirection.SHORT) {
                console.log("  SL check: candle.high (".concat(candle.high.toFixed(4), ") >= SL (").concat(position.stopLoss.toFixed(4), ") ? ").concat(candle.high >= position.stopLoss));
                console.log("  TP check: candle.low (".concat(candle.low.toFixed(4), ") <= TP1 (").concat((_c = (_b = (_a = position.takeProfits[0]) === null || _a === void 0 ? void 0 : _a.price) === null || _b === void 0 ? void 0 : _b.toFixed(4)) !== null && _c !== void 0 ? _c : 'none', ") ? ").concat(position.takeProfits[0] ? candle.low <= position.takeProfits[0].price : 'no TP'));
            }
            else {
                console.log("  SL check: candle.low (".concat(candle.low.toFixed(4), ") <= SL (").concat(position.stopLoss.toFixed(4), ") ? ").concat(candle.low <= position.stopLoss));
                console.log("  TP check: candle.high (".concat(candle.high.toFixed(4), ") >= TP1 (").concat((_f = (_e = (_d = position.takeProfits[0]) === null || _d === void 0 ? void 0 : _d.price) === null || _e === void 0 ? void 0 : _e.toFixed(4)) !== null && _f !== void 0 ? _f : 'none', ") ? ").concat(position.takeProfits[0] ? candle.high >= position.takeProfits[0].price : 'no TP'));
            }
        }
        // Check stop loss FIRST
        if (position.direction === types_1.SignalDirection.LONG) {
            if (candle.low <= position.stopLoss) {
                console.log("\n[STOP LOSS HIT] LONG @ ".concat(candle.low.toFixed(4), " (SL: ").concat(position.stopLoss.toFixed(4), ")"));
                this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
                return;
            }
        }
        else {
            if (candle.high >= position.stopLoss) {
                console.log("\n[STOP LOSS HIT] SHORT @ ".concat(candle.high.toFixed(4), " (SL: ").concat(position.stopLoss.toFixed(4), ")"));
                this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
                return;
            }
        }
        // Check take profits
        for (var i = 0; i < position.takeProfits.length; i++) {
            var tp = position.takeProfits[i];
            var hit = false;
            if (position.direction === types_1.SignalDirection.LONG) {
                hit = candle.high >= tp.price;
            }
            else {
                hit = candle.low <= tp.price;
            }
            if (hit) {
                // Check if this is the LAST TP (should close entire remaining position)
                var isLastTP = position.takeProfits.length === 1;
                if (isLastTP) {
                    // Close entire remaining position
                    console.log("[TP".concat(i + 1, " HIT - LAST TP] Closing entire remaining position @ ").concat(tp.price.toFixed(4)));
                    this.closePosition(candle, tp.price, "TP".concat(i + 1));
                    return;
                }
                else {
                    // Partial close
                    console.log("[TP".concat(i + 1, " HIT] Partial close ").concat(tp.closePercent, "% @ ").concat(tp.price.toFixed(4)));
                    this.partialClose(candle, tp.price, tp.closePercent, "TP".concat(i + 1));
                    position.takeProfits.splice(i, 1);
                    return;
                }
            }
        }
    };
    /**
     * Partial close position
     */
    BacktestEngineV2.prototype.partialClose = function (candle, exitPrice, closePercent, reason) {
        if (!this.currentPosition)
            return;
        var position = this.currentPosition;
        var closeSizeUsdt = this.config.positionSizeUsdt * (closePercent / 100);
        var closeSize = position.size * (closePercent / 100);
        var priceDiff = position.direction === types_1.SignalDirection.LONG
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        var pnl = (priceDiff / position.entryPrice) * closeSizeUsdt * this.config.leverage;
        var exitFee = closeSizeUsdt * this.config.makerFee;
        this.balance += pnl - exitFee;
        var holding = candle.timestamp - position.entryTime;
        this.trades.push({
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            direction: position.direction,
            size: closeSize,
            stopLoss: position.stopLoss,
            takeProfits: [],
            exitTime: candle.timestamp,
            exitPrice: exitPrice,
            exitReason: reason,
            pnl: pnl,
            pnlPercent: (pnl / closeSizeUsdt) * 100,
            fees: exitFee + (this.config.positionSizeUsdt * (closePercent / 100) * this.config.takerFee),
            holding: holding,
            confidence: position.confidence,
            strategyName: position.strategyName
        });
        position.size -= closeSize;
        this.config.positionSizeUsdt *= (100 - closePercent) / 100;
    };
    /**
     * Close position
     */
    BacktestEngineV2.prototype.closePosition = function (candle, exitPrice, reason) {
        if (!this.currentPosition)
            return;
        var position = this.currentPosition;
        var priceDiff = position.direction === types_1.SignalDirection.LONG
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        var pnl = (priceDiff / position.entryPrice) * this.config.positionSizeUsdt * this.config.leverage;
        var exitFee = this.config.positionSizeUsdt * this.config.makerFee;
        this.balance += pnl - exitFee;
        if (this.balance > this.peakBalance) {
            this.peakBalance = this.balance;
        }
        var drawdown = this.peakBalance - this.balance;
        if (drawdown > this.maxDrawdown) {
            this.maxDrawdown = drawdown;
        }
        var holding = candle.timestamp - position.entryTime;
        this.trades.push(__assign(__assign({}, position), { exitTime: candle.timestamp, exitPrice: exitPrice, exitReason: reason, pnl: pnl, pnlPercent: (pnl / this.config.positionSizeUsdt) * 100, fees: exitFee + (this.config.positionSizeUsdt * this.config.takerFee), holding: holding }));
        // PHASE 5: Update Daily Limits
        if (this.dailyLimitsService) {
            this.dailyLimitsService.onTradeClose(pnl, this.balance);
        }
        // PHASE 5: Record trade result for Loss Streak
        if (this.lossStreakService) {
            var isWin = pnl > 0;
            this.lossStreakService.recordTrade(isWin);
        }
        this.currentPosition = null;
    };
    /**
     * Calculate backtest results
     */
    BacktestEngineV2.prototype.calculateResults = function () {
        var winners = this.trades.filter(function (t) { return (t.pnl || 0) > 0; });
        var losers = this.trades.filter(function (t) { return (t.pnl || 0) <= 0; });
        var totalPnl = this.trades.reduce(function (sum, t) { return sum + (t.pnl || 0); }, 0);
        var totalFees = this.trades.reduce(function (sum, t) { return sum + (t.fees || 0); }, 0);
        var netPnl = this.balance - this.config.initialBalance;
        var winRate = this.trades.length > 0 ? (winners.length / this.trades.length) * 100 : 0;
        var totalWin = winners.reduce(function (sum, t) { return sum + (t.pnl || 0); }, 0);
        var totalLoss = Math.abs(losers.reduce(function (sum, t) { return sum + (t.pnl || 0); }, 0));
        var avgWin = winners.length > 0 ? totalWin / winners.length : 0;
        var avgLoss = losers.length > 0 ? totalLoss / losers.length : 0;
        var winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
        var profitFactor = totalLoss > 0 ? totalWin / totalLoss : 0;
        var avgHoldingTime = this.trades.length > 0
            ? this.trades.reduce(function (sum, t) { return sum + (t.holding || 0); }, 0) / this.trades.length
            : 0;
        var returns = this.trades.map(function (t) { return (t.pnlPercent || 0) / 100; });
        var avgReturn = returns.reduce(function (sum, r) { return sum + r; }, 0) / returns.length;
        var stdDev = Math.sqrt(returns.reduce(function (sum, r) { return sum + Math.pow(r - avgReturn, 2); }, 0) / returns.length);
        var sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
        return {
            config: this.config,
            totalTrades: this.trades.length,
            winningTrades: winners.length,
            losingTrades: losers.length,
            winRate: winRate,
            totalPnl: totalPnl,
            totalFees: totalFees,
            netPnl: netPnl,
            netPnlPercent: (netPnl / this.config.initialBalance) * 100,
            winLossRatio: winLossRatio,
            profitFactor: profitFactor,
            avgWin: avgWin,
            avgLoss: avgLoss,
            maxDrawdown: this.maxDrawdown,
            maxDrawdownPercent: (this.maxDrawdown / this.config.initialBalance) * 100,
            sharpeRatio: sharpeRatio,
            avgHoldingTime: avgHoldingTime,
            trades: this.trades,
            equityCurve: this.equityCurve,
        };
    };
    return BacktestEngineV2;
}());
exports.BacktestEngineV2 = BacktestEngineV2;
