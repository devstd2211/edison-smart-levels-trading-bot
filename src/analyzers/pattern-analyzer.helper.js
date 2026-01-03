"use strict";
/**
 * Pattern Analyzer Helper
 *
 * Centralized wrapper for all chart pattern detectors.
 * Provides a single method to analyze all patterns and return confidence/reason updates.
 *
 * Benefits:
 * - Eliminates code duplication across strategies
 * - Centralized logging
 * - Easy to add new patterns
 * - Consistent confidence boosts
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
exports.PatternAnalyzerHelper = void 0;
var types_1 = require("../types");
var chart_patterns_detector_1 = require("./chart-patterns.detector");
var engulfing_pattern_detector_1 = require("./engulfing-pattern.detector");
var triple_pattern_detector_1 = require("./triple-pattern.detector");
var triangle_pattern_detector_1 = require("./triangle-pattern.detector");
var wedge_pattern_detector_1 = require("./wedge-pattern.detector");
var flag_pattern_detector_1 = require("./flag-pattern.detector");
// ============================================================================
// DEFAULT CONFIG
// ============================================================================
var DEFAULT_CONFIG = {
    enableChartPatterns: false,
    enableEngulfingPattern: false,
    enableTriplePattern: false,
    enableTrianglePattern: false,
    enableWedgePattern: false,
    enableFlagPattern: false,
    chartPatternBoost: 0.15,
    engulfingBoost: 0.10,
    tripleBoost: 0.15,
    triangleBoost: 0.10,
    wedgeBoost: 0.10,
    flagBoost: 0.15,
};
// ============================================================================
// PATTERN ANALYZER HELPER
// ============================================================================
var PatternAnalyzerHelper = /** @class */ (function () {
    function PatternAnalyzerHelper(config, logger, strategyName) {
        this.logger = logger;
        this.strategyName = strategyName;
        this.chartPatternsDetector = null;
        this.engulfingPatternDetector = null;
        this.triplePatternDetector = null;
        this.trianglePatternDetector = null;
        this.wedgePatternDetector = null;
        this.flagPatternDetector = null;
        // Merge with defaults
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
        // Initialize enabled detectors
        if (this.config.enableChartPatterns) {
            this.chartPatternsDetector = new chart_patterns_detector_1.ChartPatternsDetector(logger);
            this.logger.info("\uD83D\uDCCA Chart Patterns Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
        if (this.config.enableEngulfingPattern) {
            this.engulfingPatternDetector = new engulfing_pattern_detector_1.EngulfingPatternDetector(logger);
            this.logger.info("\uD83D\uDD6F\uFE0F Engulfing Pattern Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
        if (this.config.enableTriplePattern) {
            this.triplePatternDetector = new triple_pattern_detector_1.TriplePatternDetector(logger);
            this.logger.info("\uD83D\uDD3A Triple Pattern Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
        if (this.config.enableTrianglePattern) {
            this.trianglePatternDetector = new triangle_pattern_detector_1.TrianglePatternDetector(logger);
            this.logger.info("\uD83D\uDD3A Triangle Pattern Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
        if (this.config.enableWedgePattern) {
            this.wedgePatternDetector = new wedge_pattern_detector_1.WedgePatternDetector(logger);
            this.logger.info("\uD83D\uDCD0 Wedge Pattern Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
        if (this.config.enableFlagPattern) {
            this.flagPatternDetector = new flag_pattern_detector_1.FlagPatternDetector(logger);
            this.logger.info("\uD83D\uDEA9 Flag Pattern Detector enabled".concat(this.strategyName ? " for ".concat(this.strategyName) : ''));
        }
    }
    /**
     * Analyze all enabled patterns and return confidence boost + reason additions
     *
     * @param input - Pattern analysis input data
     * @returns Pattern analysis result with confidence boost and reason additions
     */
    PatternAnalyzerHelper.prototype.analyzePatterns = function (input) {
        var confidenceBoost = 0;
        var reasonParts = [];
        var patternsDetected = [];
        var candles = input.candles, swingPoints = input.swingPoints, direction = input.direction, trend = input.trend, strategyName = input.strategyName;
        // ========================================================================
        // 1. Chart Patterns (Head & Shoulders, Double Top/Bottom)
        // ========================================================================
        if (this.chartPatternsDetector && swingPoints.length >= 3) {
            var pattern = this.chartPatternsDetector.detect(swingPoints);
            if (pattern.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && pattern.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && pattern.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.chartPatternBoost;
                    patternsDetected.push(pattern.type);
                    reasonParts.push(pattern.type);
                    this.logger.info("\uD83D\uDCCA ".concat(strategyName, " Chart Pattern Detected!"), {
                        pattern: pattern.type,
                        direction: pattern.direction,
                        patternConfidence: pattern.confidence.toFixed(1) + '%',
                        boost: "+".concat((this.config.chartPatternBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Chart pattern detected but direction mismatch"), {
                        pattern: pattern.type,
                        patternDirection: pattern.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // 2. Engulfing Pattern
        // ========================================================================
        if (this.engulfingPatternDetector && candles.length >= 2) {
            var engulfing = this.engulfingPatternDetector.detect(candles);
            if (engulfing.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && engulfing.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && engulfing.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.engulfingBoost;
                    patternsDetected.push(engulfing.type);
                    reasonParts.push(engulfing.type);
                    this.logger.info("\uD83D\uDD6F\uFE0F ".concat(strategyName, " Engulfing Pattern Detected!"), {
                        pattern: engulfing.type,
                        direction: engulfing.direction,
                        engulfingRatio: engulfing.engulfingRatio.toFixed(2) + 'x',
                        patternConfidence: engulfing.confidence.toFixed(1) + '%',
                        boost: "+".concat((this.config.engulfingBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Engulfing pattern detected but direction mismatch"), {
                        pattern: engulfing.type,
                        engulfingDirection: engulfing.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // 3. Triple Pattern (Triple Top/Bottom)
        // ========================================================================
        if (this.triplePatternDetector && swingPoints.length >= 5) {
            var triple = this.triplePatternDetector.detect(swingPoints);
            if (triple.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && triple.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && triple.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.tripleBoost;
                    patternsDetected.push(triple.type);
                    reasonParts.push(triple.type);
                    this.logger.info("\uD83D\uDD3A ".concat(strategyName, " Triple Pattern Detected!"), {
                        pattern: triple.type,
                        direction: triple.direction,
                        patternConfidence: triple.confidence.toFixed(1) + '%',
                        neckline: triple.neckline.toFixed(4),
                        boost: "+".concat((this.config.tripleBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Triple pattern detected but direction mismatch"), {
                        pattern: triple.type,
                        tripleDirection: triple.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // 4. Triangle Pattern (Ascending/Descending/Symmetrical)
        // ========================================================================
        if (this.trianglePatternDetector && swingPoints.length >= 6) {
            var triangle = this.trianglePatternDetector.detect(swingPoints, trend);
            if (triangle.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && triangle.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && triangle.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.triangleBoost;
                    patternsDetected.push(triangle.type);
                    reasonParts.push(triangle.type);
                    this.logger.info("\uD83D\uDD3A ".concat(strategyName, " Triangle Pattern Detected!"), {
                        pattern: triangle.type,
                        direction: triangle.direction,
                        patternConfidence: triangle.confidence.toFixed(1) + '%',
                        apex: triangle.apex.toFixed(4),
                        target: triangle.target.toFixed(4),
                        boost: "+".concat((this.config.triangleBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Triangle pattern detected but direction mismatch"), {
                        pattern: triangle.type,
                        triangleDirection: triangle.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // 5. Wedge Pattern (Rising/Falling)
        // ========================================================================
        if (this.wedgePatternDetector && swingPoints.length >= 6) {
            var wedge = this.wedgePatternDetector.detect(swingPoints, trend);
            if (wedge.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && wedge.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && wedge.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.wedgeBoost;
                    patternsDetected.push(wedge.type);
                    reasonParts.push(wedge.type);
                    this.logger.info("\uD83D\uDCD0 ".concat(strategyName, " Wedge Pattern Detected!"), {
                        pattern: wedge.type,
                        direction: wedge.direction,
                        patternConfidence: wedge.confidence.toFixed(1) + '%',
                        apex: wedge.apex.toFixed(4),
                        target: wedge.target.toFixed(4),
                        boost: "+".concat((this.config.wedgeBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Wedge pattern detected but direction mismatch"), {
                        pattern: wedge.type,
                        wedgeDirection: wedge.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // 6. Flag Pattern (Bull/Bear Flag - continuation pattern)
        // ========================================================================
        if (this.flagPatternDetector && swingPoints.length >= 6) {
            var flag = this.flagPatternDetector.detect(swingPoints);
            if (flag.detected) {
                var directionMatch = (direction === types_1.SignalDirection.LONG && flag.direction === 'LONG') ||
                    (direction === types_1.SignalDirection.SHORT && flag.direction === 'SHORT');
                if (directionMatch) {
                    confidenceBoost += this.config.flagBoost;
                    patternsDetected.push(flag.type);
                    reasonParts.push(flag.type);
                    this.logger.info("\uD83D\uDEA9 ".concat(strategyName, " Flag Pattern Detected!"), {
                        pattern: flag.type,
                        direction: flag.direction,
                        patternConfidence: flag.confidence.toFixed(1) + '%',
                        poleHeight: flag.poleHeight.toFixed(4),
                        target: flag.target.toFixed(4),
                        boost: "+".concat((this.config.flagBoost * 100).toFixed(0), "%"),
                    });
                }
                else {
                    this.logger.debug("\u26A0\uFE0F ".concat(strategyName, " Flag pattern detected but direction mismatch"), {
                        pattern: flag.type,
                        flagDirection: flag.direction,
                        signalDirection: direction,
                    });
                }
            }
        }
        // ========================================================================
        // Return Result
        // ========================================================================
        var reasonAdditions = reasonParts.length > 0 ? ' + ' + reasonParts.join(' + ') : '';
        if (patternsDetected.length > 0) {
            this.logger.info("\u2728 ".concat(strategyName, " Pattern Analysis Complete"), {
                patternsDetected: patternsDetected.join(', '),
                totalBoost: "+".concat((confidenceBoost * 100).toFixed(0), "%"),
            });
        }
        return {
            confidenceBoost: confidenceBoost,
            reasonAdditions: reasonAdditions,
            patternsDetected: patternsDetected,
        };
    };
    /**
     * Check if any patterns are enabled
     */
    PatternAnalyzerHelper.prototype.hasEnabledPatterns = function () {
        return (this.config.enableChartPatterns === true ||
            this.config.enableEngulfingPattern === true ||
            this.config.enableTriplePattern === true ||
            this.config.enableTrianglePattern === true ||
            this.config.enableWedgePattern === true ||
            this.config.enableFlagPattern === true);
    };
    return PatternAnalyzerHelper;
}());
exports.PatternAnalyzerHelper = PatternAnalyzerHelper;
