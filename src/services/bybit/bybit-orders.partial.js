"use strict";
/**
 * Bybit Orders Partial
 *
 * Handles order management operations:
 * - Take-profit levels (TP1, TP2, TP3)
 * - Stop-loss orders
 * - Trailing stops
 * - Order cancellation
 * - Conditional orders cleanup
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitOrders = void 0;
var types_1 = require("../../types");
var bybit_base_partial_1 = require("./bybit-base.partial");
// ============================================================================
// BYBIT ORDERS PARTIAL
// ============================================================================
var BybitOrders = /** @class */ (function (_super) {
    __extends(BybitOrders, _super);
    function BybitOrders() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // ==========================================================================
    // TAKE PROFIT
    // ==========================================================================
    /**
     * Place multiple take-profit levels
     */
    BybitOrders.prototype.placeTakeProfitLevels = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var side, entryPrice, totalQuantity, levels, orderIds, orderSide, _i, levels_1, level, tpPrice, quantity, orderQty, orderPrice, response, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        side = params.side, entryPrice = params.entryPrice, totalQuantity = params.totalQuantity, levels = params.levels;
                                        orderIds = [];
                                        orderSide = side === types_1.PositionSide.LONG ? 'Sell' : 'Buy';
                                        _i = 0, levels_1 = levels;
                                        _a.label = 1;
                                    case 1:
                                        if (!(_i < levels_1.length)) return [3 /*break*/, 6];
                                        level = levels_1[_i];
                                        tpPrice = side === types_1.PositionSide.LONG
                                            ? entryPrice * (1 + level.percent / bybit_base_partial_1.PERCENT_TO_DECIMAL)
                                            : entryPrice * (1 - level.percent / bybit_base_partial_1.PERCENT_TO_DECIMAL);
                                        quantity = (totalQuantity * level.sizePercent) / bybit_base_partial_1.PERCENT_TO_DECIMAL;
                                        orderQty = this.roundQuantity(quantity);
                                        orderPrice = this.roundPrice(tpPrice);
                                        this.logger.debug('Placing TP level', {
                                            level: level.level,
                                            percent: level.percent,
                                            price: tpPrice,
                                            priceRounded: orderPrice,
                                            quantity: quantity,
                                            quantityRounded: orderQty,
                                        });
                                        _a.label = 2;
                                    case 2:
                                        _a.trys.push([2, 4, , 5]);
                                        return [4 /*yield*/, this.restClient.submitOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                side: orderSide,
                                                orderType: 'Limit',
                                                qty: orderQty,
                                                price: orderPrice,
                                                reduceOnly: true,
                                                timeInForce: 'GTC',
                                            })];
                                    case 3:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            this.logger.warn("Failed to place TP level ".concat(level.level), { error: response.retMsg });
                                            orderIds.push(undefined); // Push undefined to maintain array index alignment
                                        }
                                        else {
                                            orderIds.push(response.result.orderId);
                                            this.logger.info("TP level ".concat(level.level, " placed"), {
                                                orderId: response.result.orderId,
                                                price: tpPrice,
                                                quantity: quantity,
                                            });
                                        }
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_1 = _a.sent();
                                        this.logger.error("Exception placing TP level ".concat(level.level), { error: error_1 });
                                        orderIds.push(undefined); // Push undefined to maintain array index alignment
                                        return [3 /*break*/, 5];
                                    case 5:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 6: return [2 /*return*/, orderIds];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Cancel take-profit order
     *
     * Gracefully handles cases where order doesn't exist (already filled/cancelled).
     * This is expected behavior when TP hits before cancellation.
     */
    BybitOrders.prototype.cancelTakeProfit = function (orderId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        this.logger.debug('Cancelling take-profit', { orderId: orderId });
                                        return [4 /*yield*/, this.restClient.cancelOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                orderId: orderId,
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        // Order not exists or too late to cancel - this is OK!
                                        // It means the order was already filled or cancelled by exchange
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            if (response.retMsg.includes('not exists') || response.retMsg.includes('too late')) {
                                                this.logger.warn('Take-profit already cancelled or filled', {
                                                    orderId: orderId,
                                                    reason: response.retMsg,
                                                });
                                                return [2 /*return*/]; // Success - nothing to cancel
                                            }
                                            throw new Error("Failed to cancel take-profit: ".concat(response.retMsg));
                                        }
                                        this.logger.info('Take-profit cancelled', { orderId: orderId });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Update take-profit order price
     *
     * Used for smart TP3 movement - moving TP3 by ticks as price moves favorably.
     */
    BybitOrders.prototype.updateTakeProfit = function (orderId, newPrice) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        this.logger.debug('Updating take-profit price', { orderId: orderId, newPrice: newPrice });
                                        return [4 /*yield*/, this.restClient.amendOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                orderId: orderId,
                                                price: newPrice.toString(), // Use 'price' for Limit orders (TP), not 'triggerPrice'
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        // Allow "not modified" error - price is already correct
                                        if (response.retCode === bybit_base_partial_1.BYBIT_NOT_MODIFIED_CODE) {
                                            this.logger.debug('Take-profit already at target price', { orderId: orderId, newPrice: newPrice });
                                            return [2 /*return*/]; // Success - no modification needed
                                        }
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Failed to update take-profit: ".concat(response.retMsg));
                                        }
                                        this.logger.info('Take-profit price updated', { orderId: orderId, newPrice: newPrice });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // STOP LOSS
    // ==========================================================================
    /**
     * Place stop-loss order
     */
    BybitOrders.prototype.placeStopLoss = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var side, quantity, stopPrice, orderSide, TRIGGER_DIRECTION_RISE, TRIGGER_DIRECTION_FALL, triggerDirection, orderQty, orderPrice, response, orderId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        side = params.side, quantity = params.quantity, stopPrice = params.stopPrice;
                                        orderSide = side === types_1.PositionSide.LONG ? 'Sell' : 'Buy';
                                        TRIGGER_DIRECTION_RISE = 1;
                                        TRIGGER_DIRECTION_FALL = 2;
                                        triggerDirection = side === types_1.PositionSide.LONG
                                            ? TRIGGER_DIRECTION_FALL
                                            : TRIGGER_DIRECTION_RISE;
                                        orderQty = this.roundQuantity(quantity);
                                        orderPrice = this.roundPrice(stopPrice);
                                        this.logger.debug('Placing stop-loss', {
                                            side: side,
                                            stopPrice: stopPrice,
                                            stopPriceRounded: orderPrice,
                                            quantity: quantity,
                                            quantityRounded: orderQty,
                                        });
                                        return [4 /*yield*/, this.restClient.submitOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                side: orderSide,
                                                orderType: 'Market',
                                                qty: orderQty,
                                                triggerPrice: orderPrice,
                                                triggerDirection: triggerDirection,
                                                triggerBy: 'LastPrice',
                                                reduceOnly: true,
                                                closeOnTrigger: true,
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Failed to place stop-loss: ".concat(response.retMsg));
                                        }
                                        orderId = response.result.orderId;
                                        this.logger.info('Stop-loss placed', { orderId: orderId, stopPrice: stopPrice });
                                        return [2 /*return*/, orderId];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Update stop-loss price for existing position
     * Uses setTradingStop API (NOT amendOrder) to update position SL
     */
    BybitOrders.prototype.updateStopLoss = function (newStopPrice) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var roundedPrice, response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        roundedPrice = this.roundPrice(newStopPrice);
                                        this.logger.info('🔄 Updating stop-loss for position', {
                                            newStopPrice: newStopPrice,
                                            roundedPrice: roundedPrice,
                                            symbol: this.symbol,
                                        });
                                        return [4 /*yield*/, this.restClient.setTradingStop({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                stopLoss: roundedPrice.toString(),
                                                positionIdx: bybit_base_partial_1.POSITION_IDX_ONE_WAY, // One-Way mode
                                                tpslMode: 'Full',
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        this.logger.info('📋 setTradingStop response', {
                                            retCode: response.retCode,
                                            retMsg: response.retMsg,
                                            result: response.result,
                                        });
                                        // Code 10001 means "zero position" - position already closed (race condition), which is OK
                                        if (response.retCode === bybit_base_partial_1.BYBIT_ZERO_POSITION_CODE) {
                                            this.logger.info('ℹ️ Position already closed, skipping SL update (race condition)', {
                                                newStopPrice: roundedPrice,
                                                retCode: response.retCode,
                                            });
                                            return [2 /*return*/];
                                        }
                                        // Code 34040 means "not modified" - SL is already at this price, which is OK
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE && response.retCode !== bybit_base_partial_1.BYBIT_NOT_MODIFIED_CODE) {
                                            throw new Error("Failed to update stop-loss: ".concat(response.retMsg));
                                        }
                                        if (response.retCode === bybit_base_partial_1.BYBIT_NOT_MODIFIED_CODE) {
                                            this.logger.info('ℹ️ Stop-loss already at target price (not modified)', { newStopPrice: roundedPrice });
                                        }
                                        else {
                                            this.logger.info('✅ Stop-loss updated successfully', { newStopPrice: roundedPrice });
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Cancel stop-loss order
     */
    BybitOrders.prototype.cancelStopLoss = function (orderId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        this.logger.debug('Cancelling stop-loss', { orderId: orderId });
                                        return [4 /*yield*/, this.restClient.cancelOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                orderId: orderId,
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        // Code 110001 means "order not exists" - SL already cancelled, which is OK
                                        if (response.retCode === bybit_base_partial_1.BYBIT_ORDER_NOT_EXISTS_CODE) {
                                            this.logger.info('ℹ️ Stop-loss already cancelled (order not exists)', { orderId: orderId });
                                            return [2 /*return*/];
                                        }
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Failed to cancel stop-loss: ".concat(response.retMsg));
                                        }
                                        this.logger.info('Stop-loss cancelled', { orderId: orderId });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // TRAILING STOP
    // ==========================================================================
    /**
     * Activate server-side trailing stop
     */
    BybitOrders.prototype.setTrailingStop = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var activationPrice, trailingPercent, trailingStopAmount, response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        activationPrice = params.activationPrice, trailingPercent = params.trailingPercent;
                                        trailingStopAmount = activationPrice * (trailingPercent / bybit_base_partial_1.PERCENT_TO_DECIMAL);
                                        this.logger.debug('Setting trailing stop', {
                                            activationPrice: activationPrice,
                                            trailingPercent: trailingPercent,
                                            trailingStopAmount: trailingStopAmount,
                                        });
                                        return [4 /*yield*/, this.restClient.setTradingStop({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                trailingStop: trailingStopAmount.toFixed(4),
                                                positionIdx: bybit_base_partial_1.POSITION_IDX_ONE_WAY,
                                                tpslMode: 'Full',
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        // Code 10001 means "zero position" - position already closed (race condition), which is OK
                                        if (response.retCode === bybit_base_partial_1.BYBIT_ZERO_POSITION_CODE) {
                                            this.logger.info('ℹ️ Position already closed, skipping trailing stop (race condition)', {
                                                trailingPercent: trailingPercent,
                                                retCode: response.retCode,
                                            });
                                            return [2 /*return*/];
                                        }
                                        // Code 34040 means "not modified" - trailing stop already set, which is OK
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE && response.retCode !== bybit_base_partial_1.BYBIT_NOT_MODIFIED_CODE) {
                                            throw new Error("Failed to set trailing stop: ".concat(response.retMsg));
                                        }
                                        if (response.retCode === bybit_base_partial_1.BYBIT_NOT_MODIFIED_CODE) {
                                            this.logger.info('ℹ️ Trailing stop already set (not modified)', {
                                                trailingPercent: "".concat(trailingPercent, "%"),
                                            });
                                        }
                                        else {
                                            this.logger.info('Trailing stop activated', {
                                                activationPrice: activationPrice,
                                                trailingPercent: "".concat(trailingPercent, "%"),
                                                trailingStopAmount: trailingStopAmount,
                                            });
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // PROTECTION VERIFICATION
    // ==========================================================================
    /**
     * Verify that TP/SL protection is actually set on exchange
     * CRITICAL: Prevents positions without protection
     *
     * @param side - Position side (LONG or SHORT)
     * @returns ProtectionVerification with detailed status
     */
    BybitOrders.prototype.verifyProtectionSet = function (side) {
        return __awaiter(this, void 0, void 0, function () {
            var orders, stopLossOrders, takeProfitOrders, hasStopLoss, hasTakeProfit, hasTrailingStop, positionResponse, position, trailingStopValue, posError_1, isProtected, verification, error_2;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.getActiveOrders()];
                    case 1:
                        orders = _d.sent();
                        stopLossOrders = orders.filter(function (order) {
                            var isSLOrder = order.triggerPrice !== undefined &&
                                order.stopOrderType !== undefined &&
                                order.reduceOnly === true;
                            // For LONG: SL is Sell order below entry
                            // For SHORT: SL is Buy order above entry
                            var correctSide = side === types_1.PositionSide.LONG
                                ? order.side === 'Sell'
                                : order.side === 'Buy';
                            return isSLOrder && correctSide;
                        });
                        takeProfitOrders = orders.filter(function (order) {
                            var isTPOrder = order.orderType === 'Limit' && order.reduceOnly === true;
                            // For LONG: TP is Sell order above entry
                            // For SHORT: TP is Buy order below entry
                            var correctSide = side === types_1.PositionSide.LONG
                                ? order.side === 'Sell'
                                : order.side === 'Buy';
                            return isTPOrder && correctSide;
                        });
                        hasStopLoss = stopLossOrders.length > 0;
                        hasTakeProfit = takeProfitOrders.length > 0;
                        hasTrailingStop = false;
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.restClient.getPositionInfo({
                                category: 'linear',
                                symbol: this.symbol,
                            })];
                    case 3:
                        positionResponse = _d.sent();
                        if (positionResponse.retCode === bybit_base_partial_1.BYBIT_SUCCESS_CODE && ((_b = (_a = positionResponse.result) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                            position = positionResponse.result.list[0];
                            trailingStopValue = position.trailingStop;
                            hasTrailingStop = trailingStopValue !== undefined &&
                                trailingStopValue !== null &&
                                trailingStopValue !== '' &&
                                parseFloat(trailingStopValue) > 0;
                            this.logger.debug('Trailing stop check', {
                                trailingStopValue: trailingStopValue,
                                hasTrailingStop: hasTrailingStop,
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        posError_1 = _d.sent();
                        this.logger.warn('Failed to check trailing stop, assuming none', {
                            error: posError_1 instanceof Error ? posError_1.message : String(posError_1),
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        isProtected = (hasStopLoss || hasTrailingStop) && (hasTakeProfit || hasTrailingStop);
                        verification = {
                            hasStopLoss: hasStopLoss || hasTrailingStop, // Trailing stop counts as SL
                            hasTakeProfit: hasTakeProfit || hasTrailingStop, // Trailing stop replaces TP
                            stopLossPrice: ((_c = stopLossOrders[0]) === null || _c === void 0 ? void 0 : _c.triggerPrice) ? parseFloat(stopLossOrders[0].triggerPrice) : undefined,
                            takeProfitPrices: takeProfitOrders.map(function (o) { return parseFloat(o.price); }),
                            activeOrders: orders.length,
                            verified: isProtected,
                            hasTrailingStop: hasTrailingStop,
                        };
                        this.logger.debug('Protection verification complete', {
                            side: side,
                            verification: verification,
                            totalOrders: orders.length,
                            slOrders: stopLossOrders.length,
                            tpOrders: takeProfitOrders.length,
                            hasTrailingStop: hasTrailingStop,
                            isProtected: isProtected,
                        });
                        return [2 /*return*/, verification];
                    case 6:
                        error_2 = _d.sent();
                        this.logger.error('Failed to verify protection', {
                            error: error_2 instanceof Error ? error_2.message : String(error_2),
                        });
                        // Return conservative result (assume no protection on error)
                        return [2 /*return*/, {
                                hasStopLoss: false,
                                hasTakeProfit: false,
                                activeOrders: 0,
                                verified: false,
                                hasTrailingStop: false,
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ==========================================================================
    // ACTIVE ORDERS & CLEANUP
    // ==========================================================================
    /**
     * Get all active orders for the symbol
     * @returns Array of active orders
     */
    BybitOrders.prototype.getActiveOrders = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, orders;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        this.logger.debug('Fetching active orders', { symbol: this.symbol });
                                        return [4 /*yield*/, this.restClient.getActiveOrders({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                settleCoin: 'USDT',
                                            })];
                                    case 1:
                                        response = _b.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            this.logger.warn('Failed to get active orders', {
                                                error: response.retMsg,
                                                code: response.retCode
                                            });
                                            return [2 /*return*/, []];
                                        }
                                        orders = ((_a = response.result) === null || _a === void 0 ? void 0 : _a.list) || [];
                                        this.logger.debug('Active orders fetched', {
                                            count: orders.length,
                                            orderIds: orders.map(function (o) { return o.orderId; })
                                        });
                                        return [2 /*return*/, orders];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get order history (filled/cancelled orders)
     * Used by Safety Monitor to determine exitType when WebSocket event was missed
     * @param limit - Maximum number of orders to fetch (default: 20)
     * @returns Array of historical orders
     */
    BybitOrders.prototype.getOrderHistory = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var _this = this;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, orders;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        this.logger.debug('Fetching order history', { symbol: this.symbol, limit: limit });
                                        return [4 /*yield*/, this.restClient.getHistoricOrders({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                limit: limit,
                                            })];
                                    case 1:
                                        response = _b.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            this.logger.warn('Failed to get order history', {
                                                error: response.retMsg,
                                                code: response.retCode
                                            });
                                            return [2 /*return*/, []];
                                        }
                                        orders = ((_a = response.result) === null || _a === void 0 ? void 0 : _a.list) || [];
                                        this.logger.debug('Order history fetched', {
                                            count: orders.length,
                                            orderStatuses: orders.map(function (o) { return ({ id: o.orderId, status: o.orderStatus }); })
                                        });
                                        return [2 /*return*/, orders];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Cancel all conditional orders (SL/TP) for the symbol
     * Used to cleanup hanging orders when no position exists
     * Logs errors instead of throwing to ensure cleanup continues
     */
    BybitOrders.prototype.cancelAllConditionalOrders = function () {
        return __awaiter(this, void 0, void 0, function () {
            var orders, conditionalOrders, _i, conditionalOrders_1, order, response, error_3, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, this.getActiveOrders()];
                    case 1:
                        orders = _a.sent();
                        if (orders.length === 0) {
                            this.logger.debug('No active orders to cancel');
                            return [2 /*return*/];
                        }
                        conditionalOrders = orders.filter(function (order) {
                            // Conditional orders are typically:
                            // 1. Reduce-only orders (reduceOnly = true)
                            // 2. Or orders with trigger price (stopOrderType exists)
                            return order.reduceOnly === true ||
                                order.stopOrderType !== undefined ||
                                order.triggerPrice !== undefined;
                        });
                        this.logger.info('Found conditional orders to cleanup', {
                            total: orders.length,
                            conditional: conditionalOrders.length,
                            conditionalIds: conditionalOrders.map(function (o) { return o.orderId; })
                        });
                        _i = 0, conditionalOrders_1 = conditionalOrders;
                        _a.label = 2;
                    case 2:
                        if (!(_i < conditionalOrders_1.length)) return [3 /*break*/, 7];
                        order = conditionalOrders_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        this.logger.debug('Cancelling conditional order', {
                            orderId: order.orderId,
                            orderType: order.orderType,
                            side: order.side,
                            triggerPrice: order.triggerPrice,
                        });
                        return [4 /*yield*/, this.restClient.cancelOrder({
                                category: 'linear',
                                symbol: this.symbol,
                                orderId: order.orderId,
                            })];
                    case 4:
                        response = _a.sent();
                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                            this.logger.warn('Failed to cancel conditional order, continuing...', {
                                orderId: order.orderId,
                                error: response.retMsg,
                                code: response.retCode,
                            });
                        }
                        else {
                            this.logger.info('✅ Cancelled hanging conditional order', {
                                orderId: order.orderId,
                                orderType: order.orderType,
                            });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_3 = _a.sent();
                        this.logger.warn('Error cancelling conditional order, continuing...', {
                            orderId: order.orderId,
                            error: error_3 instanceof Error ? error_3.message : String(error_3),
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        this.logger.info('Conditional orders cleanup completed', {
                            processed: conditionalOrders.length,
                        });
                        return [3 /*break*/, 9];
                    case 8:
                        error_4 = _a.sent();
                        this.logger.error('Error in cancelAllConditionalOrders', {
                            error: error_4 instanceof Error ? error_4.message : String(error_4),
                        });
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    return BybitOrders;
}(bybit_base_partial_1.BybitBase));
exports.BybitOrders = BybitOrders;
