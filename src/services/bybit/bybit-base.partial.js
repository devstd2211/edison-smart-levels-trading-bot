"use strict";
/**
 * Bybit Base Partial - Shared Utilities
 *
 * Provides common functionality used by all Bybit partial classes:
 * - Symbol precision management (qtyStep, tickSize)
 * - Retry logic with exponential backoff
 * - Rounding utilities (quantity, price)
 * - Error handling
 * - Constants
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
exports.BybitBase = exports.PERCENT_TO_DECIMAL = exports.POSITION_IDX_ONE_WAY = exports.BYBIT_ZERO_POSITION_CODE = exports.BYBIT_ORDER_NOT_EXISTS_CODE = exports.BYBIT_ORDER_STATUS_CODE = exports.BYBIT_NOT_MODIFIED_CODE = exports.BYBIT_SUCCESS_CODE = exports.POSITION_SIZE_ZERO = exports.DEFAULT_CANDLE_LIMIT = exports.RETRY_BACKOFF_MULTIPLIER = exports.RETRY_DELAY_MS = exports.MAX_RETRIES = exports.RECV_WINDOW = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
exports.RECV_WINDOW = 20000; // Increased from 5000 to handle clock drift
exports.MAX_RETRIES = 3;
exports.RETRY_DELAY_MS = 1000;
exports.RETRY_BACKOFF_MULTIPLIER = 2;
exports.DEFAULT_CANDLE_LIMIT = 200;
exports.POSITION_SIZE_ZERO = 0;
exports.BYBIT_SUCCESS_CODE = 0;
exports.BYBIT_NOT_MODIFIED_CODE = 34039; // "order not modified" - price already at target
exports.BYBIT_ORDER_STATUS_CODE = 34040; // "order does not exist or status does not support modification"
exports.BYBIT_ORDER_NOT_EXISTS_CODE = 110001; // "order not exists or too late to cancel"
exports.BYBIT_ZERO_POSITION_CODE = 10001; // "can not set tp/sl/ts for zero position"
exports.POSITION_IDX_ONE_WAY = 0;
exports.PERCENT_TO_DECIMAL = 100;
// ============================================================================
// BYBIT BASE PARTIAL
// ============================================================================
var BybitBase = /** @class */ (function () {
    function BybitBase(restClient, symbol, timeframe, logger, demo) {
        // Symbol precision parameters (loaded from exchange)
        this.qtyStep = null;
        this.tickSize = null;
        this.minOrderQty = null;
        // Time synchronization (stored offset: local - server)
        this.timeOffsetMs = 0;
        this.restClient = restClient;
        this.symbol = symbol;
        this.timeframe = timeframe;
        this.logger = logger;
        this.demo = demo;
    }
    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    /**
     * Initialize service - load symbol precision parameters
     * Must be called after construction, before trading
     */
    BybitBase.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var serverTimeResponse, serverTime, localTime, timeDrift, error_1, symbolInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.info('Initializing BybitService - loading symbol info...');
                        // Sync time with Bybit server to prevent timestamp errors
                        this.logger.info('Synchronizing time with exchange...');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.restClient.getServerTime()];
                    case 2:
                        serverTimeResponse = _a.sent();
                        if (serverTimeResponse.retCode === exports.BYBIT_SUCCESS_CODE) {
                            serverTime = parseInt(serverTimeResponse.result.timeSecond) * 1000;
                            localTime = Date.now();
                            timeDrift = localTime - serverTime;
                            // Store time offset (positive = local clock is ahead)
                            this.timeOffsetMs = timeDrift;
                            this.logger.info('Time synchronized with Bybit server', {
                                serverTime: serverTime,
                                localTime: localTime,
                                offsetMs: this.timeOffsetMs,
                                offsetOk: Math.abs(this.timeOffsetMs) < 500,
                            });
                            if (Math.abs(this.timeOffsetMs) > 500) {
                                this.logger.warn('⚠️ Clock drift detected - applying offset correction', {
                                    offsetMs: this.timeOffsetMs,
                                });
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        this.logger.warn('Failed to sync time, continuing without sync', {
                            error: String(error_1),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [4 /*yield*/, this.getSymbolInfo()];
                    case 5:
                        symbolInfo = _a.sent();
                        this.qtyStep = symbolInfo.qtyStep;
                        this.tickSize = symbolInfo.tickSize;
                        this.minOrderQty = symbolInfo.minOrderQty;
                        this.logger.info('Symbol precision loaded', {
                            symbol: this.symbol,
                            qtyStep: this.qtyStep,
                            tickSize: this.tickSize,
                            minOrderQty: this.minOrderQty,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get symbol trading parameters from exchange
     */
    BybitBase.prototype.getSymbolInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, instrument, qtyStep, tickSize, minOrderQty;
                            var _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0: return [4 /*yield*/, this.restClient.getInstrumentsInfo({
                                            category: 'linear',
                                            symbol: this.symbol,
                                        })];
                                    case 1:
                                        response = _e.sent();
                                        if (response.retCode !== exports.BYBIT_SUCCESS_CODE || !((_a = response.result) === null || _a === void 0 ? void 0 : _a.list) || response.result.list.length === 0) {
                                            throw new Error("Failed to get symbol info for ".concat(this.symbol, ": ").concat(response.retMsg));
                                        }
                                        instrument = response.result.list[0];
                                        qtyStep = ((_b = instrument.lotSizeFilter) === null || _b === void 0 ? void 0 : _b.qtyStep) || '0.01';
                                        tickSize = ((_c = instrument.priceFilter) === null || _c === void 0 ? void 0 : _c.tickSize) || '0.0001';
                                        minOrderQty = ((_d = instrument.lotSizeFilter) === null || _d === void 0 ? void 0 : _d.minOrderQty) || '0.01';
                                        this.logger.debug('Symbol info received', {
                                            symbol: this.symbol,
                                            qtyStep: qtyStep,
                                            tickSize: tickSize,
                                            minOrderQty: minOrderQty,
                                        });
                                        return [2 /*return*/, { qtyStep: qtyStep, tickSize: tickSize, minOrderQty: minOrderQty }];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get exchange limits for position calculations
     */
    BybitBase.prototype.getExchangeLimits = function () {
        if (!this.qtyStep || !this.tickSize || !this.minOrderQty) {
            throw new Error('Exchange limits not initialized - call initialize() first');
        }
        return {
            qtyStep: this.qtyStep,
            tickSize: this.tickSize,
            minOrderQty: this.minOrderQty,
        };
    };
    // ==========================================================================
    // ROUNDING UTILITIES
    // ==========================================================================
    /**
     * Round quantity to qtyStep precision
     * Example: qty=99.8901, qtyStep=0.01 => 99.89
     *
     * NOTE: This method is DEPRECATED - use PositionCalculatorService instead!
     * Kept only for backward compatibility with existing code (BybitOrders, BybitPositions).
     */
    BybitBase.prototype.roundQuantity = function (qty) {
        // Fallback for backward compatibility (e.g., emergency protection calls)
        var step = this.qtyStep || '0.1';
        var stepNum = parseFloat(step);
        var rounded = Math.floor(qty / stepNum) * stepNum;
        // Format to match step precision (count decimals in step)
        var decimals = (step.split('.')[1] || '').length;
        var result = rounded.toFixed(decimals);
        this.logger.debug('🔢 roundQuantity (DEPRECATED)', {
            input: qty,
            qtyStep: step,
            stepNum: stepNum,
            rounded: rounded,
            decimals: decimals,
            result: result,
            qtyStepLoaded: this.qtyStep !== null,
        });
        return result;
    };
    /**
     * Round price to tickSize precision
     * Example: price=1.00249, tickSize=0.0001 => 1.0024
     *
     * NOTE: This method is DEPRECATED - use PositionCalculatorService instead!
     * Kept only for backward compatibility with existing code (BybitOrders).
     */
    BybitBase.prototype.roundPrice = function (price) {
        // Fallback for backward compatibility
        var tick = this.tickSize || '0.0001';
        var tickNum = parseFloat(tick);
        var rounded = Math.floor(price / tickNum) * tickNum;
        // Format to match tick precision
        var decimals = (tick.split('.')[1] || '').length;
        return rounded.toFixed(decimals);
    };
    // ==========================================================================
    // BALANCE
    // ==========================================================================
    /**
     * Get USDT balance
     */
    BybitBase.prototype.getBalance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retry(function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, coins, usdtCoin;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, this.restClient.getWalletBalance({
                                            accountType: 'UNIFIED',
                                            coin: 'USDT',
                                        })];
                                    case 1:
                                        response = _b.sent();
                                        if (response.retCode !== exports.BYBIT_SUCCESS_CODE) {
                                            throw new Error("Bybit API error: ".concat(response.retMsg, " (code: ").concat(response.retCode, ")"));
                                        }
                                        coins = (_a = response.result.list[0]) === null || _a === void 0 ? void 0 : _a.coin;
                                        if (coins === undefined || coins.length === 0) {
                                            throw new Error('USDT balance not found');
                                        }
                                        usdtCoin = coins.find(function (c) { return c.coin === 'USDT'; });
                                        if (usdtCoin === undefined) {
                                            throw new Error('USDT not found in wallet');
                                        }
                                        return [2 /*return*/, parseFloat(usdtCoin.walletBalance)];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ==========================================================================
    // RETRY LOGIC
    // ==========================================================================
    /**
     * Retry logic with exponential backoff
     */
    BybitBase.prototype.retry = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            var lastError, attempt, error_2, delay;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        lastError = null;
                        attempt = 0;
                        _b.label = 1;
                    case 1:
                        if (!(attempt < exports.MAX_RETRIES)) return [3 /*break*/, 8];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 7]);
                        return [4 /*yield*/, fn()];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4:
                        error_2 = _b.sent();
                        lastError = this.handleError(error_2);
                        // Don't retry on auth errors
                        if (lastError.message.includes('auth') || lastError.message.includes('API key')) {
                            throw lastError;
                        }
                        if (!(attempt < exports.MAX_RETRIES - 1)) return [3 /*break*/, 6];
                        delay = exports.RETRY_DELAY_MS * Math.pow(exports.RETRY_BACKOFF_MULTIPLIER, attempt);
                        this.logger.warn("Retry attempt ".concat(attempt + 1, "/").concat(exports.MAX_RETRIES), { delay: delay, error: lastError.message });
                        return [4 /*yield*/, this.sleep(delay)];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6: return [3 /*break*/, 7];
                    case 7:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 8: throw new Error("Failed after ".concat(exports.MAX_RETRIES, " retries: ").concat((_a = lastError === null || lastError === void 0 ? void 0 : lastError.message) !== null && _a !== void 0 ? _a : 'Unknown error'));
                }
            });
        });
    };
    // ==========================================================================
    // ERROR HANDLING
    // ==========================================================================
    /**
     * Handle and format errors
     */
    BybitBase.prototype.handleError = function (error) {
        if (error instanceof Error) {
            return error;
        }
        return new Error("Unknown error: ".concat(String(error)));
    };
    /**
     * Get corrected timestamp for Bybit API requests
     * Applies time offset to prevent timestamp errors
     */
    BybitBase.prototype.getCorrectedTimestamp = function () {
        return Date.now() - this.timeOffsetMs;
    };
    /**
     * Sleep helper
     */
    BybitBase.prototype.sleep = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    return BybitBase;
}());
exports.BybitBase = BybitBase;
