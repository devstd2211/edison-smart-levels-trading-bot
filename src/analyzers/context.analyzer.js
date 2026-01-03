"use strict";
/**
 * Context Analyzer
 *
 * Analyzes higher timeframes (PRIMARY 5m, TREND 30m) to determine:
 * - Market trend and structure
 * - Trading filters (ATR, EMA distance)
 * - Whether context is valid for trading
 *
 * This provides the "big picture" context that filters entry signals.
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
exports.ContextAnalyzer = void 0;
var types_1 = require("../types");
var atr_indicator_1 = require("../indicators/atr.indicator");
var ema_indicator_1 = require("../indicators/ema.indicator");
var zigzag_indicator_1 = require("../indicators/zigzag.indicator");
var market_structure_analyzer_1 = require("./market-structure.analyzer");
// ============================================================================
// CONTEXT ANALYZER
// ============================================================================
var ContextAnalyzer = /** @class */ (function () {
    function ContextAnalyzer(config, candleProvider, logger) {
        this.config = config;
        this.candleProvider = candleProvider;
        this.logger = logger;
        this.atr = new atr_indicator_1.ATRIndicator(config.atrPeriod);
        this.ema50 = new ema_indicator_1.EMAIndicator(config.emaPeriod);
        this.zigzag = new zigzag_indicator_1.ZigZagIndicator(config.zigzagDepth);
        this.structureAnalyzer = new market_structure_analyzer_1.MarketStructureAnalyzer(logger);
    }
    /**
     * Analyze trading context from PRIMARY timeframe
     * Returns context that will be used to filter ENTRY signals
     */
    ContextAnalyzer.prototype.analyze = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, primaryCandles, atrPercent, ema50Value, highs, lows, currentPrice, emaDistance, marketStructure, trend, filteringMode, warnings, blockedBy, isValidContext, atrModifier, emaModifier, trendModifier, ratio, excess, excess, overallModifier;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        timestamp = Date.now();
                        return [4 /*yield*/, this.candleProvider.getCandles(types_1.TimeframeRole.PRIMARY)];
                    case 1:
                        primaryCandles = _b.sent();
                        if (!primaryCandles || primaryCandles.length < 50) {
                            this.logger.warn('Not enough PRIMARY candles for context analysis', {
                                count: (_a = primaryCandles === null || primaryCandles === void 0 ? void 0 : primaryCandles.length) !== null && _a !== void 0 ? _a : 0,
                            });
                            return [2 /*return*/, this.invalidContext(timestamp, ['INSUFFICIENT_DATA'])];
                        }
                        atrPercent = this.atr.calculate(primaryCandles);
                        ema50Value = this.ema50.calculate(primaryCandles);
                        highs = this.zigzag.findSwingHighs(primaryCandles);
                        lows = this.zigzag.findSwingLows(primaryCandles);
                        currentPrice = primaryCandles[primaryCandles.length - 1].close;
                        emaDistance = Math.abs((currentPrice - ema50Value) / ema50Value) * 100;
                        marketStructure = this.structureAnalyzer.identifyStructure(highs, lows);
                        trend = this.structureAnalyzer.getTrendBias(highs, lows);
                        filteringMode = this.config.filteringMode;
                        warnings = [];
                        blockedBy = [];
                        isValidContext = true;
                        atrModifier = 1.0;
                        emaModifier = 1.0;
                        trendModifier = 1.0;
                        if (filteringMode === types_1.ContextFilteringMode.WEIGHT_BASED) {
                            // ATR modifier (0.5 - 1.0)
                            if (atrPercent < this.config.minimumATR) {
                                ratio = atrPercent / this.config.minimumATR;
                                atrModifier = Math.max(0.5, ratio); // Min 0.5x
                                warnings.push("Low volatility (ATR ".concat(atrPercent.toFixed(2), "%)"));
                            }
                            else if (atrPercent > this.config.maximumATR) {
                                excess = (atrPercent - this.config.maximumATR) / this.config.maximumATR;
                                atrModifier = Math.max(0.5, 1.0 - excess * 0.5); // Max penalty 50%
                                warnings.push("High volatility (ATR ".concat(atrPercent.toFixed(2), "%)"));
                            }
                            // EMA distance modifier (0.3 - 1.0)
                            if (emaDistance > this.config.maxEmaDistance) {
                                excess = (emaDistance - this.config.maxEmaDistance) / this.config.maxEmaDistance;
                                emaModifier = Math.max(0.3, 1.0 - excess); // Min 0.3x
                                warnings.push("Price far from EMA50 (".concat(emaDistance.toFixed(2), "%)"));
                            }
                            // Trend modifier (based on market structure)
                            if (trend === types_1.TrendBias.NEUTRAL) {
                                trendModifier = 0.8; // Slightly reduce confidence in neutral market
                                warnings.push('Neutral trend');
                            }
                        }
                        // ====================================================================
                        // HARD_BLOCK MODE: Check hard constraints
                        // ====================================================================
                        if (filteringMode === types_1.ContextFilteringMode.HARD_BLOCK) {
                            // ATR check
                            if (atrPercent < this.config.minimumATR) {
                                blockedBy.push('ATR_TOO_LOW');
                                isValidContext = false;
                                warnings.push("Low volatility (ATR ".concat(atrPercent.toFixed(2), "%)"));
                            }
                            else if (atrPercent > this.config.maximumATR) {
                                blockedBy.push('ATR_TOO_HIGH');
                                isValidContext = false;
                                warnings.push("High volatility (ATR ".concat(atrPercent.toFixed(2), "%)"));
                            }
                            // EMA distance check
                            if (emaDistance > this.config.maxEmaDistance) {
                                blockedBy.push('PRICE_TOO_FAR');
                                isValidContext = false;
                                warnings.push("Price far from EMA50 (".concat(emaDistance.toFixed(2), "%)"));
                            }
                            // Trend check (neutral trend = soft warning, not hard block)
                            if (trend === types_1.TrendBias.NEUTRAL) {
                                warnings.push('Neutral trend');
                            }
                            // Set modifiers to 0 if blocked (for consistency)
                            if (!isValidContext) {
                                atrModifier = 0;
                                emaModifier = 0;
                                trendModifier = 0;
                            }
                        }
                        overallModifier = atrModifier * emaModifier * trendModifier;
                        this.logger.info('📊 Context Analysis', {
                            filteringMode: filteringMode,
                            atrPercent: atrPercent.toFixed(2),
                            ema50: ema50Value.toFixed(4),
                            emaDistance: emaDistance.toFixed(2),
                            trend: trend,
                            marketStructure: marketStructure,
                            modifiers: {
                                atr: atrModifier.toFixed(2),
                                ema: emaModifier.toFixed(2),
                                trend: trendModifier.toFixed(2),
                                overall: overallModifier.toFixed(2),
                            },
                            isValidContext: isValidContext,
                            blockedBy: blockedBy,
                            warnings: warnings,
                        });
                        return [2 /*return*/, {
                                timestamp: timestamp,
                                trend: trend,
                                marketStructure: marketStructure,
                                atrPercent: atrPercent,
                                emaDistance: emaDistance,
                                ema50: ema50Value,
                                atrModifier: atrModifier,
                                emaModifier: emaModifier,
                                trendModifier: trendModifier,
                                overallModifier: overallModifier,
                                isValidContext: isValidContext,
                                blockedBy: blockedBy,
                                warnings: warnings,
                            }];
                }
            });
        });
    };
    /**
     * Helper: return invalid context (insufficient data)
     */
    ContextAnalyzer.prototype.invalidContext = function (timestamp, warnings) {
        return {
            timestamp: timestamp,
            trend: types_1.TrendBias.NEUTRAL,
            marketStructure: null,
            atrPercent: 0,
            emaDistance: 0,
            ema50: 0,
            atrModifier: 0, // Zero modifier = effectively blocked
            emaModifier: 0,
            trendModifier: 0,
            overallModifier: 0,
            isValidContext: false,
            blockedBy: ['INSUFFICIENT_DATA'],
            warnings: warnings,
        };
    };
    return ContextAnalyzer;
}());
exports.ContextAnalyzer = ContextAnalyzer;
