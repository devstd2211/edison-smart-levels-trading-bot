"use strict";
/**
 * Weight Matrix Calculator Service
 *
 * Calculates signal confidence using gradient scoring instead of boolean filters.
 * Each indicator/factor contributes points based on thresholds (excellent/good/ok/weak).
 *
 * Example:
 * - RSI = 25 → 15 pts (good)
 * - Volume = 1.8x avg → 20 pts (good)
 * - Level touches = 4 → 20 pts (excellent)
 * Total: 55 pts → Confidence: 55%
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeightMatrixCalculatorService = void 0;
var types_1 = require("../types");
// ============================================================================
// WEIGHT MATRIX CALCULATOR SERVICE
// ============================================================================
var WeightMatrixCalculatorService = /** @class */ (function () {
    function WeightMatrixCalculatorService(config, logger) {
        this.config = config;
        this.logger = logger;
        this.logger.info('WeightMatrixCalculatorService initialized', {
            enabled: config.enabled,
            minConfidenceToEnter: config.minConfidenceToEnter,
            minConfidenceForReducedSize: config.minConfidenceForReducedSize,
        });
    }
    /**
     * Calculate signal score from market data
     * @param input - Market data from analyzers/indicators
     * @param direction - Signal direction (LONG/SHORT)
     * @returns Score breakdown with confidence percentage
     */
    WeightMatrixCalculatorService.prototype.calculateScore = function (input, direction) {
        if (!this.config.enabled) {
            // Weight matrix disabled - return perfect score
            return {
                totalScore: 100,
                maxPossibleScore: 100,
                confidence: 100,
                contributions: {},
            };
        }
        var contributions = {};
        var totalScore = 0;
        var maxPossibleScore = 0;
        // 1. RSI
        if (this.config.weights.rsi.enabled && input.rsi !== undefined) {
            var score = this.calculateRSIScore(input.rsi, direction, this.config.weights.rsi);
            contributions.rsi = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 2. Stochastic
        if (this.config.weights.stochastic.enabled && input.stochastic !== undefined) {
            var score = this.calculateStochasticScore(input.stochastic, direction, this.config.weights.stochastic);
            contributions.stochastic = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 3. EMA
        if (this.config.weights.ema.enabled && input.ema !== undefined) {
            var score = this.calculateEMAScore(input.ema, direction, this.config.weights.ema);
            contributions.ema = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 4. Bollinger Bands
        if (this.config.weights.bollingerBands.enabled && input.bollingerBands !== undefined) {
            var score = this.calculateBollingerScore(input.bollingerBands, direction, this.config.weights.bollingerBands);
            contributions.bollingerBands = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 5. ATR
        if (this.config.weights.atr.enabled && input.atr !== undefined) {
            var score = this.calculateATRScore(input.atr, this.config.weights.atr);
            contributions.atr = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 6. Volume
        if (this.config.weights.volume.enabled && input.volume !== undefined) {
            var score = this.calculateVolumeScore(input.volume, this.config.weights.volume);
            contributions.volume = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 7. Delta (Buy/Sell pressure)
        if (this.config.weights.delta.enabled && input.delta !== undefined) {
            var score = this.calculateDeltaScore(input.delta, direction, this.config.weights.delta);
            contributions.delta = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 8. Orderbook
        if (this.config.weights.orderbook.enabled && input.orderbook !== undefined) {
            var score = this.calculateOrderbookScore(input.orderbook, this.config.weights.orderbook);
            contributions.orderbook = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 9. Imbalance (Bid/Ask pressure)
        if (this.config.weights.imbalance.enabled && input.imbalance !== undefined) {
            var score = this.calculateImbalanceScore(input.imbalance, direction, this.config.weights.imbalance);
            contributions.imbalance = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 10. Level Strength
        if (this.config.weights.levelStrength.enabled && input.levelStrength !== undefined) {
            var score = this.calculateLevelStrengthScore(input.levelStrength, this.config.weights.levelStrength);
            contributions.levelStrength = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 10. Level Distance
        if (this.config.weights.levelDistance.enabled && input.levelDistance !== undefined) {
            var score = this.calculateLevelDistanceScore(input.levelDistance, this.config.weights.levelDistance);
            contributions.levelDistance = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 11. Swing Points
        if (this.config.weights.swingPoints.enabled && input.swingPoints !== undefined) {
            var score = this.calculateSwingPointsScore(input.swingPoints, this.config.weights.swingPoints);
            contributions.swingPoints = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 12. Chart Patterns
        if (this.config.weights.chartPatterns.enabled && input.chartPatterns !== undefined) {
            var score = this.calculateChartPatternsScore(input.chartPatterns, this.config.weights.chartPatterns);
            contributions.chartPatterns = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 13. Candle Patterns
        if (this.config.weights.candlePatterns.enabled && input.candlePatterns !== undefined) {
            var score = this.calculateCandlePatternsScore(input.candlePatterns, this.config.weights.candlePatterns);
            contributions.candlePatterns = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 14. Senior TF Alignment
        if (this.config.weights.seniorTFAlignment.enabled && input.seniorTFAlignment !== undefined) {
            var score = this.calculateSeniorTFAlignmentScore(input.seniorTFAlignment, this.config.weights.seniorTFAlignment);
            contributions.seniorTFAlignment = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 15. BTC Correlation
        if (this.config.weights.btcCorrelation.enabled && input.btcCorrelation !== undefined) {
            var score = this.calculateBTCCorrelationScore(input.btcCorrelation, this.config.weights.btcCorrelation);
            contributions.btcCorrelation = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 16. TF Alignment (PHASE 6)
        if (this.config.weights.tfAlignment.enabled && input.tfAlignmentScore !== undefined) {
            var score = this.calculateTFAlignmentScore(input.tfAlignmentScore, this.config.weights.tfAlignment);
            contributions.tfAlignment = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 17. Divergence
        if (this.config.weights.divergence.enabled && input.divergence !== undefined) {
            var score = this.calculateDivergenceScore(input.divergence, direction, this.config.weights.divergence);
            contributions.divergence = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // 17. Liquidity Sweep
        if (this.config.weights.liquiditySweep.enabled && input.liquiditySweep !== undefined) {
            var score = this.calculateLiquiditySweepScore(input.liquiditySweep, this.config.weights.liquiditySweep);
            contributions.liquiditySweep = score;
            totalScore += score.points;
            maxPossibleScore += score.maxPoints;
        }
        // Calculate confidence as decimal (0.0-1.0) - NOT percentage!
        var confidence = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) : 0;
        this.logger.debug('Signal score calculated', {
            totalScore: totalScore,
            maxPossibleScore: maxPossibleScore,
            confidence: (confidence * 100).toFixed(2) + '%',
            factorsEvaluated: Object.keys(contributions).length,
        });
        return {
            totalScore: totalScore,
            maxPossibleScore: maxPossibleScore,
            confidence: confidence,
            contributions: contributions,
        };
    };
    /**
     * Check if signal confidence meets entry threshold
     * @param confidence - Confidence percentage (0-100)
     * @returns true if meets minimum threshold
     */
    WeightMatrixCalculatorService.prototype.shouldEnter = function (confidence) {
        return confidence >= this.config.minConfidenceToEnter;
    };
    /**
     * Check if signal confidence meets reduced size threshold
     * @param confidence - Confidence percentage (0-100)
     * @returns true if meets reduced size threshold
     */
    WeightMatrixCalculatorService.prototype.shouldEnterWithReducedSize = function (confidence) {
        return (confidence >= this.config.minConfidenceForReducedSize &&
            confidence < this.config.minConfidenceToEnter);
    };
    // ==========================================================================
    // INDIVIDUAL FACTOR SCORING METHODS
    // ==========================================================================
    /**
     * Calculate RSI score
     * LONG: Lower RSI = Higher score (oversold)
     * SHORT: Higher RSI = Higher score (overbought)
     */
    WeightMatrixCalculatorService.prototype.calculateRSIScore = function (rsi, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        // For LONG: RSI < threshold = better
        // For SHORT: RSI > (100 - threshold) = better
        var isLong = direction === types_1.SignalDirection.LONG;
        var targetRSI = isLong ? rsi : 100 - rsi;
        if (thresholds.excellent && targetRSI <= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "RSI ".concat(rsi.toFixed(1), " (excellent)"),
            };
        }
        else if (thresholds.good && targetRSI <= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "RSI ".concat(rsi.toFixed(1), " (good)"),
            };
        }
        else if (thresholds.ok && targetRSI <= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "RSI ".concat(rsi.toFixed(1), " (ok)"),
            };
        }
        else if (thresholds.weak && targetRSI <= thresholds.weak) {
            return {
                points: maxPoints * 0.25,
                maxPoints: maxPoints,
                reason: "RSI ".concat(rsi.toFixed(1), " (weak)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "RSI ".concat(rsi.toFixed(1), " (not extreme)"),
        };
    };
    /**
     * Calculate Stochastic score
     * LONG: Lower %K = Higher score (oversold)
     * SHORT: Higher %K = Higher score (overbought)
     */
    WeightMatrixCalculatorService.prototype.calculateStochasticScore = function (stochastic, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var k = stochastic.k;
        var isLong = direction === types_1.SignalDirection.LONG;
        var targetK = isLong ? k : 100 - k;
        if (thresholds.excellent && targetK <= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Stoch %K ".concat(k.toFixed(1), " (excellent)"),
            };
        }
        else if (thresholds.good && targetK <= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Stoch %K ".concat(k.toFixed(1), " (good)"),
            };
        }
        else if (thresholds.ok && targetK <= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Stoch %K ".concat(k.toFixed(1), " (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Stoch %K ".concat(k.toFixed(1), " (not extreme)"),
        };
    };
    /**
     * Calculate EMA score
     * LONG: Price above EMA = Higher score
     * SHORT: Price below EMA = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateEMAScore = function (ema, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var fast = ema.fast, slow = ema.slow, price = ema.price;
        // Check EMA alignment
        var isLong = direction === types_1.SignalDirection.LONG;
        var correctAlignment = isLong ? fast > slow && price > fast : fast < slow && price < fast;
        if (!correctAlignment) {
            return {
                points: 0,
                maxPoints: maxPoints,
                reason: 'EMA not aligned',
            };
        }
        // Calculate distance to EMA (%)
        var distance = Math.abs((price - fast) / fast) * 100;
        if (thresholds.excellent && distance <= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "EMA distance ".concat(distance.toFixed(2), "% (excellent)"),
            };
        }
        else if (thresholds.good && distance <= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "EMA distance ".concat(distance.toFixed(2), "% (good)"),
            };
        }
        else if (thresholds.ok && distance <= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "EMA distance ".concat(distance.toFixed(2), "% (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "EMA distance ".concat(distance.toFixed(2), "% (too far)"),
        };
    };
    /**
     * Calculate Bollinger Bands score
     * LONG: Price near lower band (position < 30) = Higher score
     * SHORT: Price near upper band (position > 70) = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateBollingerScore = function (bollingerBands, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var position = bollingerBands.position;
        // Convert position to extremity (0-100)
        // For LONG: lower position = higher extremity
        // For SHORT: higher position = higher extremity
        var isLong = direction === types_1.SignalDirection.LONG;
        var extremity = isLong ? 100 - position : position;
        if (thresholds.excellent && extremity >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "BB position ".concat(position.toFixed(1), "% (excellent)"),
            };
        }
        else if (thresholds.good && extremity >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "BB position ".concat(position.toFixed(1), "% (good)"),
            };
        }
        else if (thresholds.ok && extremity >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "BB position ".concat(position.toFixed(1), "% (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "BB position ".concat(position.toFixed(1), "% (not extreme)"),
        };
    };
    /**
     * Calculate ATR score
     * Higher ATR = Higher volatility = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateATRScore = function (atr, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var current = atr.current, average = atr.average;
        var ratio = current / average;
        if (thresholds.excellent && ratio >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "ATR ".concat(ratio.toFixed(2), "x avg (excellent)"),
            };
        }
        else if (thresholds.good && ratio >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "ATR ".concat(ratio.toFixed(2), "x avg (good)"),
            };
        }
        else if (thresholds.ok && ratio >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "ATR ".concat(ratio.toFixed(2), "x avg (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "ATR ".concat(ratio.toFixed(2), "x avg (low volatility)"),
        };
    };
    /**
     * Calculate Volume score
     * Higher volume = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateVolumeScore = function (volume, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var current = volume.current, average = volume.average;
        var ratio = current / average;
        if (thresholds.excellent && ratio >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Volume ".concat(ratio.toFixed(2), "x avg (excellent)"),
            };
        }
        else if (thresholds.good && ratio >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Volume ".concat(ratio.toFixed(2), "x avg (good)"),
            };
        }
        else if (thresholds.ok && ratio >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Volume ".concat(ratio.toFixed(2), "x avg (ok)"),
            };
        }
        else if (thresholds.weak && ratio >= thresholds.weak) {
            return {
                points: maxPoints * 0.25,
                maxPoints: maxPoints,
                reason: "Volume ".concat(ratio.toFixed(2), "x avg (weak)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Volume ".concat(ratio.toFixed(2), "x avg (too low)"),
        };
    };
    /**
     * Calculate Delta (Buy/Sell pressure) score
     * LONG: Buy pressure > Sell = Higher score
     * SHORT: Sell pressure > Buy = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateDeltaScore = function (delta, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var buyPressure = delta.buyPressure, sellPressure = delta.sellPressure;
        var isLong = direction === types_1.SignalDirection.LONG;
        var ratio = isLong ? buyPressure / sellPressure : sellPressure / buyPressure;
        if (thresholds.excellent && ratio >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Delta ".concat(ratio.toFixed(2), ":1 (excellent)"),
            };
        }
        else if (thresholds.good && ratio >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Delta ".concat(ratio.toFixed(2), ":1 (good)"),
            };
        }
        else if (thresholds.ok && ratio >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Delta ".concat(ratio.toFixed(2), ":1 (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Delta ".concat(ratio.toFixed(2), ":1 (weak)"),
        };
    };
    /**
     * Calculate Orderbook (wall strength) score
     * Higher wall strength = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateOrderbookScore = function (orderbook, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var wallStrength = orderbook.wallStrength;
        if (thresholds.excellent && wallStrength >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Wall strength ".concat(wallStrength.toFixed(0), " (excellent)"),
            };
        }
        else if (thresholds.good && wallStrength >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Wall strength ".concat(wallStrength.toFixed(0), " (good)"),
            };
        }
        else if (thresholds.ok && wallStrength >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Wall strength ".concat(wallStrength.toFixed(0), " (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Wall strength ".concat(wallStrength.toFixed(0), " (weak)"),
        };
    };
    /**
     * Calculate Imbalance (Bid/Ask pressure) score
     * For LONG: BID imbalance (buying pressure) = Higher score
     * For SHORT: ASK imbalance (selling pressure) = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateImbalanceScore = function (imbalance, direction, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var imbalanceDir = imbalance.direction, strength = imbalance.strength;
        // Check alignment: LONG wants BID imbalance, SHORT wants ASK imbalance
        var isLong = direction === types_1.SignalDirection.LONG;
        var aligned = (isLong && imbalanceDir === 'BID') || (!isLong && imbalanceDir === 'ASK');
        // No score if imbalance direction doesn't match signal direction or is NEUTRAL
        if (!aligned) {
            return {
                points: 0,
                maxPoints: maxPoints,
                reason: "Imbalance ".concat(imbalanceDir, " ").concat(strength.toFixed(0), "% (not aligned)"),
            };
        }
        // Score based on strength thresholds
        if (thresholds.excellent && strength >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Imbalance ".concat(imbalanceDir, " ").concat(strength.toFixed(0), "% (excellent)"),
            };
        }
        else if (thresholds.good && strength >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Imbalance ".concat(imbalanceDir, " ").concat(strength.toFixed(0), "% (good)"),
            };
        }
        else if (thresholds.ok && strength >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Imbalance ".concat(imbalanceDir, " ").concat(strength.toFixed(0), "% (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Imbalance ".concat(imbalanceDir, " ").concat(strength.toFixed(0), "% (weak)"),
        };
    };
    /**
     * Calculate Level Strength score
     * More touches & bounces = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateLevelStrengthScore = function (levelStrength, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var touches = levelStrength.touches, strength = levelStrength.strength;
        if (thresholds.excellent && touches >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Level ".concat(touches, " touches (excellent)"),
            };
        }
        else if (thresholds.good && touches >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Level ".concat(touches, " touches (good)"),
            };
        }
        else if (thresholds.ok && touches >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Level ".concat(touches, " touches (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Level ".concat(touches, " touches (weak)"),
        };
    };
    /**
     * Calculate Level Distance score
     * Closer to level = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateLevelDistanceScore = function (levelDistance, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var percent = levelDistance.percent;
        if (thresholds.excellent && percent <= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Level ".concat(percent.toFixed(2), "% away (excellent)"),
            };
        }
        else if (thresholds.good && percent <= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Level ".concat(percent.toFixed(2), "% away (good)"),
            };
        }
        else if (thresholds.ok && percent <= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Level ".concat(percent.toFixed(2), "% away (ok)"),
            };
        }
        else if (thresholds.weak && percent <= thresholds.weak) {
            return {
                points: maxPoints * 0.25,
                maxPoints: maxPoints,
                reason: "Level ".concat(percent.toFixed(2), "% away (weak)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Level ".concat(percent.toFixed(2), "% away (too far)"),
        };
    };
    /**
     * Calculate Swing Points score
     * Higher quality swing = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateSwingPointsScore = function (swingPoints, weight) {
        var maxPoints = weight.maxPoints;
        var quality = swingPoints.quality;
        // Quality is 0-1, map to maxPoints
        var points = quality * maxPoints;
        return {
            points: points,
            maxPoints: maxPoints,
            reason: "Swing quality ".concat((quality * 100).toFixed(0), "%"),
        };
    };
    /**
     * Calculate Chart Patterns score
     * Stronger pattern = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateChartPatternsScore = function (chartPatterns, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var type = chartPatterns.type, strength = chartPatterns.strength;
        if (thresholds.excellent && strength >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Pattern ".concat(type, " ").concat(strength.toFixed(0), "% (excellent)"),
            };
        }
        else if (thresholds.good && strength >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Pattern ".concat(type, " ").concat(strength.toFixed(0), "% (good)"),
            };
        }
        else if (thresholds.ok && strength >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Pattern ".concat(type, " ").concat(strength.toFixed(0), "% (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Pattern ".concat(type, " ").concat(strength.toFixed(0), "% (weak)"),
        };
    };
    /**
     * Calculate Candle Patterns score
     * Stronger pattern = Higher score
     */
    WeightMatrixCalculatorService.prototype.calculateCandlePatternsScore = function (candlePatterns, weight) {
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        var type = candlePatterns.type, strength = candlePatterns.strength;
        if (thresholds.excellent && strength >= thresholds.excellent) {
            return {
                points: maxPoints,
                maxPoints: maxPoints,
                reason: "Candle ".concat(type, " ").concat(strength.toFixed(0), "% (excellent)"),
            };
        }
        else if (thresholds.good && strength >= thresholds.good) {
            return {
                points: maxPoints * 0.75,
                maxPoints: maxPoints,
                reason: "Candle ".concat(type, " ").concat(strength.toFixed(0), "% (good)"),
            };
        }
        else if (thresholds.ok && strength >= thresholds.ok) {
            return {
                points: maxPoints * 0.5,
                maxPoints: maxPoints,
                reason: "Candle ".concat(type, " ").concat(strength.toFixed(0), "% (ok)"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Candle ".concat(type, " ").concat(strength.toFixed(0), "% (weak)"),
        };
    };
    /**
     * Calculate Senior TF Alignment score
     * Aligned with higher timeframe = Full points
     */
    WeightMatrixCalculatorService.prototype.calculateSeniorTFAlignmentScore = function (seniorTFAlignment, weight) {
        var maxPoints = weight.maxPoints;
        var aligned = seniorTFAlignment.aligned, strength = seniorTFAlignment.strength;
        if (aligned) {
            var points = maxPoints * strength;
            return {
                points: points,
                maxPoints: maxPoints,
                reason: "Senior TF aligned ".concat((strength * 100).toFixed(0), "%"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: 'Senior TF not aligned',
        };
    };
    /**
     * Calculate BTC Correlation score
     * Aligned with BTC = Full points
     */
    WeightMatrixCalculatorService.prototype.calculateBTCCorrelationScore = function (btcCorrelation, weight) {
        var maxPoints = weight.maxPoints;
        var correlation = btcCorrelation.correlation;
        // Correlation is 0-1
        var points = correlation * maxPoints;
        return {
            points: points,
            maxPoints: maxPoints,
            reason: "BTC correlation ".concat((correlation * 100).toFixed(0), "%"),
        };
    };
    /**
     * Calculate Divergence score
     * LONG: Bullish divergence = Full points
     * SHORT: Bearish divergence = Full points
     */
    WeightMatrixCalculatorService.prototype.calculateDivergenceScore = function (divergence, direction, weight) {
        var maxPoints = weight.maxPoints;
        var type = divergence.type, strength = divergence.strength;
        var isLong = direction === types_1.SignalDirection.LONG;
        var correctType = (isLong && type === 'BULLISH') || (!isLong && type === 'BEARISH');
        if (correctType) {
            var points = maxPoints * strength;
            return {
                points: points,
                maxPoints: maxPoints,
                reason: "Divergence ".concat(type, " ").concat((strength * 100).toFixed(0), "%"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: "Divergence ".concat(type, " (wrong direction)"),
        };
    };
    /**
     * Calculate Liquidity Sweep score
     * Sweep detected = Full points
     */
    WeightMatrixCalculatorService.prototype.calculateLiquiditySweepScore = function (liquiditySweep, weight) {
        var maxPoints = weight.maxPoints;
        var detected = liquiditySweep.detected, confidence = liquiditySweep.confidence;
        if (detected) {
            var points = maxPoints * confidence;
            return {
                points: points,
                maxPoints: maxPoints,
                reason: "Liquidity sweep ".concat((confidence * 100).toFixed(0), "% confidence"),
            };
        }
        return {
            points: 0,
            maxPoints: maxPoints,
            reason: 'No liquidity sweep',
        };
    };
    /**
     * Calculate TF Alignment score (PHASE 6)
     * Higher alignment score = More points
     *
     * @param alignmentScore - Score from TFAlignmentService (0-100)
     * @param weight - Weight configuration
     * @returns Score breakdown
     */
    WeightMatrixCalculatorService.prototype.calculateTFAlignmentScore = function (alignmentScore, weight) {
        var _a, _b, _c;
        var maxPoints = weight.maxPoints, thresholds = weight.thresholds;
        // Use gradient scoring based on alignment score
        var points = 0;
        if (alignmentScore >= ((_a = thresholds.excellent) !== null && _a !== void 0 ? _a : 90)) {
            // Excellent: 90%+ alignment → Full points
            points = maxPoints;
        }
        else if (alignmentScore >= ((_b = thresholds.good) !== null && _b !== void 0 ? _b : 70)) {
            // Good: 70-89% alignment → 75% points
            points = maxPoints * 0.75;
        }
        else if (alignmentScore >= ((_c = thresholds.ok) !== null && _c !== void 0 ? _c : 50)) {
            // OK: 50-69% alignment → 50% points
            points = maxPoints * 0.5;
        }
        else {
            // Weak: <50% alignment → 25% points
            points = maxPoints * 0.25;
        }
        return {
            points: points,
            maxPoints: maxPoints,
            reason: "TF Alignment ".concat(alignmentScore.toFixed(0), "%"),
        };
    };
    return WeightMatrixCalculatorService;
}());
exports.WeightMatrixCalculatorService = WeightMatrixCalculatorService;
