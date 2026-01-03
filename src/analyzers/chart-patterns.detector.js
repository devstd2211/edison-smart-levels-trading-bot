"use strict";
/**
 * Chart Patterns Detector
 *
 * Detects classic chart patterns for improved reversal trading:
 * - Head & Shoulders (bearish reversal)
 * - Inverse Head & Shoulders (bullish reversal)
 * - Double Top/Bottom (reversal patterns)
 *
 * Uses ZigZag swing points to identify pattern structure.
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
exports.ChartPatternsDetector = exports.ChartPatternType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var ChartPatternType;
(function (ChartPatternType) {
    ChartPatternType["HEAD_AND_SHOULDERS"] = "HEAD_AND_SHOULDERS";
    ChartPatternType["INVERSE_HEAD_AND_SHOULDERS"] = "INVERSE_HEAD_AND_SHOULDERS";
    ChartPatternType["DOUBLE_TOP"] = "DOUBLE_TOP";
    ChartPatternType["DOUBLE_BOTTOM"] = "DOUBLE_BOTTOM";
    ChartPatternType["NONE"] = "NONE";
})(ChartPatternType || (exports.ChartPatternType = ChartPatternType = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var DEFAULT_CONFIG = {
    headTolerancePercent: 2.0,
    shoulderTolerancePercent: 3.0,
    necklineTolerancePercent: 2.0,
    minPatternBars: 20,
    maxPatternBars: 100,
};
// ============================================================================
// CHART PATTERNS DETECTOR
// ============================================================================
var ChartPatternsDetector = /** @class */ (function () {
    function ChartPatternsDetector(logger, config) {
        this.logger = logger;
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
    }
    /**
     * Detect all chart patterns from swing points
     * Returns the first detected pattern with highest confidence
     */
    ChartPatternsDetector.prototype.detect = function (swingPoints) {
        if (swingPoints.length < 3) {
            return this.noPattern('Not enough swing points (need 3+ for any pattern)');
        }
        // Try to detect patterns in order of reliability (complex patterns first)
        var headAndShoulders = this.detectHeadAndShoulders(swingPoints);
        if (headAndShoulders.detected) {
            return headAndShoulders;
        }
        var inverseHeadAndShoulders = this.detectInverseHeadAndShoulders(swingPoints);
        if (inverseHeadAndShoulders.detected) {
            return inverseHeadAndShoulders;
        }
        var doubleTop = this.detectDoubleTop(swingPoints);
        if (doubleTop.detected) {
            return doubleTop;
        }
        var doubleBottom = this.detectDoubleBottom(swingPoints);
        if (doubleBottom.detected) {
            return doubleBottom;
        }
        return this.noPattern('No pattern detected');
    };
    // ==========================================================================
    // HEAD & SHOULDERS (Bearish Reversal)
    // ==========================================================================
    /**
     * Detect Head & Shoulders pattern
     *
     * Structure (5 points):
     *      Head (HIGH)
     *     /      \
     *  LS (HIGH)  RS (HIGH)
     *   \          /
     *    LV (LOW)  RV (LOW)  <- Neckline
     *
     * LS = Left Shoulder, LV = Left Valley
     * RS = Right Shoulder, RV = Right Valley
     */
    ChartPatternsDetector.prototype.detectHeadAndShoulders = function (swingPoints) {
        var recent = swingPoints.slice(-10); // Look at last 10 swing points
        // Need at least 5 points: LS, LV, Head, RV, RS
        if (recent.length < 5) {
            return this.noPattern('Not enough points for H&S');
        }
        // Search for pattern: HIGH, LOW, HIGH (head), LOW, HIGH
        for (var i = 0; i <= recent.length - 5; i++) {
            var leftShoulder = recent[i];
            var leftValley = recent[i + 1];
            var head = recent[i + 2];
            var rightValley = recent[i + 3];
            var rightShoulder = recent[i + 4];
            // Validate structure: HIGH -> LOW -> HIGH -> LOW -> HIGH
            if (leftShoulder.type !== types_1.SwingPointType.HIGH ||
                leftValley.type !== types_1.SwingPointType.LOW ||
                head.type !== types_1.SwingPointType.HIGH ||
                rightValley.type !== types_1.SwingPointType.LOW ||
                rightShoulder.type !== types_1.SwingPointType.HIGH) {
                continue;
            }
            // Validate pattern geometry
            var validation = this.validateHeadAndShoulders(leftShoulder, leftValley, head, rightValley, rightShoulder);
            if (validation.valid) {
                var neckline = (leftValley.price + rightValley.price) / 2;
                var patternHeight = head.price - neckline;
                var target = neckline - patternHeight; // Project downward
                var stopLoss = rightShoulder.price + (patternHeight * 0.1); // 10% above RS
                return {
                    type: ChartPatternType.HEAD_AND_SHOULDERS,
                    detected: true,
                    confidence: validation.confidence,
                    neckline: neckline,
                    target: target,
                    stopLoss: stopLoss,
                    direction: 'SHORT',
                    points: [leftShoulder, leftValley, head, rightValley, rightShoulder],
                    explanation: "H&S: Head ".concat(head.price.toFixed(4), ", Shoulders ").concat(leftShoulder.price.toFixed(4), "/").concat(rightShoulder.price.toFixed(4), ", Neckline ").concat(neckline.toFixed(4)),
                };
            }
        }
        return this.noPattern('No valid H&S pattern');
    };
    /**
     * Validate Head & Shoulders geometry
     */
    ChartPatternsDetector.prototype.validateHeadAndShoulders = function (ls, lv, head, rv, rs) {
        var confidence = 100;
        // 1. Head must be higher than both shoulders
        if (head.price <= ls.price || head.price <= rs.price) {
            return { valid: false, confidence: 0 };
        }
        var headVsLeftShoulder = ((head.price - ls.price) / ls.price) * 100;
        var headVsRightShoulder = ((head.price - rs.price) / rs.price) * 100;
        if (headVsLeftShoulder < this.config.headTolerancePercent ||
            headVsRightShoulder < this.config.headTolerancePercent) {
            return { valid: false, confidence: 0 };
        }
        // 2. Shoulders should be approximately at same level (±3%)
        var shoulderDiff = Math.abs((ls.price - rs.price) / ls.price) * 100;
        if (shoulderDiff > this.config.shoulderTolerancePercent) {
            confidence -= 20;
        }
        // 3. Valleys (neckline) should be approximately at same level (±2%)
        var necklineDiff = Math.abs((lv.price - rv.price) / lv.price) * 100;
        if (necklineDiff > this.config.necklineTolerancePercent) {
            confidence -= 20;
        }
        // 4. Check pattern timespan (assuming 1m candles)
        var patternMinutes = (rs.timestamp - ls.timestamp) / 60000;
        if (patternMinutes < this.config.minPatternBars || patternMinutes > this.config.maxPatternBars) {
            confidence -= 10;
        }
        // 5. Symmetry bonus: if shoulders are very close in price
        if (shoulderDiff < 1.0) {
            confidence += 10;
        }
        return { valid: confidence >= 50, confidence: Math.max(0, Math.min(100, confidence)) };
    };
    // ==========================================================================
    // INVERSE HEAD & SHOULDERS (Bullish Reversal)
    // ==========================================================================
    /**
     * Detect Inverse Head & Shoulders pattern
     *
     * Structure (5 points):
     *    LV (HIGH) RV (HIGH)  <- Neckline
     *   /          \
     *  LS (LOW)    RS (LOW)
     *     \      /
     *      Head (LOW)
     */
    ChartPatternsDetector.prototype.detectInverseHeadAndShoulders = function (swingPoints) {
        var recent = swingPoints.slice(-10);
        if (recent.length < 5) {
            return this.noPattern('Not enough points for Inverse H&S');
        }
        // Search for pattern: LOW, HIGH, LOW (head), HIGH, LOW
        for (var i = 0; i <= recent.length - 5; i++) {
            var leftShoulder = recent[i];
            var leftValley = recent[i + 1];
            var head = recent[i + 2];
            var rightValley = recent[i + 3];
            var rightShoulder = recent[i + 4];
            // Validate structure: LOW -> HIGH -> LOW -> HIGH -> LOW
            if (leftShoulder.type !== types_1.SwingPointType.LOW ||
                leftValley.type !== types_1.SwingPointType.HIGH ||
                head.type !== types_1.SwingPointType.LOW ||
                rightValley.type !== types_1.SwingPointType.HIGH ||
                rightShoulder.type !== types_1.SwingPointType.LOW) {
                continue;
            }
            // Validate pattern geometry
            var validation = this.validateInverseHeadAndShoulders(leftShoulder, leftValley, head, rightValley, rightShoulder);
            if (validation.valid) {
                var neckline = (leftValley.price + rightValley.price) / 2;
                var patternHeight = neckline - head.price;
                var target = neckline + patternHeight; // Project upward
                var stopLoss = rightShoulder.price - (patternHeight * 0.1); // 10% below RS
                return {
                    type: ChartPatternType.INVERSE_HEAD_AND_SHOULDERS,
                    detected: true,
                    confidence: validation.confidence,
                    neckline: neckline,
                    target: target,
                    stopLoss: stopLoss,
                    direction: 'LONG',
                    points: [leftShoulder, leftValley, head, rightValley, rightShoulder],
                    explanation: "Inverse H&S: Head ".concat(head.price.toFixed(4), ", Shoulders ").concat(leftShoulder.price.toFixed(4), "/").concat(rightShoulder.price.toFixed(4), ", Neckline ").concat(neckline.toFixed(4)),
                };
            }
        }
        return this.noPattern('No valid Inverse H&S pattern');
    };
    /**
     * Validate Inverse Head & Shoulders geometry
     */
    ChartPatternsDetector.prototype.validateInverseHeadAndShoulders = function (ls, lv, head, rv, rs) {
        var confidence = 100;
        // 1. Head must be lower than both shoulders
        if (head.price >= ls.price || head.price >= rs.price) {
            return { valid: false, confidence: 0 };
        }
        var headVsLeftShoulder = ((ls.price - head.price) / head.price) * 100;
        var headVsRightShoulder = ((rs.price - head.price) / head.price) * 100;
        if (headVsLeftShoulder < this.config.headTolerancePercent ||
            headVsRightShoulder < this.config.headTolerancePercent) {
            return { valid: false, confidence: 0 };
        }
        // 2. Shoulders should be approximately at same level (±3%)
        var shoulderDiff = Math.abs((ls.price - rs.price) / ls.price) * 100;
        if (shoulderDiff > this.config.shoulderTolerancePercent) {
            confidence -= 20;
        }
        // 3. Valleys (neckline) should be approximately at same level (±2%)
        var necklineDiff = Math.abs((lv.price - rv.price) / lv.price) * 100;
        if (necklineDiff > this.config.necklineTolerancePercent) {
            confidence -= 20;
        }
        // 4. Check pattern timespan (assuming 1m candles)
        var patternMinutes = (rs.timestamp - ls.timestamp) / 60000;
        if (patternMinutes < this.config.minPatternBars || patternMinutes > this.config.maxPatternBars) {
            confidence -= 10;
        }
        // 5. Symmetry bonus
        if (shoulderDiff < 1.0) {
            confidence += 10;
        }
        return { valid: confidence >= 50, confidence: Math.max(0, Math.min(100, confidence)) };
    };
    // ==========================================================================
    // DOUBLE TOP (Bearish Reversal)
    // ==========================================================================
    /**
     * Detect Double Top pattern
     *
     * Structure (3 points):
     *  Peak1  Peak2
     *    |      |
     *    |      |
     *     \    /
     *      Valley  <- Neckline
     */
    ChartPatternsDetector.prototype.detectDoubleTop = function (swingPoints) {
        var recent = swingPoints.slice(-6);
        if (recent.length < 3) {
            return this.noPattern('Not enough points for Double Top');
        }
        // Search for pattern: HIGH, LOW, HIGH
        for (var i = 0; i <= recent.length - 3; i++) {
            var peak1 = recent[i];
            var valley = recent[i + 1];
            var peak2 = recent[i + 2];
            // Validate structure: HIGH -> LOW -> HIGH
            if (peak1.type !== types_1.SwingPointType.HIGH ||
                valley.type !== types_1.SwingPointType.LOW ||
                peak2.type !== types_1.SwingPointType.HIGH) {
                continue;
            }
            // Validate: peaks at approximately same level (±2%)
            var peakDiff = Math.abs((peak1.price - peak2.price) / peak1.price) * 100;
            if (peakDiff > this.config.shoulderTolerancePercent) {
                continue;
            }
            var confidence = 100 - peakDiff * 10; // Closer peaks = higher confidence
            var neckline = valley.price;
            var patternHeight = ((peak1.price + peak2.price) / 2) - neckline;
            var target = neckline - patternHeight;
            var stopLoss = Math.max(peak1.price, peak2.price) + (patternHeight * 0.1);
            return {
                type: ChartPatternType.DOUBLE_TOP,
                detected: true,
                confidence: Math.max(50, Math.min(100, confidence)),
                neckline: neckline,
                target: target,
                stopLoss: stopLoss,
                direction: 'SHORT',
                points: [peak1, valley, peak2],
                explanation: "Double Top: Peaks ".concat(peak1.price.toFixed(4), "/").concat(peak2.price.toFixed(4), ", Neckline ").concat(neckline.toFixed(4)),
            };
        }
        return this.noPattern('No valid Double Top pattern');
    };
    // ==========================================================================
    // DOUBLE BOTTOM (Bullish Reversal)
    // ==========================================================================
    /**
     * Detect Double Bottom pattern
     *
     * Structure (3 points):
     *      Peak  <- Neckline
     *     /    \
     *    |      |
     *    |      |
     * Bottom1 Bottom2
     */
    ChartPatternsDetector.prototype.detectDoubleBottom = function (swingPoints) {
        var recent = swingPoints.slice(-6);
        if (recent.length < 3) {
            return this.noPattern('Not enough points for Double Bottom');
        }
        // Search for pattern: LOW, HIGH, LOW
        for (var i = 0; i <= recent.length - 3; i++) {
            var bottom1 = recent[i];
            var peak = recent[i + 1];
            var bottom2 = recent[i + 2];
            // Validate structure: LOW -> HIGH -> LOW
            if (bottom1.type !== types_1.SwingPointType.LOW ||
                peak.type !== types_1.SwingPointType.HIGH ||
                bottom2.type !== types_1.SwingPointType.LOW) {
                continue;
            }
            // Validate: bottoms at approximately same level (±2%)
            var bottomDiff = Math.abs((bottom1.price - bottom2.price) / bottom1.price) * 100;
            if (bottomDiff > this.config.shoulderTolerancePercent) {
                continue;
            }
            var confidence = 100 - bottomDiff * 10;
            var neckline = peak.price;
            var patternHeight = neckline - ((bottom1.price + bottom2.price) / 2);
            var target = neckline + patternHeight;
            var stopLoss = Math.min(bottom1.price, bottom2.price) - (patternHeight * 0.1);
            return {
                type: ChartPatternType.DOUBLE_BOTTOM,
                detected: true,
                confidence: Math.max(50, Math.min(100, confidence)),
                neckline: neckline,
                target: target,
                stopLoss: stopLoss,
                direction: 'LONG',
                points: [bottom1, peak, bottom2],
                explanation: "Double Bottom: Bottoms ".concat(bottom1.price.toFixed(4), "/").concat(bottom2.price.toFixed(4), ", Neckline ").concat(neckline.toFixed(4)),
            };
        }
        return this.noPattern('No valid Double Bottom pattern');
    };
    // ==========================================================================
    // UTILITY
    // ==========================================================================
    ChartPatternsDetector.prototype.noPattern = function (reason) {
        return {
            type: ChartPatternType.NONE,
            detected: false,
            confidence: 0,
            neckline: 0,
            target: 0,
            stopLoss: 0,
            direction: 'LONG',
            points: [],
            explanation: reason,
        };
    };
    return ChartPatternsDetector;
}());
exports.ChartPatternsDetector = ChartPatternsDetector;
