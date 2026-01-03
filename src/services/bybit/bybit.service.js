"use strict";
/**
 * Bybit API Service - Main Orchestrator
 *
 * Composed from modular partial classes:
 * - BybitBase: Shared utilities (retry, rounding, balance)
 * - BybitMarketData: Public API (candles, price, time, orderbook)
 * - BybitPositions: Position management (open, close, leverage)
 * - BybitOrders: Order management (TP, SL, trailing stop)
 *
 * Uses official Bybit SDK (RestClientV5) for futures trading.
 * Supports Demo/Testnet/Production environments.
 */
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
exports.BybitService = void 0;
var bybit_api_1 = require("bybit-api");
var bybit_base_partial_1 = require("./bybit-base.partial");
var bybit_market_data_partial_1 = require("./bybit-market-data.partial");
var bybit_positions_partial_1 = require("./bybit-positions.partial");
var bybit_orders_partial_1 = require("./bybit-orders.partial");
// ============================================================================
// BYBIT SERVICE (MAIN ORCHESTRATOR)
// ============================================================================
var BybitService = /** @class */ (function () {
    function BybitService(config, logger) {
        this.originalDateNow = Date.now;
        this.timeOffsetMs = 0;
        this.symbol = config.symbol;
        this.timeframe = config.timeframe;
        // Initialize RestClientV5
        var clientConfig = {
            key: config.apiKey,
            secret: config.apiSecret,
            recv_window: bybit_base_partial_1.RECV_WINDOW,
            sync_time_api: false, // SDK sync doesn't work - we'll do manual offset
        };
        // Select environment
        if (config.demo) {
            clientConfig.testnet = false;
            clientConfig.baseUrl = 'https://api-demo.bybit.com';
            logger.info('Bybit Demo API initialized', { baseUrl: clientConfig.baseUrl });
        }
        else if (config.testnet) {
            clientConfig.testnet = true;
            logger.info('Bybit Testnet API initialized');
        }
        else {
            clientConfig.testnet = false;
            logger.info('Bybit Production API initialized');
        }
        var restClient = new bybit_api_1.RestClientV5(clientConfig);
        // Instantiate partial classes
        this.base = new bybit_base_partial_1.BybitBase(restClient, config.symbol, config.timeframe, logger, config.demo);
        this.marketData = new bybit_market_data_partial_1.BybitMarketData(restClient, config.symbol, config.timeframe, logger, config.demo);
        this.positions = new bybit_positions_partial_1.BybitPositions(restClient, config.symbol, config.timeframe, logger, config.demo);
        this.orders = new bybit_orders_partial_1.BybitOrders(restClient, config.symbol, config.timeframe, logger, config.demo);
    }
    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    /**
     * Initialize service - load symbol precision parameters
     * Must be called after construction, before trading
     */
    BybitService.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var baseOffset;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.base.initialize()];
                    case 1:
                        _a.sent();
                        baseOffset = this.base.timeOffsetMs || 0;
                        this.applyTimeOffset(baseOffset);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Apply time offset correction via Date.now() monkey-patch
     * CRITICAL: Prevents timestamp errors when local clock is ahead
     */
    BybitService.prototype.applyTimeOffset = function (offsetMs) {
        var _this = this;
        this.timeOffsetMs = offsetMs;
        if (Math.abs(offsetMs) < 100) {
            // Offset is negligible, no need to monkey-patch
            return;
        }
        // Monkey-patch Date.now() to return corrected time
        var correctedDateNow = function () {
            return _this.originalDateNow() - _this.timeOffsetMs;
        };
        // Apply global monkey-patch (affects Bybit SDK internal timestamp generation)
        Date.now = correctedDateNow;
        console.log("\u23F0 Time offset applied: ".concat(offsetMs, "ms (Date.now() monkey-patched)"));
    };
    // ==========================================================================
    // MARKET DATA (delegate to BybitMarketData partial)
    // ==========================================================================
    BybitService.prototype.getCandles = function (symbolOrLimit, interval, limit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.marketData.getCandles(symbolOrLimit, interval, limit)];
            });
        });
    };
    BybitService.prototype.getCurrentPrice = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.marketData.getCurrentPrice()];
            });
        });
    };
    BybitService.prototype.getServerTime = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.marketData.getServerTime()];
            });
        });
    };
    BybitService.prototype.getOrderBook = function (symbol, limit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.marketData.getOrderBook(symbol, limit)];
            });
        });
    };
    BybitService.prototype.getFundingRate = function (symbol) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.marketData.getFundingRate(symbol)];
            });
        });
    };
    // ==========================================================================
    // POSITIONS (delegate to BybitPositions partial)
    // ==========================================================================
    BybitService.prototype.setMarginMode = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.positions.setMarginMode()];
            });
        });
    };
    BybitService.prototype.setLeverage = function (leverage) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.positions.setLeverage(leverage)];
            });
        });
    };
    BybitService.prototype.openPosition = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.positions.openPosition(params)];
            });
        });
    };
    BybitService.prototype.getPosition = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.positions.getPosition()];
            });
        });
    };
    BybitService.prototype.closePosition = function (side, quantity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.positions.closePosition(side, quantity)];
            });
        });
    };
    // ==========================================================================
    // ORDERS (delegate to BybitOrders partial)
    // ==========================================================================
    BybitService.prototype.placeTakeProfitLevels = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.placeTakeProfitLevels(params)];
            });
        });
    };
    BybitService.prototype.cancelTakeProfit = function (orderId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.cancelTakeProfit(orderId)];
            });
        });
    };
    BybitService.prototype.updateTakeProfit = function (orderId, newPrice) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.updateTakeProfit(orderId, newPrice)];
            });
        });
    };
    BybitService.prototype.placeStopLoss = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.placeStopLoss(params)];
            });
        });
    };
    BybitService.prototype.updateStopLoss = function (newStopPrice) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.updateStopLoss(newStopPrice)];
            });
        });
    };
    BybitService.prototype.cancelStopLoss = function (orderId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.cancelStopLoss(orderId)];
            });
        });
    };
    BybitService.prototype.setTrailingStop = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.setTrailingStop(params)];
            });
        });
    };
    BybitService.prototype.getActiveOrders = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.getActiveOrders()];
            });
        });
    };
    BybitService.prototype.getOrderHistory = function (limit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.getOrderHistory(limit)];
            });
        });
    };
    BybitService.prototype.verifyProtectionSet = function (side) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.verifyProtectionSet(side)];
            });
        });
    };
    BybitService.prototype.cancelAllConditionalOrders = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.orders.cancelAllConditionalOrders()];
            });
        });
    };
    // ==========================================================================
    // BALANCE (delegate to BybitBase partial)
    // ==========================================================================
    BybitService.prototype.getBalance = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.base.getBalance()];
            });
        });
    };
    BybitService.prototype.getExchangeLimits = function () {
        return this.base.getExchangeLimits();
    };
    return BybitService;
}());
exports.BybitService = BybitService;
