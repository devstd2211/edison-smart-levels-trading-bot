"use strict";
/**
 * Loss Streak Service (PHASE 5)
 *
 * Reduces position size after consecutive losses to limit drawdown.
 *
 * Problem:
 * - Bot continues trading at full size after losses
 * - Can amplify drawdown during bad market conditions
 *
 * Solution: Adaptive Position Sizing
 * - After 1 loss: Normal size (100%)
 * - After 2 losses in a row: Reduce to 75%
 * - After 3 losses in a row: Reduce to 50%
 * - After 4+ losses in a row: Reduce to 25% (or stop)
 * - After 1 win: Reset to normal
 *
 * Features:
 * - Tracks consecutive wins/losses
 * - Progressive size reduction
 * - Optional emergency stop after N losses
 * - Automatic reset after win
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
exports.LossStreakService = void 0;
// ============================================================================
// LOSS STREAK SERVICE
// ============================================================================
var LossStreakService = /** @class */ (function () {
    function LossStreakService(config, logger) {
        this.config = config;
        this.logger = logger;
        this.consecutiveLosses = 0;
        this.consecutiveWins = 0;
    }
    /**
     * Record trade result
     * Call after each trade closes
     *
     * @param isWin - True if trade was profitable, false if loss
     */
    LossStreakService.prototype.recordTrade = function (isWin) {
        if (isWin) {
            this.consecutiveWins++;
            this.consecutiveLosses = 0; // Reset loss streak
            this.logger.info('✅ Win recorded - loss streak reset (PHASE 5)', {
                consecutiveWins: this.consecutiveWins,
                sizeMultiplier: '100%',
            });
        }
        else {
            this.consecutiveLosses++;
            this.consecutiveWins = 0; // Reset win streak
            var multiplier = this.getSizeMultiplier();
            this.logger.warn('❌ Loss recorded (PHASE 5)', {
                consecutiveLosses: this.consecutiveLosses,
                sizeMultiplier: (multiplier * 100).toFixed(0) + '%',
            });
            // Check if need to stop
            if (this.config.stopAfterLosses &&
                this.consecutiveLosses >= this.config.stopAfterLosses) {
                this.logger.error("\u26D4 ".concat(this.config.stopAfterLosses, " consecutive losses - EMERGENCY STOP (PHASE 5)"));
                process.exit(1); // Stop bot
            }
        }
    };
    /**
     * Get current position size multiplier
     * Apply this to calculated position size before opening trade
     *
     * @returns Multiplier (0.25 to 1.0)
     */
    LossStreakService.prototype.getSizeMultiplier = function () {
        if (this.consecutiveLosses >= 4) {
            return this.config.reductions.after4Losses;
        }
        if (this.consecutiveLosses >= 3) {
            return this.config.reductions.after3Losses;
        }
        if (this.consecutiveLosses >= 2) {
            return this.config.reductions.after2Losses;
        }
        return 1.0; // Normal size
    };
    /**
     * Get consecutive losses count
     * @returns Number of consecutive losses
     */
    LossStreakService.prototype.getConsecutiveLosses = function () {
        return this.consecutiveLosses;
    };
    /**
     * Get consecutive wins count
     * @returns Number of consecutive wins
     */
    LossStreakService.prototype.getConsecutiveWins = function () {
        return this.consecutiveWins;
    };
    /**
     * Check if trading should be blocked
     * Returns true if stop limit reached
     *
     * @returns Object with blocked flag and optional reason
     */
    LossStreakService.prototype.canTrade = function () {
        if (this.config.stopAfterLosses &&
            this.consecutiveLosses >= this.config.stopAfterLosses) {
            return {
                allowed: false,
                reason: "".concat(this.consecutiveLosses, " consecutive losses (limit: ").concat(this.config.stopAfterLosses, ")"),
            };
        }
        return { allowed: true };
    };
    /**
     * Manually reset streak (for testing)
     * Should not be used in production
     */
    LossStreakService.prototype.reset = function () {
        this.logger.warn('⚠️ Loss streak manually reset');
        this.consecutiveLosses = 0;
        this.consecutiveWins = 0;
    };
    /**
     * Get config for testing/debugging
     * @returns Deep copy of config
     */
    LossStreakService.prototype.getConfig = function () {
        return __assign(__assign({}, this.config), { reductions: __assign({}, this.config.reductions) });
    };
    return LossStreakService;
}());
exports.LossStreakService = LossStreakService;
