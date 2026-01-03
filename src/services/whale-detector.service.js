"use strict";
/**
 * Whale Detector Service - Combined Approach
 *
 * Detects whale activity using 3 modes:
 *
 * MODE 1: WALL_BREAK (пробой стены)
 * - Detects when price breaks through a large wall
 * - High momentum signal (stop-losses triggered)
 * - Entry: After break, on pullback
 *
 * MODE 2: WALL_DISAPPEARANCE (исчезновение стены)
 * - Tracks walls that suddenly disappear
 * - Indicates whale completed accumulation/distribution
 * - Entry: After wall removed (whale done = reversal)
 *
 * MODE 3: IMBALANCE_SPIKE (резкий дисбаланс)
 * - Detects sudden bid/ask imbalance shifts
 * - Indicates large player entering market
 * - Entry: Ride the momentum (highest priority)
 *
 * IMPORTANT: Requires WebSocket orderbook for real-time data
 * REST API polling is too slow for whale detection!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhaleDetectorService = exports.WhaleDetectionMode = void 0;
var types_1 = require("../types");
// ============================================================================
// TYPES
// ============================================================================
var WhaleDetectionMode;
(function (WhaleDetectionMode) {
    WhaleDetectionMode["WALL_BREAK"] = "WALL_BREAK";
    WhaleDetectionMode["WALL_DISAPPEARANCE"] = "WALL_DISAPPEARANCE";
    WhaleDetectionMode["IMBALANCE_SPIKE"] = "IMBALANCE_SPIKE";
})(WhaleDetectionMode || (exports.WhaleDetectionMode = WhaleDetectionMode = {}));
// ============================================================================
// WHALE DETECTOR SERVICE
// ============================================================================
var WhaleDetectorService = /** @class */ (function () {
    function WhaleDetectorService(config, logger) {
        this.config = config;
        this.logger = logger;
        // Mode 1: Wall tracking (for breaks and disappearances)
        this.trackedBidWalls = new Map();
        this.trackedAskWalls = new Map();
        // Mode 2: Recently broken walls (to avoid re-detecting same break)
        this.recentlyBrokenWalls = new Set(); // "BID_1.5000" or "ASK_1.5200"
        // Mode 3: Imbalance history (for spike detection)
        this.imbalanceHistory = [];
        this.MAX_IMBALANCE_HISTORY = 20;
    }
    /**
     * Detect whale activity from order book analysis
     *
     * @param analysis - Current order book analysis
     * @param currentPrice - Current market price
     * @param btcMomentum - BTC momentum (0-1, from BTCAnalysis)
     * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL')
     * @returns Whale signal (detected or not)
     */
    WhaleDetectorService.prototype.detectWhale = function (analysis, currentPrice, btcMomentum, btcDirection) {
        // Update tracked data
        this.updateTrackedWalls(analysis);
        this.updateImbalanceHistory(analysis);
        this.cleanupExpiredData();
        // Log current orderbook state (every 10th call to avoid spam)
        if (Math.random() < 0.1) {
            this.logger.debug('🐋 Whale Detector State', {
                trackedBids: this.trackedBidWalls.size,
                trackedAsks: this.trackedAskWalls.size,
                imbalanceHistory: this.imbalanceHistory.length,
                currentRatio: analysis.imbalance.ratio.toFixed(2),
                walls: analysis.walls.length,
                btcMomentum: btcMomentum === null || btcMomentum === void 0 ? void 0 : btcMomentum.toFixed(2),
                btcDirection: btcDirection,
            });
        }
        // MODE 3: Imbalance Spike (highest priority - immediate action)
        if (this.config.modes.imbalanceSpike.enabled) {
            var spikeSignal = this.detectImbalanceSpike(analysis);
            if (spikeSignal.detected) {
                this.logWhaleDetection(spikeSignal);
                return spikeSignal;
            }
        }
        // MODE 1: Wall Break (medium priority - momentum play)
        if (this.config.modes.wallBreak.enabled) {
            var breakSignal = this.detectWallBreak(currentPrice);
            if (breakSignal.detected) {
                this.logWhaleDetection(breakSignal);
                return breakSignal;
            }
        }
        // MODE 2: Wall Disappearance (lower priority - reversal play)
        if (this.config.modes.wallDisappearance.enabled) {
            var disappearanceSignal = this.detectWallDisappearance(btcMomentum, btcDirection);
            if (disappearanceSignal.detected) {
                this.logWhaleDetection(disappearanceSignal);
                return disappearanceSignal;
            }
        }
        // No whale detected - log summary (every 20th call)
        if (Math.random() < 0.05) {
            this.logger.debug('🐋 No whale activity', {
                wallsDetected: analysis.walls.length,
                imbalanceRatio: analysis.imbalance.ratio.toFixed(2),
                imbalanceDirection: analysis.imbalance.direction,
            });
        }
        return {
            detected: false,
            mode: null,
            direction: null,
            confidence: 0,
            reason: 'No whale activity detected',
            metadata: {},
        };
    };
    // ==========================================================================
    // MODE 1: WALL BREAK DETECTION
    // ==========================================================================
    /**
     * Detect when price breaks through a large wall
     *
     * Logic:
     * - BID wall broken (price went below) → SHORT signal (momentum down)
     * - ASK wall broken (price went above) → LONG signal (momentum up)
     */
    WhaleDetectorService.prototype.detectWallBreak = function (currentPrice) {
        var now = Date.now();
        var confirmationMs = this.config.modes.wallBreak.breakConfirmationMs;
        // Check if any BID walls were broken (price dropped below)
        for (var _i = 0, _a = this.trackedBidWalls.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], wallPrice = _b[0], wall = _b[1];
            // Check if wall is significant
            if (wall.percentOfTotal < this.config.modes.wallBreak.minWallSize) {
                continue;
            }
            // Check if price is now BELOW the wall
            if (currentPrice < wallPrice) {
                // Check if wall was broken recently (not just now)
                var timeSinceLastSeen = now - wall.lastSeenAt;
                if (timeSinceLastSeen < confirmationMs) {
                    continue; // Too soon, wait for confirmation
                }
                // Check if we already detected this break
                var wallKey = "BID_".concat(wallPrice.toFixed(4));
                if (this.recentlyBrokenWalls.has(wallKey)) {
                    continue; // Already detected
                }
                // WALL BREAK DETECTED - BID wall broken → LONG signal
                // Logic: BID wall absorbed selling pressure → buyers push price UP
                this.recentlyBrokenWalls.add(wallKey);
                this.trackedBidWalls.delete(wallPrice);
                return {
                    detected: true,
                    mode: WhaleDetectionMode.WALL_BREAK,
                    direction: types_1.SignalDirection.LONG,
                    confidence: this.calculateBreakConfidence(wall),
                    reason: "BID wall BROKEN @ ".concat(wallPrice.toFixed(4), " (").concat(wall.percentOfTotal.toFixed(1), "% volume) - Momentum UP"),
                    metadata: {
                        wall: wall,
                        breakPrice: currentPrice,
                    },
                };
            }
        }
        // Check if any ASK walls were broken (price rose above)
        for (var _c = 0, _d = this.trackedAskWalls.entries(); _c < _d.length; _c++) {
            var _e = _d[_c], wallPrice = _e[0], wall = _e[1];
            // Check if wall is significant
            if (wall.percentOfTotal < this.config.modes.wallBreak.minWallSize) {
                continue;
            }
            // Check if price is now ABOVE the wall
            if (currentPrice > wallPrice) {
                // Check if wall was broken recently (not just now)
                var timeSinceLastSeen = now - wall.lastSeenAt;
                if (timeSinceLastSeen < confirmationMs) {
                    continue; // Too soon, wait for confirmation
                }
                // Check if we already detected this break
                var wallKey = "ASK_".concat(wallPrice.toFixed(4));
                if (this.recentlyBrokenWalls.has(wallKey)) {
                    continue; // Already detected
                }
                // WALL BREAK DETECTED - ASK wall broken → SHORT signal
                // Logic: ASK wall absorbed buying pressure → sellers push price DOWN
                this.recentlyBrokenWalls.add(wallKey);
                this.trackedAskWalls.delete(wallPrice);
                return {
                    detected: true,
                    mode: WhaleDetectionMode.WALL_BREAK,
                    direction: types_1.SignalDirection.SHORT,
                    confidence: this.calculateBreakConfidence(wall),
                    reason: "ASK wall BROKEN @ ".concat(wallPrice.toFixed(4), " (").concat(wall.percentOfTotal.toFixed(1), "% volume) - Momentum DOWN"),
                    metadata: {
                        wall: wall,
                        breakPrice: currentPrice,
                    },
                };
            }
        }
        return { detected: false, mode: null, direction: null, confidence: 0, reason: '', metadata: {} };
    };
    // ==========================================================================
    // MODE 2: WALL DISAPPEARANCE DETECTION
    // ==========================================================================
    /**
     * Detect when a large wall suddenly disappears
     *
     * DEFAULT Logic (neutral market):
     * - BID wall disappears → whale done accumulating → SHORT signal (distribution next)
     * - ASK wall disappears → whale done distributing → LONG signal (accumulation next)
     *
     * TREND-AWARE Logic (strong trend):
     * - In BEARISH market (BTC down): BID disappears → SHORT continuation (whales not buying = more drop)
     * - In BULLISH market (BTC up): ASK disappears → LONG continuation (whales not selling = more pump)
     * - Logic is INVERTED in strong trends to trade WITH the trend!
     *
     * @param btcMomentum - BTC momentum (0-1, undefined if not available)
     * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL', undefined if not available)
     */
    WhaleDetectorService.prototype.detectWallDisappearance = function (btcMomentum, btcDirection) {
        var now = Date.now();
        var WALL_GONE_THRESHOLD = 15000; // 15 seconds without seeing wall = gone
        // Check BID walls that disappeared
        for (var _i = 0, _a = this.trackedBidWalls.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], wallPrice = _b[0], wall = _b[1];
            // Check if wall is significant
            if (wall.percentOfTotal < this.config.modes.wallDisappearance.minWallSize) {
                continue;
            }
            // Check if wall existed long enough
            var wallLifetime = wall.lastSeenAt - wall.detectedAt;
            if (wallLifetime < this.config.modes.wallDisappearance.minWallDuration) {
                continue;
            }
            // Check if wall disappeared (not seen recently)
            var timeSinceLastSeen = now - wall.lastSeenAt;
            if (timeSinceLastSeen > WALL_GONE_THRESHOLD) {
                // WALL DISAPPEARED - BID wall gone
                this.trackedBidWalls.delete(wallPrice);
                // Determine signal direction based on market trend
                var _c = this.determineWallDisappearanceDirection('BID', wallPrice, wallLifetime, btcMomentum, btcDirection), direction = _c.direction, reason = _c.reason, trendInverted = _c.trendInverted;
                if (!direction) {
                    // Signal blocked by trend filter
                    continue;
                }
                return {
                    detected: true,
                    mode: WhaleDetectionMode.WALL_DISAPPEARANCE,
                    direction: direction,
                    confidence: this.calculateDisappearanceConfidence(wall, wallLifetime),
                    reason: reason,
                    metadata: {
                        wall: wall,
                        trendInverted: trendInverted,
                    },
                };
            }
        }
        // Check ASK walls that disappeared
        for (var _d = 0, _e = this.trackedAskWalls.entries(); _d < _e.length; _d++) {
            var _f = _e[_d], wallPrice = _f[0], wall = _f[1];
            // Check if wall is significant
            if (wall.percentOfTotal < this.config.modes.wallDisappearance.minWallSize) {
                continue;
            }
            // Check if wall existed long enough
            var wallLifetime = wall.lastSeenAt - wall.detectedAt;
            if (wallLifetime < this.config.modes.wallDisappearance.minWallDuration) {
                continue;
            }
            // Check if wall disappeared (not seen recently)
            var timeSinceLastSeen = now - wall.lastSeenAt;
            if (timeSinceLastSeen > WALL_GONE_THRESHOLD) {
                // WALL DISAPPEARED - ASK wall gone
                this.trackedAskWalls.delete(wallPrice);
                // Determine signal direction based on market trend
                var _g = this.determineWallDisappearanceDirection('ASK', wallPrice, wallLifetime, btcMomentum, btcDirection), direction = _g.direction, reason = _g.reason, trendInverted = _g.trendInverted;
                if (!direction) {
                    // Signal blocked by trend filter
                    continue;
                }
                return {
                    detected: true,
                    mode: WhaleDetectionMode.WALL_DISAPPEARANCE,
                    direction: direction,
                    confidence: this.calculateDisappearanceConfidence(wall, wallLifetime),
                    reason: reason,
                    metadata: {
                        wall: wall,
                        trendInverted: trendInverted,
                    },
                };
            }
        }
        return { detected: false, mode: null, direction: null, confidence: 0, reason: '', metadata: {} };
    };
    // ==========================================================================
    // MODE 3: IMBALANCE SPIKE DETECTION
    // ==========================================================================
    /**
     * Detect sudden bid/ask imbalance shift
     *
     * Logic:
     * - Sudden increase in bid ratio → LONG signal (buying pressure)
     * - Sudden increase in ask ratio → SHORT signal (selling pressure)
     */
    WhaleDetectorService.prototype.detectImbalanceSpike = function (analysis) {
        if (this.imbalanceHistory.length < 3) {
            return { detected: false, mode: null, direction: null, confidence: 0, reason: '', metadata: {} };
        }
        var currentRatio = analysis.imbalance.ratio;
        var detectionWindow = this.config.modes.imbalanceSpike.detectionWindow;
        var now = Date.now();
        // Get imbalance from N seconds ago
        var historicalSnapshot = this.imbalanceHistory.find(function (snap) { return now - snap.timestamp <= detectionWindow; });
        if (!historicalSnapshot) {
            return { detected: false, mode: null, direction: null, confidence: 0, reason: '', metadata: {} };
        }
        var historicalRatio = historicalSnapshot.ratio;
        var ratioChange = currentRatio / historicalRatio;
        // Check for BULLISH spike (bid ratio increased)
        if (ratioChange >= 1 + this.config.modes.imbalanceSpike.minRatioChange) {
            return {
                detected: true,
                mode: WhaleDetectionMode.IMBALANCE_SPIKE,
                direction: types_1.SignalDirection.LONG,
                confidence: this.calculateSpikeConfidence(ratioChange),
                reason: "BULLISH imbalance SPIKE (ratio: ".concat(historicalRatio.toFixed(2), " \u2192 ").concat(currentRatio.toFixed(2), ", +").concat(((ratioChange - 1) * 100).toFixed(0), "%)"),
                metadata: {
                    imbalanceChange: ratioChange,
                },
            };
        }
        // Check for BEARISH spike (ask ratio increased = bid ratio decreased)
        if (ratioChange <= 1 / (1 + this.config.modes.imbalanceSpike.minRatioChange)) {
            return {
                detected: true,
                mode: WhaleDetectionMode.IMBALANCE_SPIKE,
                direction: types_1.SignalDirection.SHORT,
                confidence: this.calculateSpikeConfidence(1 / ratioChange),
                reason: "BEARISH imbalance SPIKE (ratio: ".concat(historicalRatio.toFixed(2), " \u2192 ").concat(currentRatio.toFixed(2), ", ").concat(((1 - ratioChange) * 100).toFixed(0), "%)"),
                metadata: {
                    imbalanceChange: ratioChange,
                },
            };
        }
        return { detected: false, mode: null, direction: null, confidence: 0, reason: '', metadata: {} };
    };
    // ==========================================================================
    // PRIVATE METHODS - Data Tracking
    // ==========================================================================
    /**
     * Update tracked walls with current order book
     */
    WhaleDetectorService.prototype.updateTrackedWalls = function (analysis) {
        var now = Date.now();
        // Update BID walls
        for (var _i = 0, _a = analysis.walls.filter(function (w) { return w.side === 'BID'; }); _i < _a.length; _i++) {
            var wall = _a[_i];
            var existing = this.trackedBidWalls.get(wall.price);
            if (existing) {
                existing.lastSeenAt = now;
                existing.quantity = wall.quantity;
                existing.percentOfTotal = wall.percentOfTotal;
                existing.distance = wall.distance;
            }
            else {
                this.trackedBidWalls.set(wall.price, {
                    side: wall.side,
                    price: wall.price,
                    quantity: wall.quantity,
                    percentOfTotal: wall.percentOfTotal,
                    distance: wall.distance,
                    detectedAt: now,
                    lastSeenAt: now,
                });
            }
        }
        // Update ASK walls
        for (var _b = 0, _c = analysis.walls.filter(function (w) { return w.side === 'ASK'; }); _b < _c.length; _b++) {
            var wall = _c[_b];
            var existing = this.trackedAskWalls.get(wall.price);
            if (existing) {
                existing.lastSeenAt = now;
                existing.quantity = wall.quantity;
                existing.percentOfTotal = wall.percentOfTotal;
                existing.distance = wall.distance;
            }
            else {
                this.trackedAskWalls.set(wall.price, {
                    side: wall.side,
                    price: wall.price,
                    quantity: wall.quantity,
                    percentOfTotal: wall.percentOfTotal,
                    distance: wall.distance,
                    detectedAt: now,
                    lastSeenAt: now,
                });
            }
        }
    };
    /**
     * Update imbalance history for spike detection
     */
    WhaleDetectorService.prototype.updateImbalanceHistory = function (analysis) {
        var now = Date.now();
        this.imbalanceHistory.push({
            ratio: analysis.imbalance.ratio,
            timestamp: now,
            bidVolume: analysis.imbalance.bidVolume,
            askVolume: analysis.imbalance.askVolume,
        });
        // Keep only recent history
        if (this.imbalanceHistory.length > this.MAX_IMBALANCE_HISTORY) {
            this.imbalanceHistory.shift();
        }
    };
    /**
     * Cleanup expired data
     */
    WhaleDetectorService.prototype.cleanupExpiredData = function () {
        var now = Date.now();
        var WALL_EXPIRY_MS = 60000; // 1 minute
        var BREAK_EXPIRY_MS = 300000; // 5 minutes
        // Remove old walls
        for (var _i = 0, _a = this.trackedBidWalls.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], price = _b[0], wall = _b[1];
            if (now - wall.lastSeenAt > WALL_EXPIRY_MS) {
                this.trackedBidWalls.delete(price);
            }
        }
        for (var _c = 0, _d = this.trackedAskWalls.entries(); _c < _d.length; _c++) {
            var _e = _d[_c], price = _e[0], wall = _e[1];
            if (now - wall.lastSeenAt > WALL_EXPIRY_MS) {
                this.trackedAskWalls.delete(price);
            }
        }
        // Remove old broken walls (allow re-detection after 5 min)
        if (this.recentlyBrokenWalls.size > 100) {
            this.recentlyBrokenWalls.clear(); // Prevent memory leak
        }
    };
    // ==========================================================================
    // PRIVATE METHODS - Trend-Aware Signal Direction
    // ==========================================================================
    /**
     * Determine signal direction for WALL_DISAPPEARANCE based on market trend
     *
     * @param wallSide - Side of wall that disappeared ('BID' or 'ASK')
     * @param wallPrice - Price level of wall
     * @param wallLifetime - How long wall existed (ms)
     * @param btcMomentum - BTC momentum (0-1, undefined if not available)
     * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL', undefined if not available)
     * @returns Object with direction, reason, and whether trend was inverted
     */
    WhaleDetectorService.prototype.determineWallDisappearanceDirection = function (wallSide, wallPrice, wallLifetime, btcMomentum, btcDirection) {
        // Default direction (neutral market logic)
        var defaultDirection = wallSide === 'BID' ? types_1.SignalDirection.SHORT : types_1.SignalDirection.LONG;
        var invertedDirection = wallSide === 'BID' ? types_1.SignalDirection.LONG : types_1.SignalDirection.SHORT;
        // If BTC data not available, use default logic
        if (btcMomentum === undefined || btcDirection === undefined) {
            var reason_1 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - ").concat(wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely');
            return { direction: defaultDirection, reason: reason_1, trendInverted: false };
        }
        // Determine trend strength
        var isStrongTrend = btcMomentum >= 0.5; // Strong trend threshold
        var isNeutralMarket = btcMomentum < 0.3; // Neutral market threshold
        // NEUTRAL MARKET: Use default logic
        if (isNeutralMarket) {
            var reason_2 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - ").concat(wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely', " [NEUTRAL market]");
            return { direction: defaultDirection, reason: reason_2, trendInverted: false };
        }
        // STRONG TREND: Apply trend-aware logic (INVERT direction to trade WITH trend)
        if (isStrongTrend) {
            var isBearishTrend = btcDirection === 'DOWN';
            var isBullishTrend = btcDirection === 'UP';
            // BID wall disappeared in BEARISH market → INVERT to LONG (expect bounce)
            if (wallSide === 'BID' && isBearishTrend) {
                var reason_3 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - BEARISH trend (").concat((btcMomentum * 100).toFixed(0), "%) - Whales not buying = potential SHORT-TERM BOUNCE \u2192 LONG [INVERTED]");
                return { direction: invertedDirection, reason: reason_3, trendInverted: true };
            }
            // ASK wall disappeared in BULLISH market → INVERT to SHORT (expect pullback)
            if (wallSide === 'ASK' && isBullishTrend) {
                var reason_4 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - BULLISH trend (").concat((btcMomentum * 100).toFixed(0), "%) - Whales not selling = potential SHORT-TERM PULLBACK \u2192 SHORT [INVERTED]");
                return { direction: invertedDirection, reason: reason_4, trendInverted: true };
            }
            // BID wall disappeared in BULLISH market → Keep SHORT (continuation)
            if (wallSide === 'BID' && isBullishTrend) {
                var reason_5 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - BULLISH trend (").concat((btcMomentum * 100).toFixed(0), "%) - Whales done accumulating \u2192 continue UP (skip SHORT)");
                // Block this signal (it goes against trend)
                this.logger.debug('⚠️ Wall disappearance signal BLOCKED (against strong trend)', {
                    wallSide: wallSide,
                    btcDirection: btcDirection,
                    btcMomentum: btcMomentum.toFixed(2),
                });
                return { direction: null, reason: reason_5, trendInverted: false };
            }
            // ASK wall disappeared in BEARISH market → Keep LONG (continuation)
            if (wallSide === 'ASK' && isBearishTrend) {
                var reason_6 = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - BEARISH trend (").concat((btcMomentum * 100).toFixed(0), "%) - Whales done distributing \u2192 continue DOWN (skip LONG)");
                // Block this signal (it goes against trend)
                this.logger.debug('⚠️ Wall disappearance signal BLOCKED (against strong trend)', {
                    wallSide: wallSide,
                    btcDirection: btcDirection,
                    btcMomentum: btcMomentum.toFixed(2),
                });
                return { direction: null, reason: reason_6, trendInverted: false };
            }
        }
        // MODERATE TREND (0.3 <= momentum < 0.5): Use default logic with caution
        var reason = "".concat(wallSide, " wall DISAPPEARED @ ").concat(wallPrice.toFixed(4), " (existed ").concat((wallLifetime / 1000).toFixed(0), "s) - ").concat(wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely', " [MODERATE trend, BTC ").concat(btcDirection, "]");
        return { direction: defaultDirection, reason: reason, trendInverted: false };
    };
    // ==========================================================================
    // PRIVATE METHODS - Confidence Calculation
    // ==========================================================================
    /**
     * Calculate confidence for wall break (0-100)
     */
    WhaleDetectorService.prototype.calculateBreakConfidence = function (wall) {
        // Factor: Wall size (bigger = higher confidence)
        var sizeScore = Math.min((wall.percentOfTotal / 15) * 60, 60);
        // Factor: Distance (closer break = higher confidence)
        var distanceScore = Math.max(30 - wall.distance * 5, 10);
        return Math.min(sizeScore + distanceScore, 85); // Max 85%
    };
    /**
     * Calculate confidence for wall disappearance (0-100)
     */
    WhaleDetectorService.prototype.calculateDisappearanceConfidence = function (wall, wallLifetime) {
        // Factor: Wall size
        var sizeScore = Math.min((wall.percentOfTotal / 20) * 50, 50);
        // Factor: Lifetime (longer = higher confidence)
        var lifetimeScore = Math.min((wallLifetime / 120000) * 30, 30); // Max at 2 minutes
        return Math.min(sizeScore + lifetimeScore, 80); // Max 80%
    };
    /**
     * Calculate confidence for imbalance spike (0-100)
     */
    WhaleDetectorService.prototype.calculateSpikeConfidence = function (ratioChange) {
        // Larger spike = higher confidence
        var confidence = Math.min((ratioChange - 1) * 50, 90);
        return confidence;
    };
    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================
    /**
     * Log whale detection
     */
    WhaleDetectorService.prototype.logWhaleDetection = function (signal) {
        this.logger.info("\uD83D\uDC0B WHALE DETECTED [".concat(signal.mode, "]"), {
            direction: signal.direction,
            confidence: "".concat(signal.confidence.toFixed(0), "%"),
            reason: signal.reason,
        });
    };
    /**
     * Get statistics
     */
    WhaleDetectorService.prototype.getStats = function () {
        return {
            trackedWalls: {
                bids: this.trackedBidWalls.size,
                asks: this.trackedAskWalls.size,
            },
            recentBreaks: this.recentlyBrokenWalls.size,
            imbalanceHistory: this.imbalanceHistory.length,
        };
    };
    /**
     * Clear all tracked data
     */
    WhaleDetectorService.prototype.clear = function () {
        this.trackedBidWalls.clear();
        this.trackedAskWalls.clear();
        this.recentlyBrokenWalls.clear();
        this.imbalanceHistory = [];
        this.logger.debug('WhaleDetector data cleared');
    };
    return WhaleDetectorService;
}());
exports.WhaleDetectorService = WhaleDetectorService;
