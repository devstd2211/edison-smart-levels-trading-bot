"use strict";
/**
 * Flag/Pennant Pattern Detector
 *
 * Detects flag and pennant continuation patterns.
 * Both patterns consist of: strong move (flagpole) + consolidation (flag/pennant).
 *
 * Bull Flag:
 *      |  ___     Strong upward move (pole)
 *      | |   |    + rectangular consolidation (flag)
 *      | |___|    → LONG on break
 *
 * Pennant:
 *      |  /\      Strong move (pole)
 *      | /  \     + triangular consolidation (pennant)
 *      |/____\    → Direction = pole direction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagPatternDetector = exports.FlagPatternType = void 0;
var FlagPatternType;
(function (FlagPatternType) {
    FlagPatternType["BULL_FLAG"] = "BULL_FLAG";
    FlagPatternType["BEAR_FLAG"] = "BEAR_FLAG";
    FlagPatternType["BULL_PENNANT"] = "BULL_PENNANT";
    FlagPatternType["BEAR_PENNANT"] = "BEAR_PENNANT";
    FlagPatternType["NONE"] = "NONE";
})(FlagPatternType || (exports.FlagPatternType = FlagPatternType = {}));
var BASE_CONFIDENCE = 70;
var MIN_POLE_HEIGHT_PERCENT = 2.0; // Pole must be strong (2%+ move)
var MAX_CONSOLIDATION_BARS = 60; // Consolidation should be brief
var MIN_CONSOLIDATION_BARS = 10;
var FlagPatternDetector = /** @class */ (function () {
    function FlagPatternDetector(logger) {
        this.logger = logger;
    }
    FlagPatternDetector.prototype.detect = function (swingPoints) {
        if (swingPoints.length < 6) {
            return this.noPattern('Not enough swing points');
        }
        var recent = swingPoints.slice(-10);
        // Detect flagpole (strong directional move)
        var poleResult = this.detectPole(recent);
        if (!poleResult) {
            return this.noPattern('No strong flagpole detected');
        }
        var direction = poleResult.direction, poleHeight = poleResult.poleHeight, poleStart = poleResult.poleStart, poleEnd = poleResult.poleEnd;
        // Detect consolidation after pole
        var consolidation = recent.slice(recent.indexOf(poleEnd) + 1);
        if (consolidation.length < 3) {
            return this.noPattern('No consolidation after pole');
        }
        var consolidationMinutes = (consolidation[consolidation.length - 1].timestamp - consolidation[0].timestamp) / 60000;
        if (consolidationMinutes < MIN_CONSOLIDATION_BARS || consolidationMinutes > MAX_CONSOLIDATION_BARS) {
            return this.noPattern('Consolidation timespan invalid');
        }
        // Check if consolidation is rectangular (flag) or triangular (pennant)
        var isTriangular = this.isTriangularConsolidation(consolidation);
        var type = direction === 'LONG'
            ? (isTriangular ? FlagPatternType.BULL_PENNANT : FlagPatternType.BULL_FLAG)
            : (isTriangular ? FlagPatternType.BEAR_PENNANT : FlagPatternType.BEAR_FLAG);
        var currentPrice = consolidation[consolidation.length - 1].price;
        var target = direction === 'LONG' ? currentPrice + poleHeight : currentPrice - poleHeight;
        var stopLoss = direction === 'LONG' ? currentPrice - poleHeight * 0.3 : currentPrice + poleHeight * 0.3;
        var confidence = BASE_CONFIDENCE;
        if (poleHeight / poleStart.price > 0.03)
            confidence += 10; // Strong pole bonus
        return {
            detected: true,
            type: type,
            direction: direction,
            confidence: Math.min(100, confidence),
            poleHeight: poleHeight,
            target: target,
            stopLoss: stopLoss,
            consolidationPoints: consolidation,
            explanation: "".concat(type, ": pole ").concat(poleHeight.toFixed(2), ", consolidation ").concat(consolidation.length, " points"),
        };
    };
    FlagPatternDetector.prototype.detectPole = function (points) {
        for (var i = 0; i < points.length - 1; i++) {
            var start = points[i];
            var end = points[i + 1];
            var heightPercent = Math.abs((end.price - start.price) / start.price) * 100;
            if (heightPercent >= MIN_POLE_HEIGHT_PERCENT) {
                return {
                    direction: end.price > start.price ? 'LONG' : 'SHORT',
                    poleHeight: Math.abs(end.price - start.price),
                    poleStart: start,
                    poleEnd: end,
                };
            }
        }
        return null;
    };
    FlagPatternDetector.prototype.isTriangularConsolidation = function (points) {
        if (points.length < 4)
            return false;
        var firstRange = Math.abs(points[1].price - points[0].price);
        var lastRange = Math.abs(points[points.length - 1].price - points[points.length - 2].price);
        return lastRange < firstRange * 0.6; // Range narrowing = triangular
    };
    FlagPatternDetector.prototype.noPattern = function (reason) {
        return {
            detected: false,
            type: FlagPatternType.NONE,
            direction: 'LONG',
            confidence: 0,
            poleHeight: 0,
            target: 0,
            stopLoss: 0,
            consolidationPoints: [],
            explanation: reason,
        };
    };
    return FlagPatternDetector;
}());
exports.FlagPatternDetector = FlagPatternDetector;
