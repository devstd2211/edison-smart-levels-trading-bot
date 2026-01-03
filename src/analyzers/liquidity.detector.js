"use strict";
/**
 * Liquidity Detector
 *
 * Detects liquidity zones (support/resistance levels where stop losses cluster)
 * and liquidity sweeps (false breakouts designed to trigger stops).
 *
 * Key concepts:
 * - Liquidity Zone: Price level with multiple swing points (stops cluster here)
 * - Liquidity Sweep: Price briefly breaks a zone to trigger stops, then reverses
 * - Fakeout: Sweep followed by quick reversal (strong signal)
 *
 * Based on Smart Money Concepts (SMC) and institutional trading patterns.
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
exports.LiquidityDetector = exports.SweepDirection = exports.LiquidityZoneType = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var LiquidityZoneType;
(function (LiquidityZoneType) {
    LiquidityZoneType["SUPPORT"] = "SUPPORT";
    LiquidityZoneType["RESISTANCE"] = "RESISTANCE";
})(LiquidityZoneType || (exports.LiquidityZoneType = LiquidityZoneType = {}));
var SweepDirection;
(function (SweepDirection) {
    SweepDirection["UP"] = "UP";
    SweepDirection["DOWN"] = "DOWN";
})(SweepDirection || (exports.SweepDirection = SweepDirection = {}));
// ============================================================================
// CONSTANTS
// ============================================================================
var PRICE_TOLERANCE_PERCENT = 0.3; // 0.3% - swing points within this range are same zone
var MIN_TOUCHES_FOR_ZONE = 2; // Minimum swing points to form a zone
var STRONG_ZONE_STRENGTH = 0.6; // Strength threshold for "strong" zones
var MAX_ZONE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - zones older than this are ignored
var SWEEP_TOLERANCE_PERCENT = 0.5; // 0.5% - how far beyond zone is a sweep
var FAKEOUT_REVERSAL_PERCENT = 0.3; // 0.3% - reversal needed to confirm fakeout
var RECENT_TOUCHES_WEIGHT = 0.7; // Weight for recent touches in strength calculation
var OLD_TOUCHES_WEIGHT = 0.3; // Weight for old touches
// ============================================================================
// LIQUIDITY DETECTOR
// ============================================================================
var LiquidityDetector = /** @class */ (function () {
    function LiquidityDetector(logger) {
        this.logger = logger;
    }
    /**
     * Detect liquidity zones from swing points
     */
    LiquidityDetector.prototype.detectZones = function (swingPoints, currentTime) {
        var _this = this;
        if (currentTime === void 0) { currentTime = Date.now(); }
        if (swingPoints.length < MIN_TOUCHES_FOR_ZONE) {
            return [];
        }
        // Group swing points by price level (with tolerance)
        var zones = this.groupSwingPointsIntoZones(swingPoints);
        // Calculate strength for each zone
        var zonesWithStrength = zones.map(function (zone) {
            return _this.calculateZoneStrength(zone, currentTime);
        });
        // Filter out weak/old zones
        var validZones = zonesWithStrength.filter(function (zone) {
            return zone.touches >= MIN_TOUCHES_FOR_ZONE &&
                (currentTime - zone.lastTouch) <= MAX_ZONE_AGE_MS;
        });
        // Sort by strength (strongest first)
        validZones.sort(function (a, b) { return b.strength - a.strength; });
        this.logger.debug('Liquidity zones detected', {
            totalZones: validZones.length,
            strongZones: validZones.filter(function (z) { return z.strength >= STRONG_ZONE_STRENGTH; }).length,
        });
        return validZones;
    };
    /**
     * Detect liquidity sweep (false breakout)
     */
    LiquidityDetector.prototype.detectSweep = function (candles, zones, lookbackCandles) {
        if (lookbackCandles === void 0) { lookbackCandles = 10; }
        if (candles.length < 2 || zones.length === 0) {
            return null;
        }
        var recentCandles = candles.slice(-lookbackCandles);
        var latestCandle = candles[candles.length - 1];
        // Check each zone for potential sweep
        for (var _i = 0, zones_1 = zones; _i < zones_1.length; _i++) {
            var zone = zones_1[_i];
            // Check for upward sweep (resistance break)
            if (zone.type === LiquidityZoneType.RESISTANCE) {
                var sweepCandle = this.findSweepCandle(recentCandles, zone.price, true);
                if (sweepCandle) {
                    var isFakeout = this.isFakeout(sweepCandle, latestCandle, zone.price, true);
                    return {
                        detected: true,
                        sweepPrice: sweepCandle.high,
                        zonePrice: zone.price,
                        direction: SweepDirection.UP,
                        isFakeout: isFakeout,
                        strength: this.calculateSweepStrength(zone, isFakeout),
                        timestamp: sweepCandle.timestamp,
                    };
                }
            }
            // Check for downward sweep (support break)
            if (zone.type === LiquidityZoneType.SUPPORT) {
                var sweepCandle = this.findSweepCandle(recentCandles, zone.price, false);
                if (sweepCandle) {
                    var isFakeout = this.isFakeout(sweepCandle, latestCandle, zone.price, false);
                    return {
                        detected: true,
                        sweepPrice: sweepCandle.low,
                        zonePrice: zone.price,
                        direction: SweepDirection.DOWN,
                        isFakeout: isFakeout,
                        strength: this.calculateSweepStrength(zone, isFakeout),
                        timestamp: sweepCandle.timestamp,
                    };
                }
            }
        }
        return null;
    };
    /**
     * Analyze liquidity (zones + sweeps)
     */
    LiquidityDetector.prototype.analyze = function (swingPoints, candles, currentTime) {
        var _a;
        if (currentTime === void 0) { currentTime = Date.now(); }
        var zones = this.detectZones(swingPoints, currentTime);
        var strongZones = zones.filter(function (z) { return z.strength >= STRONG_ZONE_STRENGTH; });
        var recentSweep = this.detectSweep(candles, zones);
        this.logger.debug('Liquidity analysis complete', {
            totalZones: zones.length,
            strongZones: strongZones.length,
            sweepDetected: recentSweep !== null,
            sweepIsFakeout: (_a = recentSweep === null || recentSweep === void 0 ? void 0 : recentSweep.isFakeout) !== null && _a !== void 0 ? _a : false,
        });
        return {
            zones: zones,
            strongZones: strongZones,
            recentSweep: recentSweep,
        };
    };
    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================
    /**
     * Group swing points into zones based on price proximity
     */
    LiquidityDetector.prototype.groupSwingPointsIntoZones = function (swingPoints) {
        var _this = this;
        var zones = [];
        var _loop_1 = function (point) {
            // Find existing zone within tolerance
            var existingZone = zones.find(function (zone) {
                return _this.isPriceInZone(point.price, zone.price);
            });
            if (existingZone) {
                // Add to existing zone
                existingZone.swingPoints.push(point);
                existingZone.touches++;
                existingZone.lastTouch = Math.max(existingZone.lastTouch, point.timestamp);
                // Update zone price to average
                existingZone.price = this_1.calculateAveragePrice(existingZone.swingPoints);
            }
            else {
                // Create new zone
                zones.push({
                    price: point.price,
                    type: point.type === types_1.SwingPointType.HIGH ? LiquidityZoneType.RESISTANCE : LiquidityZoneType.SUPPORT,
                    touches: 1,
                    strength: 0, // Will be calculated later
                    lastTouch: point.timestamp,
                    swingPoints: [point],
                });
            }
        };
        var this_1 = this;
        for (var _i = 0, swingPoints_1 = swingPoints; _i < swingPoints_1.length; _i++) {
            var point = swingPoints_1[_i];
            _loop_1(point);
        }
        return zones;
    };
    /**
     * Check if price is within zone tolerance
     */
    LiquidityDetector.prototype.isPriceInZone = function (price, zonePrice) {
        var tolerance = zonePrice * (PRICE_TOLERANCE_PERCENT / 100);
        return Math.abs(price - zonePrice) <= tolerance;
    };
    /**
     * Calculate average price from swing points
     */
    LiquidityDetector.prototype.calculateAveragePrice = function (swingPoints) {
        var sum = swingPoints.reduce(function (acc, point) { return acc + point.price; }, 0);
        return sum / swingPoints.length;
    };
    /**
     * Calculate zone strength (0-1)
     */
    LiquidityDetector.prototype.calculateZoneStrength = function (zone, currentTime) {
        // Factor 1: Number of touches (more = stronger)
        var touchScore = Math.min(zone.touches / 5, 1); // Cap at 5 touches = 1.0
        // Factor 2: Recency (newer = stronger)
        var ageMs = currentTime - zone.lastTouch;
        var recencyScore = Math.max(0, 1 - (ageMs / MAX_ZONE_AGE_MS));
        // Combine factors
        var strength = (touchScore * RECENT_TOUCHES_WEIGHT) + (recencyScore * OLD_TOUCHES_WEIGHT);
        return __assign(__assign({}, zone), { strength: Math.min(Math.max(strength, 0), 1) });
    };
    /**
     * Find candle that swept a zone
     */
    LiquidityDetector.prototype.findSweepCandle = function (candles, zonePrice, isUpwardSweep) {
        var sweepThreshold = zonePrice * (1 + (isUpwardSweep ? 1 : -1) * SWEEP_TOLERANCE_PERCENT / 100);
        for (var i = candles.length - 1; i >= 0; i--) {
            var candle = candles[i];
            if (isUpwardSweep) {
                // Upward sweep: high breaks above resistance
                if (candle.high >= sweepThreshold) {
                    return candle;
                }
            }
            else {
                // Downward sweep: low breaks below support
                if (candle.low <= sweepThreshold) {
                    return candle;
                }
            }
        }
        return null;
    };
    /**
     * Check if sweep is a fakeout (reversal after break)
     */
    LiquidityDetector.prototype.isFakeout = function (sweepCandle, latestCandle, zonePrice, isUpwardSweep) {
        var reversalThreshold = zonePrice * (FAKEOUT_REVERSAL_PERCENT / 100);
        if (isUpwardSweep) {
            // Upward sweep fakeout: price broke up but now closed back below zone
            return latestCandle.close < (zonePrice - reversalThreshold);
        }
        else {
            // Downward sweep fakeout: price broke down but now closed back above zone
            return latestCandle.close > (zonePrice + reversalThreshold);
        }
    };
    /**
     * Calculate sweep strength (0-1)
     */
    LiquidityDetector.prototype.calculateSweepStrength = function (zone, isFakeout) {
        // Base strength from zone strength
        var strength = zone.strength;
        // Boost if fakeout (strong reversal signal)
        if (isFakeout) {
            strength = Math.min(strength * 1.5, 1.0); // 50% boost, capped at 1.0
        }
        return strength;
    };
    return LiquidityDetector;
}());
exports.LiquidityDetector = LiquidityDetector;
