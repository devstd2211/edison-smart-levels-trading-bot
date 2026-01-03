"use strict";
/**
 * Bybit Positions Partial
 *
 * Handles position management operations:
 * - Open positions (LONG/SHORT)
 * - Close positions
 * - Get position info
 * - Set leverage
 * - Set margin mode
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
exports.BybitPositions = void 0;
var types_1 = require("../../types");
var bybit_base_partial_1 = require("./bybit-base.partial");
// ============================================================================
// BYBIT POSITIONS PARTIAL
// ============================================================================
var BybitPositions = /** @class */ (function (_super) {
    __extends(BybitPositions, _super);
    function BybitPositions() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // ==========================================================================
    // MARGIN & LEVERAGE
    // ==========================================================================
    /**
     * Set margin mode to isolated
     * NOTE: Not supported on demo trading - skipped for demo accounts
     */
    BybitPositions.prototype.setMarginMode = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Skip for demo trading (not supported)
                        if (this.demo) {
                            this.logger.debug('Skipping setMarginMode (not supported on demo trading)');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            this.logger.debug('Setting margin mode to ISOLATED');
                                            return [4 /*yield*/, this.restClient.switchIsolatedMargin({
                                                    category: 'linear',
                                                    symbol: this.symbol,
                                                    tradeMode: 1, // 1 = Isolated margin
                                                    buyLeverage: '10',
                                                    sellLeverage: '10',
                                                })];
                                        case 1:
                                            response = _c.sent();
                                            if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                                // Ignore if already in isolated mode
                                                if (((_a = response.retMsg) === null || _a === void 0 ? void 0 : _a.includes('margin mode not modified')) ||
                                                    ((_b = response.retMsg) === null || _b === void 0 ? void 0 : _b.includes('already')) ||
                                                    response.retCode === 110026) { // Already in isolated mode
                                                    this.logger.debug('Margin mode already set to ISOLATED');
                                                    return [2 /*return*/];
                                                }
                                                this.logger.warn('Failed to set margin mode (non-critical)', {
                                                    error: response.retMsg,
                                                    code: response.retCode
                                                });
                                                return [2 /*return*/]; // Continue anyway - margin mode is not critical
                                            }
                                            this.logger.info('Margin mode set to ISOLATED', { symbol: this.symbol });
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
     * Set leverage for symbol
     */
    BybitPositions.prototype.setLeverage = function (leverage) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: 
                                    // First ensure we're in isolated margin mode
                                    return [4 /*yield*/, this.setMarginMode()];
                                    case 1:
                                        // First ensure we're in isolated margin mode
                                        _b.sent();
                                        return [4 /*yield*/, this.restClient.setLeverage({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                buyLeverage: leverage.toString(),
                                                sellLeverage: leverage.toString(),
                                            })];
                                    case 2:
                                        response = _b.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            // Ignore "leverage not modified" error
                                            if ((_a = response.retMsg) === null || _a === void 0 ? void 0 : _a.includes('leverage not modified')) {
                                                this.logger.debug('Leverage already set', { leverage: leverage });
                                                return [2 /*return*/];
                                            }
                                            throw new Error("Failed to set leverage: ".concat(response.retMsg));
                                        }
                                        this.logger.info('Leverage set', { symbol: this.symbol, leverage: leverage });
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
    // POSITION MANAGEMENT
    // ==========================================================================
    /**
     * Open futures position with limit order
     */
    BybitPositions.prototype.openPosition = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var side, quantity, leverage, orderQty, response, orderId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        side = params.side, quantity = params.quantity, leverage = params.leverage;
                                        // Set leverage first
                                        return [4 /*yield*/, this.setLeverage(leverage)];
                                    case 1:
                                        // Set leverage first
                                        _a.sent();
                                        orderQty = this.roundQuantity(quantity);
                                        this.logger.info('📤 Submitting MARKET order to Bybit', {
                                            side: side,
                                            quantity: quantity,
                                            quantityString: orderQty,
                                            symbol: this.symbol,
                                            leverage: leverage,
                                        });
                                        return [4 /*yield*/, this.restClient.submitOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                side: side === types_1.PositionSide.LONG ? 'Buy' : 'Sell',
                                                orderType: 'Market',
                                                qty: orderQty,
                                                positionIdx: bybit_base_partial_1.POSITION_IDX_ONE_WAY,
                                            })];
                                    case 2:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Failed to open position: ".concat(response.retMsg));
                                        }
                                        orderId = response.result.orderId;
                                        this.logger.info('Position MARKET order placed', { orderId: orderId, side: side, quantity: orderQty });
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
     * Get current open position
     */
    BybitPositions.prototype.getPosition = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, positions, pos, size;
                            var _a, _b, _c, _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0: return [4 /*yield*/, this.restClient.getPositionInfo({
                                            category: 'linear',
                                            symbol: this.symbol,
                                        })];
                                    case 1:
                                        response = _f.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                        }
                                        positions = response.result.list;
                                        if (positions === undefined || positions.length === 0) {
                                            return [2 /*return*/, null];
                                        }
                                        pos = positions[0];
                                        size = parseFloat((_a = pos.size) !== null && _a !== void 0 ? _a : '0');
                                        // No position if size is 0
                                        if (size === bybit_base_partial_1.POSITION_SIZE_ZERO) {
                                            return [2 /*return*/, null];
                                        }
                                        // Map to Position type
                                        return [2 /*return*/, {
                                                id: "".concat(this.symbol, "_").concat(pos.side),
                                                symbol: this.symbol,
                                                side: pos.side === 'Buy' ? types_1.PositionSide.LONG : types_1.PositionSide.SHORT,
                                                quantity: size,
                                                entryPrice: parseFloat((_b = pos.avgPrice) !== null && _b !== void 0 ? _b : '0'),
                                                leverage: parseFloat((_c = pos.leverage) !== null && _c !== void 0 ? _c : '1'),
                                                marginUsed: parseFloat((_d = pos.positionIM) !== null && _d !== void 0 ? _d : '0'), // Initial margin
                                                stopLoss: {
                                                    price: 0,
                                                    initialPrice: 0,
                                                    isBreakeven: false,
                                                    isTrailing: false,
                                                    updatedAt: Date.now(),
                                                },
                                                takeProfits: [],
                                                openedAt: Date.now(),
                                                unrealizedPnL: parseFloat((_e = pos.unrealisedPnl) !== null && _e !== void 0 ? _e : '0'),
                                                orderId: '',
                                                reason: 'Existing position from API',
                                                status: 'OPEN', // Position restored from exchange is OPEN
                                            }];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Close position completely
     */
    BybitPositions.prototype.closePosition = function (side, quantity) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var closeSide, response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        closeSide = side === types_1.PositionSide.LONG ? 'Sell' : 'Buy';
                                        return [4 /*yield*/, this.restClient.submitOrder({
                                                category: 'linear',
                                                symbol: this.symbol,
                                                side: closeSide,
                                                orderType: 'Market',
                                                qty: quantity.toString(),
                                                positionIdx: bybit_base_partial_1.POSITION_IDX_ONE_WAY,
                                                reduceOnly: true,
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Failed to close position: ".concat(response.retMsg));
                                        }
                                        this.logger.info('Position closed', { side: side, quantity: quantity, orderId: response.result.orderId });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return BybitPositions;
}(bybit_base_partial_1.BybitBase));
exports.BybitPositions = BybitPositions;
