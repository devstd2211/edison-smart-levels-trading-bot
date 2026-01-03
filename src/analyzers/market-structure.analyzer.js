"use strict";
/**
 * Market Structure Analyzer
 *
 * Analyzes swing points from ZigZag to identify market structure patterns:
 * - HH (Higher High) - bullish trend
 * - HL (Higher Low) - bullish pullback
 * - LH (Lower High) - bearish pullback
 * - LL (Lower Low) - bearish trend
 * - EH (Equal High) - flat/consolidation
 * - EL (Equal Low) - flat/consolidation
 *
 * This analyzer works with data from ZigZagIndicator and provides
 * structural interpretation for trading strategies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketStructureAnalyzer = void 0;
var types_1 = require("../types");
// ============================================================================
// CONSTANTS
// ============================================================================
var EQUAL_THRESHOLD = 0.001; // 0.1% - threshold for considering prices equal
// ============================================================================
// MARKET STRUCTURE ANALYZER
// ============================================================================
var MarketStructureAnalyzer = /** @class */ (function () {
    function MarketStructureAnalyzer(logger) {
        this.logger = logger;
        this.currentTrend = types_1.TrendBias.NEUTRAL;
        this.lastStructureEvent = null;
    }
    /**
     * Identify market structure by comparing swing points
     *
     * @param highs - Swing high points from ZigZag
     * @param lows - Swing low points from ZigZag
     * @returns Market structure pattern
     */
    MarketStructureAnalyzer.prototype.identifyStructure = function (highs, lows) {
        // Need at least 2 points to identify structure
        if (highs.length < 2 && lows.length < 2) {
            return null;
        }
        // Get recent points
        var recentHighs = highs.slice(-2);
        var recentLows = lows.slice(-2);
        // Determine what structure we can identify
        if (recentHighs.length >= 2) {
            var prev = recentHighs[0], current = recentHighs[1];
            if (this.isHigherHigh(current, prev)) {
                return types_1.MarketStructure.HIGHER_HIGH;
            }
            else if (this.isLowerHigh(current, prev)) {
                return types_1.MarketStructure.LOWER_HIGH;
            }
            else if (this.isEqualHigh(current, prev)) {
                return types_1.MarketStructure.EQUAL_HIGH;
            }
        }
        if (recentLows.length >= 2) {
            var prev = recentLows[0], current = recentLows[1];
            if (this.isHigherLow(current, prev)) {
                return types_1.MarketStructure.HIGHER_LOW;
            }
            else if (this.isLowerLow(current, prev)) {
                return types_1.MarketStructure.LOWER_LOW;
            }
            else if (this.isEqualLow(current, prev)) {
                return types_1.MarketStructure.EQUAL_LOW;
            }
        }
        return null;
    };
    /**
     * Get last pattern (combination of structure)
     *
     * @param highs - Swing high points
     * @param lows - Swing low points
     * @returns Pattern string
     */
    MarketStructureAnalyzer.prototype.getLastPattern = function (highs, lows) {
        // Need at least 2 highs and 2 lows
        if (highs.length < 2 || lows.length < 2) {
            return null;
        }
        var recentHighs = highs.slice(-2);
        var recentLows = lows.slice(-2);
        var prevHigh = recentHighs[0], currentHigh = recentHighs[1];
        var prevLow = recentLows[0], currentLow = recentLows[1];
        // Check for HH_HL (bullish trend)
        var hasHH = this.isHigherHigh(currentHigh, prevHigh);
        var hasHL = this.isHigherLow(currentLow, prevLow);
        if (hasHH && hasHL) {
            return 'HH_HL';
        }
        // Check for LH_LL (bearish trend)
        var hasLH = this.isLowerHigh(currentHigh, prevHigh);
        var hasLL = this.isLowerLow(currentLow, prevLow);
        if (hasLH && hasLL) {
            return 'LH_LL';
        }
        // Check for FLAT
        var hasEH = this.isEqualHigh(currentHigh, prevHigh);
        var hasEL = this.isEqualLow(currentLow, prevLow);
        if (hasEH || hasEL) {
            return 'FLAT';
        }
        // Mixed structure - unclear
        return null;
    };
    /**
     * Get trend bias from structure
     *
     * @param highs - Swing high points
     * @param lows - Swing low points
     * @returns Trend bias
     */
    MarketStructureAnalyzer.prototype.getTrendBias = function (highs, lows) {
        var pattern = this.getLastPattern(highs, lows);
        switch (pattern) {
            case 'HH_HL':
                return types_1.TrendBias.BULLISH;
            case 'LH_LL':
                return types_1.TrendBias.BEARISH;
            case 'FLAT':
                return types_1.TrendBias.NEUTRAL;
            default:
                return types_1.TrendBias.NEUTRAL;
        }
    };
    // ============================================================================
    // PRIVATE METHODS - Structure Identification
    // ============================================================================
    /**
     * Check if current high is higher than previous high
     */
    MarketStructureAnalyzer.prototype.isHigherHigh = function (current, previous) {
        return current.price > previous.price * (1 + EQUAL_THRESHOLD);
    };
    /**
     * Check if current low is higher than previous low
     */
    MarketStructureAnalyzer.prototype.isHigherLow = function (current, previous) {
        return current.price > previous.price * (1 + EQUAL_THRESHOLD);
    };
    /**
     * Check if current high is lower than previous high
     */
    MarketStructureAnalyzer.prototype.isLowerHigh = function (current, previous) {
        return current.price < previous.price * (1 - EQUAL_THRESHOLD);
    };
    /**
     * Check if current low is lower than previous low
     */
    MarketStructureAnalyzer.prototype.isLowerLow = function (current, previous) {
        return current.price < previous.price * (1 - EQUAL_THRESHOLD);
    };
    /**
     * Check if current high is equal to previous high
     */
    MarketStructureAnalyzer.prototype.isEqualHigh = function (current, previous) {
        return (Math.abs(current.price - previous.price) / previous.price <= EQUAL_THRESHOLD);
    };
    /**
     * Check if current low is equal to previous low
     */
    MarketStructureAnalyzer.prototype.isEqualLow = function (current, previous) {
        return (Math.abs(current.price - previous.price) / previous.price <= EQUAL_THRESHOLD);
    };
    // ============================================================================
    // CHoCH/BoS DETECTION
    // ============================================================================
    /**
     * Detect CHoCH (Change of Character) and BoS (Break of Structure) events
     *
     * CHoCH - trend reversal (breaking previous swing)
     * BoS - trend continuation (breaking current swing)
     *
     * @param highs - Swing high points
     * @param lows - Swing low points
     * @param currentPrice - Current market price
     * @param signalDirection - Direction of potential trade signal
     * @returns Detection result with confidence modifier
     */
    MarketStructureAnalyzer.prototype.detectCHoCHBoS = function (highs, lows, currentPrice, signalDirection) {
        // Need at least 2 swing points to detect structure events
        if (highs.length < 2 && lows.length < 2) {
            return {
                hasEvent: false,
                event: null,
                currentTrend: this.currentTrend,
                confidenceModifier: 1.0,
            };
        }
        var newEvent = null;
        // Check for bullish CHoCH/BoS (uptrend events)
        if (highs.length >= 2) {
            var _a = highs.slice(-2), prevHigh = _a[0], currentHigh = _a[1];
            // CHoCH BULLISH: price breaks above previous high during downtrend
            if (this.currentTrend === types_1.TrendBias.BEARISH &&
                currentPrice > prevHigh.price) {
                newEvent = {
                    type: types_1.StructureEventType.CHoCH,
                    direction: types_1.StructureDirection.BULLISH,
                    price: currentPrice,
                    timestamp: Date.now(),
                    strength: this.calculateEventStrength(currentPrice, prevHigh.price, 'break'),
                };
                this.currentTrend = types_1.TrendBias.BULLISH;
                this.logger.debug('CHoCH BULLISH detected', { event: newEvent });
            }
            // BoS BULLISH: price breaks above current high during uptrend
            else if (this.currentTrend === types_1.TrendBias.BULLISH &&
                currentPrice > currentHigh.price) {
                newEvent = {
                    type: types_1.StructureEventType.BoS,
                    direction: types_1.StructureDirection.BULLISH,
                    price: currentPrice,
                    timestamp: Date.now(),
                    strength: this.calculateEventStrength(currentPrice, currentHigh.price, 'break'),
                };
                this.logger.debug('BoS BULLISH detected', { event: newEvent });
            }
        }
        // Check for bearish CHoCH/BoS (downtrend events)
        if (lows.length >= 2 && !newEvent) {
            var _b = lows.slice(-2), prevLow = _b[0], currentLow = _b[1];
            // CHoCH BEARISH: price breaks below previous low during uptrend
            if (this.currentTrend === types_1.TrendBias.BULLISH &&
                currentPrice < prevLow.price) {
                newEvent = {
                    type: types_1.StructureEventType.CHoCH,
                    direction: types_1.StructureDirection.BEARISH,
                    price: currentPrice,
                    timestamp: Date.now(),
                    strength: this.calculateEventStrength(currentPrice, prevLow.price, 'break'),
                };
                this.currentTrend = types_1.TrendBias.BEARISH;
                this.logger.debug('CHoCH BEARISH detected', { event: newEvent });
            }
            // BoS BEARISH: price breaks below current low during downtrend
            else if (this.currentTrend === types_1.TrendBias.BEARISH &&
                currentPrice < currentLow.price) {
                newEvent = {
                    type: types_1.StructureEventType.BoS,
                    direction: types_1.StructureDirection.BEARISH,
                    price: currentPrice,
                    timestamp: Date.now(),
                    strength: this.calculateEventStrength(currentPrice, currentLow.price, 'break'),
                };
                this.logger.debug('BoS BEARISH detected', { event: newEvent });
            }
        }
        // Update last event if new event detected
        if (newEvent) {
            this.lastStructureEvent = newEvent;
        }
        // Calculate confidence modifier based on event alignment with signal
        var confidenceModifier = this.calculateConfidenceModifier(this.lastStructureEvent, signalDirection);
        return {
            hasEvent: newEvent !== null,
            event: newEvent,
            currentTrend: this.currentTrend,
            confidenceModifier: confidenceModifier,
        };
    };
    /**
     * Calculate event strength (0-1) based on break distance
     */
    MarketStructureAnalyzer.prototype.calculateEventStrength = function (currentPrice, brokenLevel, type) {
        var distance = Math.abs(currentPrice - brokenLevel) / brokenLevel;
        // Normalize: 0.1% = 0.1, 1% = 1.0
        return Math.min(distance * 100, 1.0);
    };
    /**
     * Calculate confidence modifier based on CHoCH/BoS alignment with signal
     *
     * From specs:
     * - CHoCH in favor: +30% (+0.3)
     * - CHoCH against: -40 to -50% (-0.4 to -0.5)
     * - BoS in favor: +10% (+0.1)
     * - BoS neutral/against: no penalty
     */
    MarketStructureAnalyzer.prototype.calculateConfidenceModifier = function (event, signalDirection) {
        if (!event || !signalDirection) {
            return 1.0; // No modification
        }
        var isAligned = (signalDirection === 'LONG' && event.direction === types_1.StructureDirection.BULLISH) ||
            (signalDirection === 'SHORT' && event.direction === types_1.StructureDirection.BEARISH);
        var isAgainst = (signalDirection === 'LONG' && event.direction === types_1.StructureDirection.BEARISH) ||
            (signalDirection === 'SHORT' && event.direction === types_1.StructureDirection.BULLISH);
        if (event.type === types_1.StructureEventType.CHoCH) {
            if (isAligned) {
                return 1.3; // +30% boost
            }
            else if (isAgainst) {
                return 0.5; // -50% penalty
            }
        }
        else if (event.type === types_1.StructureEventType.BoS) {
            if (isAligned) {
                return 1.1; // +10% boost
            }
            // BoS against signal: no penalty (trend continuation is less critical)
        }
        return 1.0; // No modification
    };
    /**
     * Get current trend
     */
    MarketStructureAnalyzer.prototype.getCurrentTrend = function () {
        return this.currentTrend;
    };
    /**
     * Get last structure event
     */
    MarketStructureAnalyzer.prototype.getLastStructureEvent = function () {
        return this.lastStructureEvent;
    };
    /**
     * Reset trend tracking (useful for testing)
     */
    MarketStructureAnalyzer.prototype.resetTrend = function () {
        this.currentTrend = types_1.TrendBias.NEUTRAL;
        this.lastStructureEvent = null;
    };
    /**
     * Set current trend (for testing)
     */
    MarketStructureAnalyzer.prototype.setTrend = function (trend) {
        this.currentTrend = trend;
    };
    return MarketStructureAnalyzer;
}());
exports.MarketStructureAnalyzer = MarketStructureAnalyzer;
