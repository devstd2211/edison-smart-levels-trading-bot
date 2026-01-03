"use strict";
/**
 * Daily Limits Service (PHASE 5)
 *
 * Protects capital by stopping trading after hitting daily loss limit or profit target.
 *
 * Features:
 * - Daily loss limit (e.g., -5% of starting balance)
 * - Daily profit target (optional, e.g., +5% of starting balance)
 * - Automatic reset at specified UTC time
 * - Emergency stop option (completely halt bot)
 *
 * Usage:
 * 1. Initialize with starting balance at bot startup
 * 2. Call onTradeClose() after each trade closes
 * 3. Check canTrade() before opening new positions
 * 4. System automatically resets stats on new day
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
exports.DailyLimitsService = void 0;
// ============================================================================
// DAILY LIMITS SERVICE
// ============================================================================
var DailyLimitsService = /** @class */ (function () {
    function DailyLimitsService(config, logger) {
        this.config = config;
        this.logger = logger;
        this.stats = this.initStats();
    }
    /**
     * Initialize daily stats
     * @returns New DailyStats object for today
     */
    DailyLimitsService.prototype.initStats = function () {
        var today = new Date().toISOString().split('T')[0];
        return {
            date: today,
            startingBalance: 0, // Will be set via setStartingBalance()
            currentBalance: 0,
            realizedPnL: 0,
            maxLossHit: false,
            maxProfitHit: false,
            tradesCount: 0,
            lastResetTime: Date.now(),
        };
    };
    /**
     * Set starting balance for the day
     * Should be called once at bot startup
     *
     * @param balance - Current account balance
     */
    DailyLimitsService.prototype.setStartingBalance = function (balance) {
        this.stats.startingBalance = balance;
        this.stats.currentBalance = balance;
        this.logger.info('📊 Daily limits initialized (PHASE 5)', {
            date: this.stats.date,
            startingBalance: balance.toFixed(2),
            maxLoss: "-".concat(this.config.maxDailyLossPercent, "%"),
            maxProfit: this.config.maxDailyProfitPercent
                ? "+".concat(this.config.maxDailyProfitPercent, "%")
                : 'disabled',
            emergencyStop: this.config.emergencyStopOnLimit,
        });
    };
    /**
     * Update stats after trade close
     * Call this after each position closes
     *
     * @param pnl - Realized PnL from the trade
     * @param newBalance - New account balance after trade
     */
    DailyLimitsService.prototype.onTradeClose = function (pnl, newBalance) {
        this.stats.currentBalance = newBalance;
        this.stats.realizedPnL += pnl;
        this.stats.tradesCount++;
        this.logger.debug('Daily limits updated', {
            pnl: pnl.toFixed(2),
            totalPnL: this.stats.realizedPnL.toFixed(2),
            balance: newBalance.toFixed(2),
            tradesCount: this.stats.tradesCount,
        });
        this.checkLimits();
    };
    /**
     * Check if daily limits exceeded
     * Triggers emergency stop if configured
     */
    DailyLimitsService.prototype.checkLimits = function () {
        if (this.stats.startingBalance === 0) {
            this.logger.warn('Starting balance not set - cannot check limits');
            return;
        }
        var pnlPercent = (this.stats.realizedPnL / this.stats.startingBalance) * 100;
        // Check loss limit
        if (pnlPercent <= -this.config.maxDailyLossPercent) {
            this.stats.maxLossHit = true;
            this.logger.error('🛑 DAILY LOSS LIMIT HIT! (PHASE 5)', {
                pnl: this.stats.realizedPnL.toFixed(2),
                pnlPercent: pnlPercent.toFixed(2) + '%',
                limit: "-".concat(this.config.maxDailyLossPercent, "%"),
                tradesCount: this.stats.tradesCount,
            });
            if (this.config.emergencyStopOnLimit) {
                this.logger.error('⛔ EMERGENCY STOP - Bot shutting down to protect capital');
                process.exit(1); // Stop bot
            }
        }
        // Check profit target
        if (this.config.maxDailyProfitPercent &&
            pnlPercent >= this.config.maxDailyProfitPercent) {
            this.stats.maxProfitHit = true;
            this.logger.info('✅ DAILY PROFIT TARGET HIT! (PHASE 5)', {
                pnl: this.stats.realizedPnL.toFixed(2),
                pnlPercent: pnlPercent.toFixed(2) + '%',
                target: "+".concat(this.config.maxDailyProfitPercent, "%"),
                tradesCount: this.stats.tradesCount,
            });
            if (this.config.emergencyStopOnLimit) {
                this.logger.info('🎯 Profit target reached - Bot shutting down (success)');
                process.exit(0); // Stop bot (success)
            }
        }
    };
    /**
     * Check if trading allowed
     * Call before opening new positions
     *
     * @returns Object with allowed flag and optional reason for blocking
     */
    DailyLimitsService.prototype.canTrade = function () {
        // Check if need reset (new day)
        this.checkReset();
        if (this.stats.maxLossHit) {
            return {
                allowed: false,
                reason: "Daily loss limit hit (".concat(this.stats.realizedPnL.toFixed(2), " USDT, ").concat(((this.stats.realizedPnL / this.stats.startingBalance) * 100).toFixed(2), "%)"),
            };
        }
        if (this.stats.maxProfitHit && this.config.maxDailyProfitPercent) {
            return {
                allowed: false,
                reason: "Daily profit target hit (+".concat(this.stats.realizedPnL.toFixed(2), " USDT, +").concat(((this.stats.realizedPnL / this.stats.startingBalance) * 100).toFixed(2), "%)"),
            };
        }
        return { allowed: true };
    };
    /**
     * Check if need to reset stats (new day)
     * Automatically called in canTrade()
     */
    DailyLimitsService.prototype.checkReset = function () {
        var today = new Date().toISOString().split('T')[0];
        if (this.stats.date !== today) {
            this.logger.info('🔄 Daily limits reset (new day) (PHASE 5)', {
                previousDate: this.stats.date,
                previousPnL: this.stats.realizedPnL.toFixed(2),
                trades: this.stats.tradesCount,
                maxLossHit: this.stats.maxLossHit,
                maxProfitHit: this.stats.maxProfitHit,
            });
            this.stats = this.initStats();
        }
    };
    /**
     * Get current daily stats
     * @returns Copy of current stats
     */
    DailyLimitsService.prototype.getStats = function () {
        return __assign({}, this.stats);
    };
    /**
     * Manually reset stats (for testing)
     * Should not be used in production
     */
    DailyLimitsService.prototype.reset = function () {
        this.logger.warn('⚠️ Daily limits manually reset');
        this.stats = this.initStats();
    };
    return DailyLimitsService;
}());
exports.DailyLimitsService = DailyLimitsService;
