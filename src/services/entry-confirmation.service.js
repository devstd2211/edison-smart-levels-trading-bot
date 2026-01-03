"use strict";
/**
 * Entry Confirmation Manager
 *
 * Prevents premature entries by waiting for next candle close confirmation.
 *
 * LONG Flow:
 * 1. Strategy detects potential LONG at support level
 * 2. Instead of entering immediately, save as "pending"
 * 3. Wait for next 1m candle to close
 * 4. If candle closes ABOVE support → confirm entry (bounce confirmed)
 * 5. If candle closes BELOW support → cancel (falling knife)
 *
 * SHORT Flow:
 * 1. Strategy detects potential SHORT at resistance level
 * 2. Instead of entering immediately, save as "pending"
 * 3. Wait for next 1m candle to close
 * 4. If candle closes BELOW resistance → confirm entry (rejection confirmed)
 * 5. If candle closes ABOVE resistance → cancel (pump continues)
 *
 * Benefits:
 * - Reduces quick stop-outs (< 5min holds)
 * - Confirms price rejection/bounce before entry
 * - Configurable per direction (LONG/SHORT)
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
exports.EntryConfirmationManager = void 0;
var types_1 = require("../types");
// ============================================================================
// ENTRY CONFIRMATION MANAGER
// ============================================================================
var EntryConfirmationManager = /** @class */ (function () {
    function EntryConfirmationManager(config, logger) {
        this.config = config;
        this.logger = logger;
        this.pendingEntries = new Map();
    }
    /**
     * Check if confirmation is enabled for direction
     */
    EntryConfirmationManager.prototype.isEnabled = function (direction) {
        return direction === types_1.SignalDirection.LONG
            ? this.config.long.enabled
            : this.config.short.enabled;
    };
    /**
     * Get expiry time in milliseconds for direction
     */
    EntryConfirmationManager.prototype.getExpiryMs = function (direction) {
        var seconds = direction === types_1.SignalDirection.LONG
            ? this.config.long.expirySeconds
            : this.config.short.expirySeconds;
        return seconds * 1000;
    };
    /**
     * Add pending entry waiting for confirmation
     *
     * @param entry - Pending entry details
     * @returns Pending entry ID
     */
    EntryConfirmationManager.prototype.addPending = function (entry) {
        var _a;
        var id = "".concat(entry.symbol, "_").concat(entry.direction, "_").concat(Date.now());
        var expiryMs = this.getExpiryMs(entry.direction);
        var expiresAt = Date.now() + expiryMs;
        var pendingEntry = __assign({ id: id, expiresAt: expiresAt }, entry);
        this.pendingEntries.set(id, pendingEntry);
        var levelType = entry.direction === types_1.SignalDirection.LONG ? 'support' : 'resistance';
        var confirmCondition = entry.direction === types_1.SignalDirection.LONG
            ? 'candle close above support'
            : 'candle close below resistance';
        this.logger.info("\u23F3 ".concat(entry.direction, " entry pending confirmation"), (_a = {
                id: id,
                symbol: entry.symbol,
                direction: entry.direction
            },
            _a["".concat(levelType, "Level")] = entry.keyLevel.toFixed(4),
            _a.waitingFor = "Next 1m ".concat(confirmCondition),
            _a.expiresIn = "".concat(expiryMs / 60000, "min"),
            _a));
        return id;
    };
    /**
     * Check if pending entry should be confirmed
     *
     * @param id - Pending entry ID
     * @param currentCandleClose - Current 1m candle close price
     * @returns Confirmation result
     */
    EntryConfirmationManager.prototype.checkConfirmation = function (id, currentCandleClose) {
        var _a;
        var pending = this.pendingEntries.get(id);
        if (!pending) {
            return {
                confirmed: false,
                reason: 'Pending entry not found',
            };
        }
        // Check expiry
        if (Date.now() > pending.expiresAt) {
            var levelType = pending.direction === types_1.SignalDirection.LONG ? 'support' : 'resistance';
            this.logger.info("\u23F1\uFE0F ".concat(pending.direction, " entry EXPIRED"), (_a = {
                    id: id,
                    symbol: pending.symbol,
                    direction: pending.direction
                },
                _a["".concat(levelType, "Level")] = pending.keyLevel.toFixed(4),
                _a.reason = 'Confirmation timeout',
                _a));
            this.pendingEntries.delete(id);
            return {
                confirmed: false,
                reason: 'Confirmation timeout - signal expired',
            };
        }
        // LONG confirmation: candle closed ABOVE support
        if (pending.direction === types_1.SignalDirection.LONG) {
            if (currentCandleClose > pending.keyLevel) {
                this.logger.info('✅ LONG entry CONFIRMED', {
                    id: id,
                    symbol: pending.symbol,
                    supportLevel: pending.keyLevel.toFixed(4),
                    candleClose: currentCandleClose.toFixed(4),
                    bouncePercent: (((currentCandleClose - pending.keyLevel) / pending.keyLevel) * 100).toFixed(3) + '%',
                });
                this.pendingEntries.delete(id);
                return {
                    confirmed: true,
                    reason: 'Candle closed above support - bounce confirmed',
                    closePrice: currentCandleClose,
                    keyLevel: pending.keyLevel,
                };
            }
            else {
                // Candle closed BELOW/AT support - falling knife!
                this.logger.info('❌ LONG entry REJECTED', {
                    id: id,
                    symbol: pending.symbol,
                    supportLevel: pending.keyLevel.toFixed(4),
                    candleClose: currentCandleClose.toFixed(4),
                    reason: 'Candle closed below support - falling knife',
                });
                this.pendingEntries.delete(id);
                return {
                    confirmed: false,
                    reason: 'Candle closed below support - no bounce',
                    closePrice: currentCandleClose,
                    keyLevel: pending.keyLevel,
                };
            }
        }
        // SHORT confirmation: candle closed BELOW resistance
        if (pending.direction === types_1.SignalDirection.SHORT) {
            if (currentCandleClose < pending.keyLevel) {
                this.logger.info('✅ SHORT entry CONFIRMED', {
                    id: id,
                    symbol: pending.symbol,
                    resistanceLevel: pending.keyLevel.toFixed(4),
                    candleClose: currentCandleClose.toFixed(4),
                    rejectionPercent: (((pending.keyLevel - currentCandleClose) / pending.keyLevel) * 100).toFixed(3) + '%',
                });
                this.pendingEntries.delete(id);
                return {
                    confirmed: true,
                    reason: 'Candle closed below resistance - rejection confirmed',
                    closePrice: currentCandleClose,
                    keyLevel: pending.keyLevel,
                };
            }
            else {
                // Candle closed ABOVE/AT resistance - pump continues!
                this.logger.info('❌ SHORT entry REJECTED', {
                    id: id,
                    symbol: pending.symbol,
                    resistanceLevel: pending.keyLevel.toFixed(4),
                    candleClose: currentCandleClose.toFixed(4),
                    reason: 'Candle closed above resistance - pump continues',
                });
                this.pendingEntries.delete(id);
                return {
                    confirmed: false,
                    reason: 'Candle closed above resistance - no rejection',
                    closePrice: currentCandleClose,
                    keyLevel: pending.keyLevel,
                };
            }
        }
        // Should never reach here
        return {
            confirmed: false,
            reason: 'Unknown direction',
        };
    };
    /**
     * Get pending entry data
     *
     * @param id - Pending entry ID
     * @returns Pending entry or undefined
     */
    EntryConfirmationManager.prototype.getPending = function (id) {
        return this.pendingEntries.get(id);
    };
    /**
     * Get all pending entries
     *
     * @param direction - Optional: filter by direction
     * @returns Array of pending entries
     */
    EntryConfirmationManager.prototype.getAllPending = function (direction) {
        var allEntries = Array.from(this.pendingEntries.values());
        if (direction) {
            return allEntries.filter(function (entry) { return entry.direction === direction; });
        }
        return allEntries;
    };
    /**
     * Cancel pending entry
     *
     * @param id - Pending entry ID
     * @returns true if cancelled, false if not found
     */
    EntryConfirmationManager.prototype.cancel = function (id) {
        var _a;
        var pending = this.pendingEntries.get(id);
        if (pending) {
            var levelType = pending.direction === types_1.SignalDirection.LONG ? 'support' : 'resistance';
            this.logger.info("\uD83D\uDEAB ".concat(pending.direction, " entry CANCELLED"), (_a = {
                    id: id,
                    symbol: pending.symbol,
                    direction: pending.direction
                },
                _a["".concat(levelType, "Level")] = pending.keyLevel.toFixed(4),
                _a));
            this.pendingEntries.delete(id);
            return true;
        }
        return false;
    };
    /**
     * Clean up expired entries
     *
     * @returns Number of expired entries removed
     */
    EntryConfirmationManager.prototype.cleanupExpired = function () {
        var now = Date.now();
        var count = 0;
        for (var _i = 0, _a = this.pendingEntries.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], entry = _b[1];
            if (now > entry.expiresAt) {
                this.logger.debug("Removing expired pending ".concat(entry.direction), {
                    id: id,
                    symbol: entry.symbol,
                    direction: entry.direction,
                });
                this.pendingEntries.delete(id);
                count++;
            }
        }
        return count;
    };
    /**
     * Clear all pending entries
     */
    EntryConfirmationManager.prototype.clear = function () {
        this.pendingEntries.clear();
    };
    /**
     * Get count of pending entries
     *
     * @param direction - Optional: filter by direction
     * @returns Count of pending entries
     */
    EntryConfirmationManager.prototype.getPendingCount = function (direction) {
        if (direction) {
            return this.getAllPending(direction).length;
        }
        return this.pendingEntries.size;
    };
    return EntryConfirmationManager;
}());
exports.EntryConfirmationManager = EntryConfirmationManager;
