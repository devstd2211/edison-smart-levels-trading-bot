"use strict";
/**
 * Session Detector Utility
 *
 * Detects current trading session based on UTC time.
 *
 * Trading Sessions (UTC):
 * - Asian: 00:00-08:00 (Tokyo/Sydney)
 * - London: 08:00-16:00 (London open)
 * - NY: 13:00-21:00 (New York open)
 * - Overlap: 13:00-16:00 (London + NY overlap = highest volatility)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionDetector = exports.TradingSession = void 0;
// ============================================================================
// ENUMS
// ============================================================================
var TradingSession;
(function (TradingSession) {
    TradingSession["ASIAN"] = "ASIAN";
    TradingSession["LONDON"] = "LONDON";
    TradingSession["NY"] = "NY";
    TradingSession["OVERLAP"] = "OVERLAP";
})(TradingSession || (exports.TradingSession = TradingSession = {}));
// ============================================================================
// SESSION DETECTOR
// ============================================================================
var SessionDetector = /** @class */ (function () {
    function SessionDetector() {
    }
    /**
     * Get current trading session based on UTC time
     *
     * @param currentTime - Optional timestamp (default: Date.now())
     * @returns Current trading session
     */
    SessionDetector.getCurrentSession = function (currentTime) {
        var now = currentTime ? new Date(currentTime) : new Date();
        var hour = now.getUTCHours();
        // Overlap: 13:00-16:00 UTC (London + NY = highest volatility)
        if (hour >= 13 && hour < 16) {
            return TradingSession.OVERLAP;
        }
        // London: 08:00-16:00 UTC
        if (hour >= 8 && hour < 16) {
            return TradingSession.LONDON;
        }
        // NY: 13:00-21:00 UTC
        if (hour >= 13 && hour < 21) {
            return TradingSession.NY;
        }
        // Asian: 00:00-08:00 UTC (default for all other hours)
        return TradingSession.ASIAN;
    };
    /**
     * Get session name (human-readable)
     *
     * @param session - Trading session
     * @returns Session name
     */
    SessionDetector.getSessionName = function (session) {
        switch (session) {
            case TradingSession.ASIAN:
                return 'Asian Session (Low Volatility)';
            case TradingSession.LONDON:
                return 'London Session (High Volatility)';
            case TradingSession.NY:
                return 'NY Session (High Volatility)';
            case TradingSession.OVERLAP:
                return 'London/NY Overlap (Very High Volatility)';
            default:
                return 'Unknown Session';
        }
    };
    /**
     * Check if current time is in a specific session
     *
     * @param session - Session to check
     * @param currentTime - Optional timestamp (default: Date.now())
     * @returns True if in session
     */
    SessionDetector.isInSession = function (session, currentTime) {
        return this.getCurrentSession(currentTime) === session;
    };
    /**
     * Get session volatility level (1.0 = normal, >1.0 = high)
     *
     * @param session - Trading session
     * @returns Relative volatility level
     */
    SessionDetector.getSessionVolatility = function (session) {
        switch (session) {
            case TradingSession.ASIAN:
                return 1.0; // Normal (low volatility)
            case TradingSession.LONDON:
                return 1.5; // High volatility
            case TradingSession.NY:
                return 1.5; // High volatility
            case TradingSession.OVERLAP:
                return 1.8; // Very high volatility
            default:
                return 1.0;
        }
    };
    /**
     * Apply session-based SL multiplier to stop loss distance
     *
     * @param baseDistance - Base stop loss distance (absolute price distance)
     * @param config - Session-based SL configuration (optional)
     * @param logger - Logger for debug output (optional)
     * @param strategyName - Strategy name for logging (optional)
     * @returns Adjusted stop loss distance
     */
    SessionDetector.applySessionBasedSL = function (baseDistance, config, logger, strategyName) {
        // If config not provided or disabled, return base distance
        if (!config || !config.enabled) {
            return baseDistance;
        }
        // Get current session
        var currentSession = this.getCurrentSession();
        // Get multiplier for current session
        var multiplier = this.getSessionMultiplier(currentSession, config);
        // If multiplier is 1.0, no adjustment needed
        if (multiplier === 1.0) {
            return baseDistance;
        }
        // Apply multiplier
        var adjustedDistance = baseDistance * multiplier;
        // Log if logger provided
        if (logger) {
            logger.debug("\uD83D\uDCCD Session-based SL widening applied".concat(strategyName ? " (".concat(strategyName, ")") : ''), {
                session: currentSession,
                multiplier: multiplier.toFixed(2),
                baseDistance: baseDistance.toFixed(6),
                adjustedDistance: adjustedDistance.toFixed(6),
            });
        }
        return adjustedDistance;
    };
    /**
     * Get session multiplier from config
     *
     * @param session - Trading session
     * @param config - Session-based SL configuration
     * @returns Multiplier for the session
     */
    SessionDetector.getSessionMultiplier = function (session, config) {
        switch (session) {
            case TradingSession.OVERLAP:
                return config.overlapMultiplier;
            case TradingSession.LONDON:
                return config.londonMultiplier;
            case TradingSession.NY:
                return config.nyMultiplier;
            case TradingSession.ASIAN:
                return config.asianMultiplier;
            default:
                return 1.0;
        }
    };
    return SessionDetector;
}());
exports.SessionDetector = SessionDetector;
