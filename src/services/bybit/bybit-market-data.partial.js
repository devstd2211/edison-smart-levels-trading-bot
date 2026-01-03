"use strict";
/**
 * Bybit Market Data Partial
 *
 * Handles public market data operations (no authentication required):
 * - Historical candles (OHLCV)
 * - Current price
 * - Server time
 * - Order book depth
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
exports.BybitMarketData = void 0;
var bybit_base_partial_1 = require("./bybit-base.partial");
// ============================================================================
// BYBIT MARKET DATA PARTIAL
// ============================================================================
var BybitMarketData = /** @class */ (function (_super) {
    __extends(BybitMarketData, _super);
    function BybitMarketData() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // ==========================================================================
    // CANDLES
    // ==========================================================================
    /**
     * Get historical candles (OHLCV data)
     * @param symbolOrLimit - Symbol name OR limit number (for backward compatibility)
     * @param interval - Interval (e.g., "1", "5", "60")
     * @param limit - Number of candles to fetch
     */
    BybitMarketData.prototype.getCandles = function () {
        return __awaiter(this, arguments, void 0, function (symbolOrLimit, interval, limit) {
            var symbol, timeframe, candleLimit;
            var _this = this;
            if (symbolOrLimit === void 0) { symbolOrLimit = bybit_base_partial_1.DEFAULT_CANDLE_LIMIT; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (typeof symbolOrLimit === 'number') {
                            // Old behavior: getCandles(limit)
                            symbol = this.symbol;
                            timeframe = this.timeframe;
                            candleLimit = symbolOrLimit;
                        }
                        else {
                            // New behavior: getCandles(symbol, interval, limit)
                            symbol = symbolOrLimit;
                            timeframe = interval || this.timeframe;
                            candleLimit = limit || bybit_base_partial_1.DEFAULT_CANDLE_LIMIT;
                        }
                        return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var requestParams, response, klines, reversedKlines, candles;
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                                return __generator(this, function (_k) {
                                    switch (_k.label) {
                                        case 0:
                                            this.logger.info('🕯️ Requesting candles from Bybit', {
                                                symbol: symbol,
                                                interval: timeframe,
                                                limit: candleLimit,
                                                timestamp: new Date().toISOString()
                                            });
                                            requestParams = {
                                                category: 'linear',
                                                symbol: symbol,
                                                interval: timeframe,
                                                limit: candleLimit,
                                            };
                                            this.logger.debug('📤 API Request params', requestParams);
                                            return [4 /*yield*/, this.restClient.getKline(requestParams)];
                                        case 1:
                                            response = _k.sent();
                                            // Detailed response logging
                                            this.logger.info('📥 Bybit API response received', {
                                                retCode: response.retCode,
                                                retMsg: response.retMsg,
                                                hasResult: !!response.result,
                                                hasResultList: !!((_a = response.result) === null || _a === void 0 ? void 0 : _a.list),
                                                listLength: (_d = (_c = (_b = response.result) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0,
                                                category: (_e = response.result) === null || _e === void 0 ? void 0 : _e.category,
                                                symbol: (_f = response.result) === null || _f === void 0 ? void 0 : _f.symbol,
                                            });
                                            if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                                this.logger.error('❌ Bybit API error', {
                                                    retCode: response.retCode,
                                                    retMsg: response.retMsg,
                                                    fullResponse: JSON.stringify(response, null, 2)
                                                });
                                                throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                            }
                                            klines = (_g = response.result) === null || _g === void 0 ? void 0 : _g.list;
                                            if (klines === undefined || klines === null || klines.length === 0) {
                                                this.logger.error('❌ Empty candles response', {
                                                    symbol: this.symbol,
                                                    interval: this.timeframe,
                                                    limit: limit,
                                                    resultExists: !!response.result,
                                                    resultKeys: response.result ? Object.keys(response.result) : [],
                                                    fullResult: JSON.stringify(response.result, null, 2)
                                                });
                                                throw new Error('No candles received from exchange');
                                            }
                                            this.logger.info('✅ Candles fetched successfully', {
                                                count: klines.length,
                                                firstCandleTime: ((_h = klines[0]) === null || _h === void 0 ? void 0 : _h[0]) ? new Date(parseInt(klines[0][0])).toISOString() : 'N/A',
                                                lastCandleTime: ((_j = klines[klines.length - 1]) === null || _j === void 0 ? void 0 : _j[0]) ? new Date(parseInt(klines[klines.length - 1][0])).toISOString() : 'N/A'
                                            });
                                            reversedKlines = klines.reverse();
                                            candles = reversedKlines.map(function (k) { return ({
                                                timestamp: parseInt(k[0]),
                                                open: parseFloat(k[1]),
                                                high: parseFloat(k[2]),
                                                low: parseFloat(k[3]),
                                                close: parseFloat(k[4]),
                                                volume: parseFloat(k[5]),
                                            }); });
                                            this.logger.debug('📊 First candle', {
                                                timestamp: new Date(candles[0].timestamp).toISOString(),
                                                open: candles[0].open,
                                                close: candles[0].close,
                                            });
                                            this.logger.debug('📊 Last candle', {
                                                timestamp: new Date(candles[candles.length - 1].timestamp).toISOString(),
                                                open: candles[candles.length - 1].open,
                                                close: candles[candles.length - 1].close,
                                            });
                                            return [2 /*return*/, candles];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // PRICE & TIME
    // ==========================================================================
    /**
     * Get current market price
     */
    BybitMarketData.prototype.getCurrentPrice = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, ticker;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.restClient.getTickers({
                                            category: 'linear',
                                            symbol: this.symbol,
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                        }
                                        ticker = response.result.list[0];
                                        if (ticker === undefined || ticker === null) {
                                            throw new Error("No ticker data for ".concat(this.symbol));
                                        }
                                        return [2 /*return*/, parseFloat(ticker.lastPrice)];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get server time (for time synchronization)
     */
    BybitMarketData.prototype.getServerTime = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, timeSeconds, MILLISECONDS_IN_SECOND;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.restClient.getServerTime()];
                                    case 1:
                                        response = _a.sent();
                                        if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                        }
                                        timeSeconds = response.result.timeSecond;
                                        if (timeSeconds === undefined || timeSeconds === null) {
                                            throw new Error('Server time not received');
                                        }
                                        MILLISECONDS_IN_SECOND = 1000;
                                        return [2 /*return*/, Number(timeSeconds) * MILLISECONDS_IN_SECOND];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // ORDER BOOK
    // ==========================================================================
    /**
     * Get order book (market depth)
     *
     * @param symbol - Trading symbol (default: this.symbol)
     * @param limit - Number of levels to fetch (default: 50, max: 500)
     * @returns Order book data with bids and asks
     */
    BybitMarketData.prototype.getOrderBook = function (symbol_1) {
        return __awaiter(this, arguments, void 0, function (symbol, limit) {
            var targetSymbol;
            var _this = this;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        targetSymbol = symbol || this.symbol;
                        return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response, orderbook, bids, asks;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.restClient.getOrderbook({
                                                category: 'linear',
                                                symbol: targetSymbol,
                                                limit: limit,
                                            })];
                                        case 1:
                                            response = _a.sent();
                                            if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                                throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                            }
                                            orderbook = response.result;
                                            if (!orderbook.b || !orderbook.a) {
                                                throw new Error('Invalid order book data');
                                            }
                                            bids = orderbook.b.map(function (level) { return ({
                                                price: parseFloat(level[0]),
                                                quantity: parseFloat(level[1]),
                                            }); });
                                            asks = orderbook.a.map(function (level) { return ({
                                                price: parseFloat(level[0]),
                                                quantity: parseFloat(level[1]),
                                            }); });
                                            return [2 /*return*/, {
                                                    bids: bids,
                                                    asks: asks,
                                                    timestamp: typeof orderbook.ts === 'string' ? parseInt(orderbook.ts) : orderbook.ts,
                                                }];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // FUNDING RATE
    // ==========================================================================
    /**
     * Get current funding rate and next funding time
     *
     * @param symbol - Symbol (e.g., "APEXUSDT")
     * @returns Funding rate data
     */
    BybitMarketData.prototype.getFundingRate = function (symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var targetSymbol;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        targetSymbol = symbol || this.symbol;
                        return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response, fundingHistory, latest;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, this.restClient.getFundingRateHistory({
                                                category: 'linear',
                                                symbol: targetSymbol,
                                                limit: 1, // Get only latest funding rate
                                            })];
                                        case 1:
                                            response = _b.sent();
                                            if (response.retCode !== bybit_base_partial_1.BYBIT_SUCCESS_CODE) {
                                                throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                            }
                                            fundingHistory = (_a = response.result) === null || _a === void 0 ? void 0 : _a.list;
                                            if (!fundingHistory || fundingHistory.length === 0) {
                                                throw new Error('No funding rate data available');
                                            }
                                            latest = fundingHistory[0];
                                            return [2 /*return*/, {
                                                    fundingRate: parseFloat(latest.fundingRate),
                                                    timestamp: typeof latest.fundingRateTimestamp === 'string'
                                                        ? parseInt(latest.fundingRateTimestamp)
                                                        : latest.fundingRateTimestamp,
                                                    nextFundingTime: typeof latest.fundingRateTimestamp === 'string'
                                                        ? parseInt(latest.fundingRateTimestamp) + 8 * 60 * 60 * 1000 // +8 hours
                                                        : latest.fundingRateTimestamp + 8 * 60 * 60 * 1000,
                                                }];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return BybitMarketData;
}(bybit_base_partial_1.BybitBase));
exports.BybitMarketData = BybitMarketData;
