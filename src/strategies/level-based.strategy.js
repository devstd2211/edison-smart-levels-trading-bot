"use strict";
/**
 * Level-Based Strategy (Priority 2)
 *
 * Entry conditions:
 * 1. Price near support/resistance level (swing points from ZigZag)
 * 2. Distance to level < 1.5%
 * 3. Level has minimum touches (default: 2+ touches required)
 * 4. Level strength based on touches (more touches = stronger level)
 * 5. Trend alignment (prefer LONG near support in uptrend, SHORT near resistance in downtrend)
 *
 * Confidence calculation:
 * - Base confidence: 0.70
 * - Level strength boost: 0 to +40% (based on touches)
 * - Trend alignment boost: +15%
 * - Distance penalty: closer = higher confidence
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
exports.LevelBasedStrategy = void 0;
var types_1 = require("../types");
var zigzag_indicator_1 = require("../indicators/zigzag.indicator");
var confidence_helper_1 = require("../utils/confidence.helper");
var volume_calculator_1 = require("../analyzers/volume.calculator");
var session_detector_1 = require("../utils/session-detector");
var pattern_analyzer_helper_1 = require("../analyzers/pattern-analyzer.helper");
// ============================================================================
// CONSTANTS
// ============================================================================
var STRATEGY_NAME = 'LevelBased';
var STRATEGY_PRIORITY = 2; // Second priority (after TrendFollowing)
var MAX_DISTANCE_TO_LEVEL_PERCENT = 1.5; // Price must be within 1.5% of level
var BASE_CONFIDENCE = 0.70;
var MAX_LEVEL_STRENGTH_BOOST = 0.40; // Up to +40% for strong levels
var TREND_ALIGNMENT_BOOST = 0.15; // +15% if trend aligns
var MIN_TOUCHES_FOR_STRONG_LEVEL = 3; // 3+ touches = strong level
// ============================================================================
// LEVEL-BASED STRATEGY
// ============================================================================
var LevelBasedStrategy = /** @class */ (function () {
    function LevelBasedStrategy(config, logger, weightMatrix) {
        var _a;
        this.config = config;
        this.logger = logger;
        this.name = STRATEGY_NAME;
        this.priority = STRATEGY_PRIORITY;
        this.patternAnalyzer = null;
        this.weightMatrix = null;
        this.zigzag = new zigzag_indicator_1.ZigZagIndicator((_a = config.zigzagDepth) !== null && _a !== void 0 ? _a : 2);
        this.volumeCalculator = new volume_calculator_1.VolumeCalculator(logger);
        // Initialize pattern analyzer if any patterns are configured
        if (config.patterns) {
            this.patternAnalyzer = new pattern_analyzer_helper_1.PatternAnalyzerHelper(config.patterns, logger, STRATEGY_NAME);
        }
        // Initialize weight matrix if provided
        if (weightMatrix) {
            this.weightMatrix = weightMatrix;
            this.logger.info("".concat(STRATEGY_NAME, " Strategy: Weight Matrix enabled"));
        }
    }
    /**
     * Evaluate market data for level-based entry
     */
    LevelBasedStrategy.prototype.evaluate = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, swingHighs, swingLows, supportLevels, resistanceLevels, nearestSupport, nearestResistance, direction, level, reason, supportDistance, resistanceDistance, isDowntrend, isAligned, distancePercent, confidence, scoreBreakdown, volumeAnalysis, currentCandle, input, strengthBoost, distanceModifier, patternResult, signal;
            var _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                this.logger.info("\uD83D\uDD0D ".concat(this.name, " Strategy Evaluation"), {
                    price: data.currentPrice,
                    trend: data.trend,
                    candles: data.candles.length,
                });
                _a = this.zigzag.findSwingPoints(data.candles), swingHighs = _a.swingHighs, swingLows = _a.swingLows;
                this.logger.info("\uD83D\uDCCA ".concat(this.name, " Swing Points"), {
                    highs: swingHighs.length,
                    lows: swingLows.length,
                    candles: data.candles.length,
                });
                if (swingHighs.length < 2 && swingLows.length < 2) {
                    this.logger.info("\u274C ".concat(this.name, " BLOCKED"), {
                        blockedBy: ['NOT_ENOUGH_SWING_POINTS'],
                        highs: swingHighs.length,
                        lows: swingLows.length,
                    });
                    return [2 /*return*/, this.noSignal('Not enough swing points for level detection')];
                }
                supportLevels = this.buildLevels(swingLows, 'SUPPORT', data.timestamp);
                resistanceLevels = this.buildLevels(swingHighs, 'RESISTANCE', data.timestamp);
                this.logger.info("\uD83D\uDCCA ".concat(this.name, " Levels Detected"), {
                    support: supportLevels.length,
                    resistance: resistanceLevels.length,
                    supportPrices: supportLevels.map(function (l) { return l.price.toFixed(4); }),
                    resistancePrices: resistanceLevels.map(function (l) { return l.price.toFixed(4); }),
                });
                nearestSupport = this.findNearestLevel(data.currentPrice, supportLevels, this.config.maxDistancePercent, 'SUPPORT');
                nearestResistance = this.findNearestLevel(data.currentPrice, resistanceLevels, this.config.maxDistancePercent, 'RESISTANCE');
                direction = null;
                level = null;
                reason = '';
                // Choose the NEAREST level (by distance) - don't prioritize LONG over SHORT!
                if (nearestSupport && nearestResistance) {
                    supportDistance = Math.abs((data.currentPrice - nearestSupport.price) / nearestSupport.price) * 100;
                    resistanceDistance = Math.abs((data.currentPrice - nearestResistance.price) / nearestResistance.price) * 100;
                    if (supportDistance <= resistanceDistance) {
                        // Support is closer → LONG
                        direction = types_1.SignalDirection.LONG;
                        level = nearestSupport;
                        reason = "Price near support level ".concat(nearestSupport.price.toFixed(4), " (").concat(nearestSupport.touches, " touches)");
                    }
                    else {
                        // Resistance is closer → SHORT
                        direction = types_1.SignalDirection.SHORT;
                        level = nearestResistance;
                        reason = "Price near resistance level ".concat(nearestResistance.price.toFixed(4), " (").concat(nearestResistance.touches, " touches)");
                    }
                }
                else if (nearestSupport) {
                    // Only support found → LONG
                    direction = types_1.SignalDirection.LONG;
                    level = nearestSupport;
                    reason = "Price near support level ".concat(nearestSupport.price.toFixed(4), " (").concat(nearestSupport.touches, " touches)");
                }
                else if (nearestResistance) {
                    // Only resistance found → SHORT
                    direction = types_1.SignalDirection.SHORT;
                    level = nearestResistance;
                    reason = "Price near resistance level ".concat(nearestResistance.price.toFixed(4), " (").concat(nearestResistance.touches, " touches)");
                }
                this.logger.info("\uD83D\uDCCA ".concat(this.name, " Nearest Levels Check"), {
                    currentPrice: data.currentPrice.toFixed(4),
                    nearestSupport: nearestSupport ? "".concat(nearestSupport.price.toFixed(4), " (").concat(nearestSupport.touches, "T)") : 'none',
                    nearestResistance: nearestResistance ? "".concat(nearestResistance.price.toFixed(4), " (").concat(nearestResistance.touches, "T)") : 'none',
                    maxDistance: this.config.maxDistancePercent + '%',
                });
                if (!direction || !level) {
                    this.logger.info("\u274C ".concat(this.name, " BLOCKED"), {
                        blockedBy: ['NO_LEVELS_WITHIN_DISTANCE'],
                        maxDistance: this.config.maxDistancePercent + '%',
                    });
                    return [2 /*return*/, this.noSignal('No levels within distance threshold')];
                }
                this.logger.info("\u2705 ".concat(this.name, " Level Pattern Found"), {
                    direction: direction,
                    levelPrice: level.price.toFixed(4),
                    levelType: level.type,
                    touches: level.touches,
                    strength: level.strength.toFixed(2),
                });
                // ========================================================================
                // STEP 4.5: LONG Downtrend Filter (if enabled)
                // ========================================================================
                if (this.config.blockLongInDowntrend && direction === types_1.SignalDirection.LONG) {
                    isDowntrend = this.isDowntrend(data);
                    this.logger.info("\uD83D\uDCCA ".concat(this.name, " LONG Downtrend Filter"), {
                        blockLongInDowntrend: this.config.blockLongInDowntrend,
                        emaFast: data.ema.fast.toFixed(4),
                        emaSlow: data.ema.slow.toFixed(4),
                        emaFastBelowSlow: data.ema.fast < data.ema.slow,
                        rsi: data.rsi.toFixed(2),
                        rsiBelowNeutral: data.rsi < 50,
                        isDowntrend: isDowntrend,
                    });
                    if (isDowntrend) {
                        this.logger.info("\u274C ".concat(this.name, " BLOCKED"), {
                            blockedBy: ['LONG_IN_DOWNTREND'],
                            reason: 'LONG blocked: market in downtrend (EMA20 < EMA50 AND RSI < 50)',
                            emaFast: data.ema.fast.toFixed(4),
                            emaSlow: data.ema.slow.toFixed(4),
                            rsi: data.rsi.toFixed(2),
                        });
                        return [2 /*return*/, this.noSignal("LONG blocked in downtrend (EMA ".concat(data.ema.fast.toFixed(4), " < ").concat(data.ema.slow.toFixed(4), ", RSI ").concat(data.rsi.toFixed(1), ")"))];
                    }
                }
                // ========================================================================
                // STEP 4.6: LONG RSI Filter (DISABLED - Weight System handles RSI now)
                // ========================================================================
                // RSI is now a MODIFIER (via Weight System), NOT a blocker!
                // Strong levels can work even with neutral RSI - Weight System will apply penalty if needed
                // Old logic: Hard block if RSI < 50
                // New logic: Weight System applies penalty/bonus based on RSI, then minConfidenceToEnter filters
                // if (direction === SignalDirection.LONG && data.rsi < 50) {
                //   this.logger.info(`❌ ${this.name} BLOCKED`, {
                //     blockedBy: ['LONG_RSI_TOO_LOW'],
                //     reason: 'LONG requires RSI >= 50 (bullish momentum)',
                //     rsi: data.rsi.toFixed(2),
                //     levelPrice: level.price.toFixed(4),
                //   });
                //   return this.noSignal(`LONG blocked: RSI ${data.rsi.toFixed(1)} < 50 (no bullish momentum)`);
                // }
                // ========================================================================
                // NOTE: LONG Entry Confirmation
                // ========================================================================
                // LONG entries will be sent to LongEntryConfirmationManager in PositionManager
                // to wait for next 1m candle close confirmation (avoids falling knife entries)
                // ========================================================================
                // STEP 4.7: Market Structure Filter (DISABLED - Weight System handles this)
                // ========================================================================
                // Market structure is now a MODIFIER (via Weight System), NOT a blocker!
                // Strong resistance can work even in bullish structure - Weight System applies penalty
                // Old logic: Hard block SHORT in bullish (HL), hard block LONG in bearish (LH)
                // New logic: Weight System applies penalty/bonus based on structure alignment
                // const marketStructure = data.context?.marketStructure;
                // if (marketStructure) {
                //   // Block LONG when market structure is bearish (LH = Lower High)
                //   if (direction === SignalDirection.LONG && marketStructure === 'LH') {
                //     this.logger.info(`❌ ${this.name} BLOCKED`, {
                //       blockedBy: ['BEARISH_MARKET_STRUCTURE'],
                //       reason: 'LONG blocked: market structure is LH (Lower High - bearish pattern)',
                //       marketStructure,
                //       levelPrice: level.price.toFixed(4),
                //     });
                //     return this.noSignal(`LONG blocked: market structure LH (bearish)`);
                //   }
                //
                //   // Block SHORT when market structure is bullish (HL = Higher Low)
                //   if (direction === SignalDirection.SHORT && marketStructure === 'HL') {
                //     this.logger.info(`❌ ${this.name} BLOCKED`, {
                //       blockedBy: ['BULLISH_MARKET_STRUCTURE'],
                //       reason: 'SHORT blocked: market structure is HL (Higher Low - bullish pattern)',
                //       marketStructure,
                //       levelPrice: level.price.toFixed(4),
                //     });
                //     return this.noSignal(`SHORT blocked: market structure HL (bullish)`);
                //   }
                // }
                // ========================================================================
                // STEP 5: Trend alignment check
                // ========================================================================
                if (this.config.requireTrendAlignment) {
                    isAligned = this.isTrendAligned(direction, data.trend);
                    this.logger.info("\uD83D\uDCCA ".concat(this.name, " Trend Alignment Check"), {
                        signalDirection: direction,
                        contextTrend: data.trend,
                        isAligned: isAligned,
                    });
                    if (!isAligned) {
                        this.logger.info("\u274C ".concat(this.name, " BLOCKED"), {
                            blockedBy: ['TREND_NOT_ALIGNED'],
                            direction: direction,
                            trend: data.trend,
                        });
                        return [2 /*return*/, this.noSignal("Trend ".concat(data.trend, " not aligned with ").concat(direction, " signal"))];
                    }
                }
                distancePercent = Math.abs((data.currentPrice - level.price) / level.price) * 100;
                scoreBreakdown = null;
                // Use Weight Matrix if enabled
                if (this.weightMatrix) {
                    volumeAnalysis = this.volumeCalculator.calculate(data.candles);
                    currentCandle = data.candles[data.candles.length - 1];
                    input = {
                        rsi: data.rsi,
                        stochastic: data.stochastic ? { k: data.stochastic.k, d: data.stochastic.d } : undefined,
                        ema: { fast: data.ema.fast, slow: data.ema.slow, price: data.currentPrice },
                        bollingerBands: data.bollingerBands ? { position: data.bollingerBands.percentB } : undefined,
                        atr: data.atr ? { current: data.atr, average: data.atr } : undefined,
                        volume: {
                            current: currentCandle.volume,
                            average: volumeAnalysis.avgVolume,
                        },
                        delta: data.deltaAnalysis
                            ? { buyPressure: data.deltaAnalysis.buyVolume, sellPressure: data.deltaAnalysis.sellVolume }
                            : undefined, // PHASE 4: Delta analysis
                        levelStrength: { touches: level.touches, strength: level.strength },
                        levelDistance: { percent: distancePercent },
                        swingPoints: { quality: level.strength }, // Use level strength as swing quality
                        seniorTFAlignment: {
                            aligned: this.isTrendAligned(direction, data.trend),
                            strength: this.isTrendAligned(direction, data.trend) ? 1.0 : 0.0,
                        },
                        tfAlignmentScore: data.tfAlignment && direction === types_1.SignalDirection.LONG
                            ? data.tfAlignment.long.score
                            : data.tfAlignment
                                ? data.tfAlignment.short.score
                                : undefined, // PHASE 6: Multi-timeframe alignment
                    };
                    scoreBreakdown = this.weightMatrix.calculateScore(input, direction);
                    confidence = scoreBreakdown.confidence;
                    // Log contributions for transparency
                    this.logger.info("\uD83D\uDCCA ".concat(this.name, " Weight Matrix Score"), {
                        confidence: (confidence * 100).toFixed(1) + '%',
                        totalScore: "".concat(scoreBreakdown.totalScore.toFixed(1), "/").concat(scoreBreakdown.maxPossibleScore),
                        rsi: (_b = scoreBreakdown.contributions.rsi) === null || _b === void 0 ? void 0 : _b.reason,
                        volume: (_c = scoreBreakdown.contributions.volume) === null || _c === void 0 ? void 0 : _c.reason,
                        levelStrength: (_d = scoreBreakdown.contributions.levelStrength) === null || _d === void 0 ? void 0 : _d.reason,
                        levelDistance: (_e = scoreBreakdown.contributions.levelDistance) === null || _e === void 0 ? void 0 : _e.reason,
                        ema: (_f = scoreBreakdown.contributions.ema) === null || _f === void 0 ? void 0 : _f.reason,
                        stochastic: (_g = scoreBreakdown.contributions.stochastic) === null || _g === void 0 ? void 0 : _g.reason,
                    });
                }
                else {
                    // Legacy confidence calculation
                    confidence = BASE_CONFIDENCE;
                    strengthBoost = level.strength * MAX_LEVEL_STRENGTH_BOOST;
                    confidence += strengthBoost;
                    // Trend alignment boost (+15%)
                    if (this.isTrendAligned(direction, data.trend)) {
                        confidence += TREND_ALIGNMENT_BOOST;
                    }
                    distanceModifier = this.calculateDistanceModifier(distancePercent);
                    confidence *= distanceModifier;
                    // ========================================================================
                    // STEP 6.5: Pattern Analysis (all patterns via helper)
                    // ========================================================================
                    if (this.patternAnalyzer) {
                        patternResult = this.patternAnalyzer.analyzePatterns({
                            candles: data.candles,
                            swingPoints: data.swingPoints,
                            direction: direction,
                            trend: data.trend,
                            strategyName: this.name,
                        });
                        confidence += patternResult.confidenceBoost;
                        reason += patternResult.reasonAdditions;
                    }
                    // Normalize confidence to 0-100 range
                    confidence = confidence_helper_1.ConfidenceHelper.normalize(confidence);
                }
                signal = this.buildSignal(direction, confidence, data, reason, level);
                this.logger.info("\u2705 ".concat(this.name, " SIGNAL GENERATED!"), {
                    direction: direction,
                    reason: reason,
                    level: level.price.toFixed(4),
                    levelStrength: level.strength.toFixed(2),
                    touches: level.touches,
                    distance: distancePercent.toFixed(2) + '%',
                    confidence: confidence.toFixed(2),
                    entry: data.currentPrice.toFixed(4),
                    sl: signal.stopLoss.toFixed(4),
                });
                return [2 /*return*/, {
                        valid: true,
                        signal: signal,
                        strategyName: this.name,
                        priority: this.priority,
                        reason: reason,
                    }];
            });
        });
    };
    /**
     * Build levels from swing points
     * Groups swing points that are close together (within 0.3%)
     */
    LevelBasedStrategy.prototype.buildLevels = function (swingPoints, type, currentTime) {
        if (swingPoints.length === 0)
            return [];
        var levels = [];
        var CLUSTER_THRESHOLD = 0.003; // 0.3% - group nearby points
        // Sort by price
        var sorted = __spreadArray([], swingPoints, true).sort(function (a, b) { return a.price - b.price; });
        var currentCluster = [sorted[0]];
        for (var i = 1; i < sorted.length; i++) {
            var point = sorted[i];
            var prevPoint = currentCluster[currentCluster.length - 1];
            var priceDiff = Math.abs(point.price - prevPoint.price) / prevPoint.price;
            if (priceDiff <= CLUSTER_THRESHOLD) {
                // Add to current cluster
                currentCluster.push(point);
            }
            else {
                // Create level from current cluster
                levels.push(this.createLevelFromCluster(currentCluster, type, currentTime));
                // Start new cluster
                currentCluster = [point];
            }
        }
        // Don't forget last cluster
        if (currentCluster.length > 0) {
            levels.push(this.createLevelFromCluster(currentCluster, type, currentTime));
        }
        return levels;
    };
    /**
     * Create a level from a cluster of swing points
     */
    LevelBasedStrategy.prototype.createLevelFromCluster = function (cluster, type, currentTime) {
        // Average price of cluster
        var avgPrice = cluster.reduce(function (sum, p) { return sum + p.price; }, 0) / cluster.length;
        // Touches = number of points in cluster
        var touches = cluster.length;
        // Last touch timestamp
        var lastTouch = Math.max.apply(Math, cluster.map(function (p) { return p.timestamp; }));
        // Strength: 0-1 based on touches (3+ touches = 1.0)
        var strength = Math.min(touches / MIN_TOUCHES_FOR_STRONG_LEVEL, 1.0);
        return {
            price: avgPrice,
            type: type,
            strength: strength,
            touches: touches,
            lastTouch: lastTouch,
        };
    };
    /**
     * Find nearest level within distance threshold
     * For SUPPORT: only accept if price >= level (not below)
     * For RESISTANCE: only accept if price <= level (not above)
     */
    LevelBasedStrategy.prototype.findNearestLevel = function (price, levels, maxDistancePercent, levelType) {
        var _a, _b;
        if (levels.length === 0)
            return null;
        var nearest = null;
        var minDistance = Infinity;
        // Determine minTouches based on level type (SUPPORT=LONG, RESISTANCE=SHORT)
        var minTouches = levelType === 'SUPPORT'
            ? (_a = this.config.minTouchesRequiredLong) !== null && _a !== void 0 ? _a : this.config.minTouchesRequired
            : (_b = this.config.minTouchesRequiredShort) !== null && _b !== void 0 ? _b : this.config.minTouchesRequired;
        var debugCandidates = [];
        for (var _i = 0, levels_1 = levels; _i < levels_1.length; _i++) {
            var level = levels_1[_i];
            var distancePercent = Math.abs((price - level.price) / level.price) * 100;
            var isValidDirection = levelType === 'SUPPORT' ? price >= level.price : price <= level.price;
            // Debug info
            debugCandidates.push({
                price: level.price.toFixed(4),
                touches: level.touches,
                distance: distancePercent.toFixed(2) + '%',
                validDirection: isValidDirection,
                enoughTouches: level.touches >= minTouches,
                withinDistance: distancePercent <= maxDistancePercent,
            });
            // Filter out weak levels (< minTouches for direction)
            if (level.touches < minTouches) {
                continue; // Skip this level - not enough touches
            }
            // Direction-aware filtering:
            // - SUPPORT: price should be >= level (bounce from support)
            // - RESISTANCE: price should be <= level (bounce from resistance)
            if (isValidDirection && distancePercent <= maxDistancePercent && distancePercent < minDistance) {
                nearest = level;
                minDistance = distancePercent;
            }
        }
        // Log debug info if no nearest found
        if (!nearest && debugCandidates.length > 0) {
            this.logger.debug("\uD83D\uDD0D ".concat(this.name, " findNearestLevel DEBUG"), {
                levelType: levelType,
                currentPrice: price.toFixed(4),
                minTouches: minTouches,
                maxDistance: maxDistancePercent + '%',
                candidates: debugCandidates,
            });
        }
        return nearest;
    };
    /**
     * Check if trend aligns with signal direction
     */
    LevelBasedStrategy.prototype.isTrendAligned = function (direction, trend) {
        if (direction === types_1.SignalDirection.LONG && trend === 'BULLISH')
            return true;
        if (direction === types_1.SignalDirection.SHORT && trend === 'BEARISH')
            return true;
        return false;
    };
    /**
     * Check if market is in downtrend
     * Criteria: EMA20 < EMA50 AND (RSI < 55 OR strong EMA divergence)
     *
     * Strengthened in Session 36:
     * - RSI threshold increased from 50 to 55
     * - Added EMA divergence check (>0.5% = strong downtrend)
     */
    LevelBasedStrategy.prototype.isDowntrend = function (data) {
        var emaDowntrend = data.ema.fast < data.ema.slow; // EMA20 < EMA50
        var rsiWeak = data.rsi < 55; // Increased from 50 to 55 (more conservative)
        // Calculate EMA divergence percentage
        var emaDiff = ((data.ema.slow - data.ema.fast) / data.ema.fast) * 100;
        var strongDowntrend = emaDiff > 0.5; // EMA difference > 0.5% = strong downtrend
        // Block LONG if: downtrend AND (weak RSI OR strong EMA divergence)
        return emaDowntrend && (rsiWeak || strongDowntrend);
    };
    /**
     * Calculate distance modifier
     * Closer to level = higher confidence
     */
    LevelBasedStrategy.prototype.calculateDistanceModifier = function (distancePercent) {
        if (distancePercent < 0.5) {
            // Very close (< 0.5%)
            return 1.1; // +10%
        }
        else if (distancePercent > 1.2) {
            // Far (> 1.2%)
            return 0.9; // -10%
        }
        return 1.0; // Normal
    };
    /**
     * Build a trading signal
     */
    LevelBasedStrategy.prototype.buildSignal = function (direction, confidence, data, reason, level) {
        var price = data.currentPrice;
        var atrPercent = data.atr || 1.0; // ATR in percent (e.g., 1.5%)
        // Convert ATR from percent to absolute value
        var atrAbsolute = price * (atrPercent / 100);
        // Stop loss: below/above the level (using configurable ATR multiplier)
        // For LONG, use stopLossAtrMultiplierLong if configured, otherwise use default
        var slMultiplier = direction === types_1.SignalDirection.LONG && this.config.stopLossAtrMultiplierLong
            ? this.config.stopLossAtrMultiplierLong
            : this.config.stopLossAtrMultiplier;
        var stopLossDistance = atrAbsolute * slMultiplier;
        // Enforce minimum SL distance to avoid too tight stops (critical fix for low ATR markets)
        var MIN_SL_DISTANCE_PERCENT = 1.0; // 1% minimum (prevents 0.2-0.7% stops that get hit immediately)
        var minSlDistance = price * (MIN_SL_DISTANCE_PERCENT / 100);
        stopLossDistance = Math.max(stopLossDistance, minSlDistance);
        // Apply session-based SL widening if enabled
        stopLossDistance = session_detector_1.SessionDetector.applySessionBasedSL(stopLossDistance, this.config.sessionBasedSL, this.logger, this.name);
        var stopLoss = direction === types_1.SignalDirection.LONG
            ? level.price - stopLossDistance // Below support (correct!)
            : level.price + stopLossDistance; // Above resistance (correct!)
        // Take profits: from config
        var takeProfits = this.config.takeProfits.map(function (tp) { return ({
            level: tp.level,
            percent: tp.percent,
            sizePercent: tp.sizePercent,
            price: direction === types_1.SignalDirection.LONG
                ? price * (1 + tp.percent / 100)
                : price * (1 - tp.percent / 100),
            hit: false,
        }); });
        // Calculate metrics for journal
        var distanceToLevel = Math.abs((price - level.price) / price) * 100;
        var distanceToEma = Math.abs((price - data.ema.slow) / price) * 100;
        var volumeAnalysis = this.volumeCalculator.calculate(data.candles);
        return {
            direction: direction,
            type: types_1.SignalType.LEVEL_BASED,
            confidence: confidence,
            price: price,
            stopLoss: stopLoss,
            takeProfits: takeProfits,
            reason: reason,
            timestamp: data.timestamp,
            marketData: {
                rsi: data.rsi,
                rsiTrend1: data.rsiTrend1,
                ema20: data.ema.fast,
                ema50: data.ema.slow,
                atr: data.atr || 1.0,
                volumeRatio: volumeAnalysis.volumeRatio,
                swingHighsCount: data.swingPoints.filter(function (s) { return s.type === 'HIGH'; }).length,
                swingLowsCount: data.swingPoints.filter(function (s) { return s.type === 'LOW'; }).length,
                trend: data.trend,
                nearestLevel: level.price,
                distanceToLevel: distanceToLevel,
                distanceToEma: distanceToEma,
                stochastic: data.stochastic,
                bollingerBands: data.bollingerBands,
                breakoutPrediction: data.breakoutPrediction,
            },
        };
    };
    /**
     * Return no signal result
     */
    LevelBasedStrategy.prototype.noSignal = function (reason) {
        return {
            valid: false,
            strategyName: this.name,
            priority: this.priority,
            reason: reason,
        };
    };
    return LevelBasedStrategy;
}());
exports.LevelBasedStrategy = LevelBasedStrategy;
