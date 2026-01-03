"use strict";
/**
 * Risk-Based Position Sizing Service (PHASE 5)
 *
 * Calculates position size based on actual SL distance to maintain consistent risk per trade.
 *
 * Problem:
 * - Fixed position size ($10) means different risk per trade based on SL distance
 * - Trade A (SL 1%): Risk = $0.10
 * - Trade B (SL 5%): Risk = $0.50 (5x more risk!)
 *
 * Solution:
 * - Calculate position size to risk exactly X% of account on every trade
 * - Formula: positionSize = (accountBalance × riskPercent) / stopLossPercent
 *
 * Example:
 * - Account: $1000
 * - Risk: 1% = $10
 * - SL Distance: 2%
 * - Position Size = $10 / 0.02 = $500
 * - If stopped out: lose exactly $10 (1% of account) ✅
 *
 * Features:
 * - Risk fixed % per trade
 * - Min/max position size limits
 * - Leverage cap protection
 * - Detailed logging
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
exports.RiskBasedSizingService = void 0;
// ============================================================================
// RISK-BASED SIZING SERVICE
// ============================================================================
var RiskBasedSizingService = /** @class */ (function () {
    function RiskBasedSizingService(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Calculate position size based on risk
     *
     * Formula: positionSize = (accountBalance × riskPercent) / stopLossPercent
     *
     * @param accountBalance - Current account balance in USDT
     * @param entryPrice - Entry price for the position
     * @param stopLossPrice - Stop loss price
     * @returns Position size in USDT
     */
    RiskBasedSizingService.prototype.calculatePositionSize = function (accountBalance, entryPrice, stopLossPrice) {
        // Validate inputs
        if (accountBalance <= 0) {
            this.logger.error('Invalid account balance', { accountBalance: accountBalance });
            return this.config.minPositionSizeUsdt;
        }
        if (entryPrice <= 0 || stopLossPrice <= 0) {
            this.logger.error('Invalid prices', { entryPrice: entryPrice, stopLossPrice: stopLossPrice });
            return this.config.minPositionSizeUsdt;
        }
        if (entryPrice === stopLossPrice) {
            this.logger.error('Entry price equals stop loss price');
            return this.config.minPositionSizeUsdt;
        }
        // Risk amount in USDT
        var riskAmount = accountBalance * (this.config.riskPerTradePercent / 100);
        // SL distance as percentage
        var slDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice) * 100;
        // Position size to risk exactly riskAmount
        var idealSize = riskAmount / (slDistance / 100);
        // Apply limits
        var finalSize = idealSize;
        // Min size
        if (finalSize < this.config.minPositionSizeUsdt) {
            finalSize = this.config.minPositionSizeUsdt;
            this.logger.warn('📐 Position size below minimum (PHASE 5)', {
                ideal: idealSize.toFixed(2),
                min: this.config.minPositionSizeUsdt,
                reason: 'SL too wide for desired risk',
            });
        }
        // Max size
        if (finalSize > this.config.maxPositionSizeUsdt) {
            finalSize = this.config.maxPositionSizeUsdt;
            this.logger.warn('📐 Position size above maximum (PHASE 5)', {
                ideal: idealSize.toFixed(2),
                max: this.config.maxPositionSizeUsdt,
                reason: 'SL too tight, would require large position',
            });
        }
        // Max leverage (don't risk more than account × multiplier)
        var maxSizeByLeverage = accountBalance * this.config.maxLeverageMultiplier;
        if (finalSize > maxSizeByLeverage) {
            finalSize = maxSizeByLeverage;
            this.logger.warn('📐 Position size capped by leverage (PHASE 5)', {
                ideal: idealSize.toFixed(2),
                maxLeverage: maxSizeByLeverage.toFixed(2),
                leverageMultiplier: this.config.maxLeverageMultiplier,
            });
        }
        // Calculate actual risk with final size
        var actualRiskAmount = finalSize * (slDistance / 100);
        var actualRiskPercent = (actualRiskAmount / accountBalance) * 100;
        this.logger.info('📐 Risk-based position size calculated (PHASE 5)', {
            accountBalance: accountBalance.toFixed(2),
            targetRisk: this.config.riskPerTradePercent + '%',
            targetRiskAmount: riskAmount.toFixed(2),
            slDistance: slDistance.toFixed(2) + '%',
            idealSize: idealSize.toFixed(2),
            finalSize: finalSize.toFixed(2),
            actualRisk: actualRiskPercent.toFixed(2) + '%',
            actualRiskAmount: actualRiskAmount.toFixed(2),
        });
        return finalSize;
    };
    /**
     * Get config for testing/debugging
     * @returns Copy of config
     */
    RiskBasedSizingService.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    return RiskBasedSizingService;
}());
exports.RiskBasedSizingService = RiskBasedSizingService;
