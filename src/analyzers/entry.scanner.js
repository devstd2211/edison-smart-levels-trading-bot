"use strict";
/**
 * Entry Scanner
 *
 * Analyzes ENTRY timeframe (1m) for precise entry signals.
 * Uses TradingContext from ContextAnalyzer as a filter.
 *
 * Logic:
 * 1. Check if context is valid
 * 2. Look for entry patterns on 1m (RSI, EMA, ZigZag, etc.)
 * 3. Generate entry signal with TP/SL levels
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
exports.EntryScanner = void 0;
var types_1 = require("../types");
var rsi_indicator_1 = require("../indicators/rsi.indicator");
var ema_indicator_1 = require("../indicators/ema.indicator");
var zigzag_indicator_1 = require("../indicators/zigzag.indicator");
var liquidity_detector_1 = require("./liquidity.detector");
var divergence_detector_1 = require("./divergence.detector");
var market_structure_analyzer_1 = require("./market-structure.analyzer");
// ============================================================================
// ENTRY SCANNER
// ============================================================================
var EntryScanner = /** @class */ (function () {
    function EntryScanner(config, candleProvider, logger) {
        this.config = config;
        this.candleProvider = candleProvider;
        this.logger = logger;
        // RSI history for divergence detection (timestamp -> RSI value)
        this.rsiHistory = new Map();
        this.rsi = new rsi_indicator_1.RSIIndicator(config.rsiPeriod);
        this.emaFast = new ema_indicator_1.EMAIndicator(config.fastEmaPeriod);
        this.emaSlow = new ema_indicator_1.EMAIndicator(config.slowEmaPeriod);
        this.zigzag = new zigzag_indicator_1.ZigZagIndicator(config.zigzagDepth);
        this.liquidityDetector = new liquidity_detector_1.LiquidityDetector(logger);
        this.divergenceDetector = new divergence_detector_1.DivergenceDetector(logger);
        this.structureAnalyzer = new market_structure_analyzer_1.MarketStructureAnalyzer(logger);
    }
    /**
     * Scan ENTRY timeframe for entry signal
     * Returns entry signal if conditions met
     */
    EntryScanner.prototype.scan = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, entryCandles, rsiValue, emaFastValue, emaSlowValue, currentPrice, currentTimestamp, _a, swingHighs, swingLows, swingPoints, liquidityAnalysis, divergence, chochBos, direction, confidence, reason, patternType, longConditions, blockedBy, shortConditions, blockedBy, pattern2Enabled, hasSweep, isFakeout, sweep, longSweepConditions, shortSweepConditions, blockedBy, priceActionBoosts, boostDetails, divergenceBoost, boost, penalty, chochBoost, sweepBoost, finalConfidence, MIN_CONFIDENCE, isLong, stopLoss, takeProfits;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
            return __generator(this, function (_v) {
                switch (_v.label) {
                    case 0:
                        timestamp = Date.now();
                        // Check for invalid context (works for both HARD_BLOCK and WEIGHT_BASED modes)
                        // In HARD_BLOCK: isValidContext = false means hard blocked
                        // In WEIGHT_BASED: overallModifier = 0 means effectively blocked
                        if (!context.isValidContext || context.overallModifier === 0) {
                            this.logger.info('⚠️ Context is invalid or blocked', {
                                isValidContext: context.isValidContext,
                                overallModifier: context.overallModifier.toFixed(2),
                                blockedBy: context.blockedBy,
                                warnings: context.warnings,
                            });
                            return [2 /*return*/, this.noEntry(timestamp, context, context.blockedBy.length > 0
                                    ? "Blocked by: ".concat(context.blockedBy.join(', '))
                                    : 'Insufficient context data', context.blockedBy)];
                        }
                        return [4 /*yield*/, this.candleProvider.getCandles(types_1.TimeframeRole.ENTRY)];
                    case 1:
                        entryCandles = _v.sent();
                        if (!entryCandles || entryCandles.length < 50) {
                            this.logger.warn('Not enough ENTRY candles for scanning', {
                                count: (_b = entryCandles === null || entryCandles === void 0 ? void 0 : entryCandles.length) !== null && _b !== void 0 ? _b : 0,
                            });
                            return [2 /*return*/, this.noEntry(timestamp, context, 'Insufficient ENTRY data', ['INSUFFICIENT_DATA'])];
                        }
                        rsiValue = this.rsi.calculate(entryCandles);
                        emaFastValue = this.emaFast.calculate(entryCandles);
                        emaSlowValue = this.emaSlow.calculate(entryCandles);
                        currentPrice = entryCandles[entryCandles.length - 1].close;
                        currentTimestamp = entryCandles[entryCandles.length - 1].timestamp;
                        // Store RSI in history for divergence detection
                        this.rsiHistory.set(currentTimestamp, rsiValue);
                        _a = this.zigzag.findSwingPoints(entryCandles), swingHighs = _a.swingHighs, swingLows = _a.swingLows;
                        swingPoints = __spreadArray(__spreadArray([], swingHighs, true), swingLows, true).sort(function (a, b) { return a.timestamp - b.timestamp; });
                        liquidityAnalysis = null;
                        divergence = null;
                        chochBos = null;
                        if (((_c = this.config.priceAction) === null || _c === void 0 ? void 0 : _c.enabled) && swingPoints.length > 0) {
                            // Liquidity analysis
                            liquidityAnalysis = this.liquidityDetector.analyze(swingPoints, entryCandles, currentTimestamp);
                            // Divergence detection
                            divergence = this.divergenceDetector.detect(swingPoints, this.rsiHistory);
                            // CHoCH/BoS detection
                            chochBos = this.structureAnalyzer.detectCHoCHBoS(swingHighs, swingLows, currentPrice);
                        }
                        this.logger.info('🔍 Entry Scan', __assign(__assign({ rsi: rsiValue.toFixed(2), emaFast: emaFastValue.toFixed(4), emaSlow: emaSlowValue.toFixed(4), price: currentPrice.toFixed(4), swingPoints: swingPoints.length }, (liquidityAnalysis && {
                            liquidityZones: liquidityAnalysis.zones.length,
                            recentSweep: (_d = liquidityAnalysis.recentSweep) === null || _d === void 0 ? void 0 : _d.detected,
                        })), (divergence && divergence.type !== divergence_detector_1.DivergenceType.NONE && {
                            divergence: divergence.type,
                            divergenceStrength: divergence.strength.toFixed(2),
                        })));
                        direction = types_1.SignalDirection.HOLD;
                        confidence = 0;
                        reason = '';
                        patternType = '';
                        longConditions = {
                            trendBullish: context.trend === 'BULLISH',
                            rsiOversold: rsiValue < this.config.rsiOversold,
                            emaFastAboveSlow: emaFastValue > emaSlowValue,
                        };
                        this.logger.info('📊 Pattern 1 - LONG Check', {
                            trend: context.trend,
                            rsi: rsiValue.toFixed(2),
                            rsiThreshold: this.config.rsiOversold,
                            emaFast: emaFastValue.toFixed(4),
                            emaSlow: emaSlowValue.toFixed(4),
                            conditions: longConditions,
                        });
                        // LONG: RSI oversold + Fast EMA > Slow EMA + Context trend is BULLISH
                        if (longConditions.trendBullish &&
                            longConditions.rsiOversold &&
                            longConditions.emaFastAboveSlow) {
                            direction = types_1.SignalDirection.LONG;
                            confidence = 0.75; // Base confidence
                            patternType = 'CLASSIC_REVERSAL';
                            reason = "LONG: RSI oversold (".concat(rsiValue.toFixed(2), "), EMA bullish crossover");
                            this.logger.info('✅ LONG Pattern 1 matched!', { confidence: confidence, reason: reason });
                        }
                        else {
                            blockedBy = [];
                            if (!longConditions.trendBullish)
                                blockedBy.push('TREND_NOT_BULLISH');
                            if (!longConditions.rsiOversold)
                                blockedBy.push("RSI_NOT_OVERSOLD(".concat(rsiValue.toFixed(2), ">").concat(this.config.rsiOversold, ")"));
                            if (!longConditions.emaFastAboveSlow)
                                blockedBy.push('EMA_NOT_BULLISH');
                            if (blockedBy.length > 0) {
                                this.logger.info('❌ LONG Pattern 1 blocked', { blockedBy: blockedBy });
                            }
                        }
                        shortConditions = {
                            trendBearish: context.trend === 'BEARISH',
                            rsiOverbought: rsiValue > this.config.rsiOverbought,
                            emaFastBelowSlow: emaFastValue < emaSlowValue,
                        };
                        this.logger.info('📊 Pattern 1 - SHORT Check', {
                            trend: context.trend,
                            rsi: rsiValue.toFixed(2),
                            rsiThreshold: this.config.rsiOverbought,
                            emaFast: emaFastValue.toFixed(4),
                            emaSlow: emaSlowValue.toFixed(4),
                            conditions: shortConditions,
                        });
                        // SHORT: RSI overbought + Fast EMA < Slow EMA + Context trend is BEARISH
                        if (direction === types_1.SignalDirection.HOLD && // Only if LONG didn't match
                            shortConditions.trendBearish &&
                            shortConditions.rsiOverbought &&
                            shortConditions.emaFastBelowSlow) {
                            direction = types_1.SignalDirection.SHORT;
                            confidence = 0.75; // Base confidence
                            patternType = 'CLASSIC_REVERSAL';
                            reason = "SHORT: RSI overbought (".concat(rsiValue.toFixed(2), "), EMA bearish crossover");
                            this.logger.info('✅ SHORT Pattern 1 matched!', { confidence: confidence, reason: reason });
                        }
                        else if (direction === types_1.SignalDirection.HOLD) {
                            blockedBy = [];
                            if (!shortConditions.trendBearish)
                                blockedBy.push('TREND_NOT_BEARISH');
                            if (!shortConditions.rsiOverbought)
                                blockedBy.push("RSI_NOT_OVERBOUGHT(".concat(rsiValue.toFixed(2), "<").concat(this.config.rsiOverbought, ")"));
                            if (!shortConditions.emaFastBelowSlow)
                                blockedBy.push('EMA_NOT_BEARISH');
                            if (blockedBy.length > 0) {
                                this.logger.info('❌ SHORT Pattern 1 blocked', { blockedBy: blockedBy });
                            }
                        }
                        // ========================================================================
                        // PATTERN 2: Liquidity Sweep Reversal (Price Action - NEW!)
                        // ========================================================================
                        if (direction === types_1.SignalDirection.HOLD) {
                            pattern2Enabled = (_f = (_e = this.config.priceAction) === null || _e === void 0 ? void 0 : _e.enabled) !== null && _f !== void 0 ? _f : false;
                            hasSweep = (_h = (_g = liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep) === null || _g === void 0 ? void 0 : _g.detected) !== null && _h !== void 0 ? _h : false;
                            isFakeout = (_k = (_j = liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep) === null || _j === void 0 ? void 0 : _j.isFakeout) !== null && _k !== void 0 ? _k : false;
                            this.logger.info('📊 Pattern 2 - Liquidity Sweep Check', {
                                enabled: pattern2Enabled,
                                hasSweep: hasSweep,
                                isFakeout: isFakeout,
                                sweepDirection: (_l = liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep) === null || _l === void 0 ? void 0 : _l.direction,
                                sweepPrice: (_o = (_m = liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep) === null || _m === void 0 ? void 0 : _m.sweepPrice) === null || _o === void 0 ? void 0 : _o.toFixed(4),
                                sweepStrength: (_q = (_p = liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep) === null || _p === void 0 ? void 0 : _p.strength) === null || _q === void 0 ? void 0 : _q.toFixed(2),
                            });
                            if (pattern2Enabled && hasSweep && isFakeout && (liquidityAnalysis === null || liquidityAnalysis === void 0 ? void 0 : liquidityAnalysis.recentSweep)) {
                                sweep = liquidityAnalysis.recentSweep;
                                longSweepConditions = {
                                    sweepDown: sweep.direction === 'DOWN',
                                    trendBullish: context.trend === 'BULLISH',
                                    rsiNotOverbought: rsiValue < 70,
                                };
                                this.logger.info('📊 Pattern 2 - LONG Sweep Check', longSweepConditions);
                                if (longSweepConditions.sweepDown &&
                                    longSweepConditions.trendBullish &&
                                    longSweepConditions.rsiNotOverbought) {
                                    direction = types_1.SignalDirection.LONG;
                                    confidence = 0.80; // Higher base confidence for liquidity sweep!
                                    patternType = 'LIQUIDITY_SWEEP';
                                    reason = "LONG: Liquidity sweep fakeout at ".concat(sweep.sweepPrice.toFixed(4), ", RSI ").concat(rsiValue.toFixed(2));
                                    this.logger.info('✅ LONG Pattern 2 matched!', { confidence: confidence, reason: reason });
                                }
                                shortSweepConditions = {
                                    sweepUp: sweep.direction === 'UP',
                                    trendBearish: context.trend === 'BEARISH',
                                    rsiNotOversold: rsiValue > 30,
                                };
                                this.logger.info('📊 Pattern 2 - SHORT Sweep Check', shortSweepConditions);
                                if (direction === types_1.SignalDirection.HOLD && // Only if LONG sweep didn't match
                                    shortSweepConditions.sweepUp &&
                                    shortSweepConditions.trendBearish &&
                                    shortSweepConditions.rsiNotOversold) {
                                    direction = types_1.SignalDirection.SHORT;
                                    confidence = 0.80; // Higher base confidence for liquidity sweep!
                                    patternType = 'LIQUIDITY_SWEEP';
                                    reason = "SHORT: Liquidity sweep fakeout at ".concat(sweep.sweepPrice.toFixed(4), ", RSI ").concat(rsiValue.toFixed(2));
                                    this.logger.info('✅ SHORT Pattern 2 matched!', { confidence: confidence, reason: reason });
                                }
                            }
                            else {
                                blockedBy = [];
                                if (!pattern2Enabled)
                                    blockedBy.push('PATTERN_2_DISABLED');
                                if (!hasSweep)
                                    blockedBy.push('NO_LIQUIDITY_SWEEP');
                                if (hasSweep && !isFakeout)
                                    blockedBy.push('SWEEP_NOT_FAKEOUT');
                                if (blockedBy.length > 0) {
                                    this.logger.info('❌ Pattern 2 blocked', { blockedBy: blockedBy });
                                }
                            }
                        }
                        // No pattern found
                        if (direction === types_1.SignalDirection.HOLD) {
                            return [2 /*return*/, this.noEntry(timestamp, context, 'No entry pattern found', ['NO_ENTRY_PATTERN'])];
                        }
                        priceActionBoosts = 0;
                        boostDetails = [];
                        if ((_r = this.config.priceAction) === null || _r === void 0 ? void 0 : _r.enabled) {
                            // Divergence boost
                            if (divergence && divergence.type !== divergence_detector_1.DivergenceType.NONE) {
                                divergenceBoost = (_s = this.config.priceAction.divergenceBoost) !== null && _s !== void 0 ? _s : 0.10;
                                // Check if divergence aligns with signal direction
                                if ((direction === types_1.SignalDirection.LONG && divergence.type === divergence_detector_1.DivergenceType.BULLISH) ||
                                    (direction === types_1.SignalDirection.SHORT && divergence.type === divergence_detector_1.DivergenceType.BEARISH)) {
                                    boost = divergenceBoost * divergence.strength;
                                    priceActionBoosts += boost;
                                    boostDetails.push("Divergence: +".concat((boost * 100).toFixed(1), "%"));
                                }
                                // Penalty if divergence opposes signal
                                else {
                                    penalty = divergenceBoost * divergence.strength * 0.5;
                                    priceActionBoosts -= penalty;
                                    boostDetails.push("Divergence conflict: -".concat((penalty * 100).toFixed(1), "%"));
                                }
                            }
                            // CHoCH/BoS boost
                            if (chochBos && chochBos.detected) {
                                chochBoost = (_t = this.config.priceAction.chochBoost) !== null && _t !== void 0 ? _t : 0.10;
                                // Check if CHoCH aligns with signal direction
                                if ((direction === types_1.SignalDirection.LONG && chochBos.direction === 'BULLISH') ||
                                    (direction === types_1.SignalDirection.SHORT && chochBos.direction === 'BEARISH')) {
                                    priceActionBoosts += chochBoost;
                                    boostDetails.push("".concat(chochBos.type, ": +").concat((chochBoost * 100).toFixed(1), "%"));
                                }
                            }
                            // Liquidity sweep boost (already in base confidence, but log it)
                            if (patternType === 'LIQUIDITY_SWEEP') {
                                sweepBoost = (_u = this.config.priceAction.liquiditySweepBoost) !== null && _u !== void 0 ? _u : 0.15;
                                boostDetails.push("Liquidity Sweep: +".concat((sweepBoost * 100).toFixed(1), "% (in base)"));
                            }
                        }
                        // Apply boosts to confidence
                        confidence += priceActionBoosts;
                        confidence = Math.max(0.3, Math.min(1.0, confidence)); // Clamp to 0.3-1.0
                        finalConfidence = confidence * context.overallModifier;
                        this.logger.info('📈 Confidence calculation', {
                            patternType: patternType,
                            baseConfidence: (confidence - priceActionBoosts).toFixed(2),
                            priceActionBoosts: priceActionBoosts > 0 ? "+".concat(priceActionBoosts.toFixed(2)) : priceActionBoosts.toFixed(2),
                            boostDetails: boostDetails.length > 0 ? boostDetails : undefined,
                            adjustedConfidence: confidence.toFixed(2),
                            contextModifier: context.overallModifier.toFixed(2),
                            finalConfidence: finalConfidence.toFixed(2),
                            warnings: context.warnings,
                        });
                        MIN_CONFIDENCE = 0.5;
                        if (finalConfidence < MIN_CONFIDENCE) {
                            this.logger.info('❌ Entry blocked by low confidence', {
                                finalConfidence: finalConfidence.toFixed(2),
                                minRequired: MIN_CONFIDENCE,
                                warnings: context.warnings,
                            });
                            return [2 /*return*/, this.noEntry(timestamp, context, "Low confidence: ".concat(finalConfidence.toFixed(2), " < ").concat(MIN_CONFIDENCE), ['LOW_CONFIDENCE'])];
                        }
                        isLong = direction === types_1.SignalDirection.LONG;
                        stopLoss = isLong
                            ? currentPrice * (1 - this.config.stopLossPercent / 100)
                            : currentPrice * (1 + this.config.stopLossPercent / 100);
                        takeProfits = this.config.takeProfits.map(function (tp) { return ({
                            level: tp.level,
                            price: isLong
                                ? currentPrice * (1 + tp.percent / 100)
                                : currentPrice * (1 - tp.percent / 100),
                            sizePercent: tp.sizePercent,
                            percent: tp.percent,
                            hit: false,
                        }); });
                        this.logger.info('✅ Entry signal found!', {
                            direction: direction,
                            patternType: patternType,
                            baseConfidence: (confidence - priceActionBoosts).toFixed(2),
                            priceActionBoosts: priceActionBoosts !== 0 ? "".concat(priceActionBoosts > 0 ? '+' : '').concat(priceActionBoosts.toFixed(2)) : undefined,
                            adjustedConfidence: confidence.toFixed(2),
                            finalConfidence: finalConfidence.toFixed(2),
                            modifier: context.overallModifier.toFixed(2),
                            reason: reason,
                            entryPrice: currentPrice,
                            stopLoss: stopLoss,
                            warnings: context.warnings,
                        });
                        return [2 /*return*/, {
                                timestamp: timestamp,
                                shouldEnter: true,
                                direction: direction,
                                confidence: finalConfidence, // Use modified confidence
                                reason: reason,
                                entryPrice: currentPrice,
                                stopLoss: stopLoss,
                                takeProfits: takeProfits,
                                context: context,
                            }];
                }
            });
        });
    };
    /**
     * Helper: return no entry signal
     */
    EntryScanner.prototype.noEntry = function (timestamp, context, reason, blockedBy) {
        return {
            timestamp: timestamp,
            shouldEnter: false,
            direction: types_1.SignalDirection.HOLD,
            confidence: 0,
            reason: reason,
            entryPrice: 0,
            stopLoss: 0,
            takeProfits: [],
            context: context,
        };
    };
    return EntryScanner;
}());
exports.EntryScanner = EntryScanner;
