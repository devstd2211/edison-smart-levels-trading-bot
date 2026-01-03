"use strict";
/**
 * SQLite Data Provider
 *
 * Reads historical candle data from SQLite database (market-data.db)
 * Schema: candles table with columns: symbol, timeframe, timestamp, open, high, low, close, volume
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
exports.SqliteDataProvider = void 0;
var sqlite3Import = require("sqlite3");
var sqlite_1 = require("sqlite");
var path = require("path");
var util_1 = require("util");
var zlib_1 = require("zlib");
var sqlite3 = sqlite3Import.verbose();
var gunzipAsync = (0, util_1.promisify)(zlib_1.gunzip);
var SqliteDataProvider = /** @class */ (function () {
    function SqliteDataProvider(dbPath) {
        if (dbPath === void 0) { dbPath = path.join(__dirname, '../../data/market-data.db'); }
        this.db = null;
        this.dbPath = dbPath;
    }
    /**
     * Open database connection
     */
    SqliteDataProvider.prototype.openDatabase = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.db)
                            return [2 /*return*/, this.db];
                        _a = this;
                        return [4 /*yield*/, (0, sqlite_1.open)({
                                filename: this.dbPath,
                                driver: sqlite3.Database,
                            })];
                    case 1:
                        _a.db = _b.sent();
                        return [2 /*return*/, this.db];
                }
            });
        });
    };
    /**
     * Close database connection
     */
    SqliteDataProvider.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.db) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.db.close()];
                    case 1:
                        _a.sent();
                        this.db = null;
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load candles from SQLite database
     */
    SqliteDataProvider.prototype.loadCandles = function (symbol, startTime, endTime) {
        return __awaiter(this, void 0, void 0, function () {
            var db, timeFilter, params, candles1m, candles5m, candles15m;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCE5 Loading data from SQLite database (".concat(this.dbPath, ")..."));
                        return [4 /*yield*/, this.openDatabase()];
                    case 1:
                        db = _a.sent();
                        timeFilter = '';
                        params = { symbol: symbol };
                        if (startTime && endTime) {
                            timeFilter = 'AND timestamp >= :startTime AND timestamp <= :endTime';
                            params.startTime = startTime;
                            params.endTime = endTime;
                        }
                        else if (startTime) {
                            timeFilter = 'AND timestamp >= :startTime';
                            params.startTime = startTime;
                        }
                        else if (endTime) {
                            timeFilter = 'AND timestamp <= :endTime';
                            params.endTime = endTime;
                        }
                        // Load 1m candles
                        console.log("  - Querying 1m candles...");
                        return [4 /*yield*/, db.all("SELECT timestamp, open, high, low, close, volume\n       FROM candles\n       WHERE symbol = ? AND timeframe = '1m' ".concat(timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?'), "\n       ORDER BY timestamp ASC"), startTime && endTime
                                ? [symbol, startTime, endTime]
                                : startTime
                                    ? [symbol, startTime]
                                    : endTime
                                        ? [symbol, endTime]
                                        : [symbol])];
                    case 2:
                        candles1m = _a.sent();
                        // Load 5m candles
                        console.log("  - Querying 5m candles...");
                        return [4 /*yield*/, db.all("SELECT timestamp, open, high, low, close, volume\n       FROM candles\n       WHERE symbol = ? AND timeframe = '5m' ".concat(timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?'), "\n       ORDER BY timestamp ASC"), startTime && endTime
                                ? [symbol, startTime, endTime]
                                : startTime
                                    ? [symbol, startTime]
                                    : endTime
                                        ? [symbol, endTime]
                                        : [symbol])];
                    case 3:
                        candles5m = _a.sent();
                        // Load 15m candles
                        console.log("  - Querying 15m candles...");
                        return [4 /*yield*/, db.all("SELECT timestamp, open, high, low, close, volume\n       FROM candles\n       WHERE symbol = ? AND timeframe = '15m' ".concat(timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?'), "\n       ORDER BY timestamp ASC"), startTime && endTime
                                ? [symbol, startTime, endTime]
                                : startTime
                                    ? [symbol, startTime]
                                    : endTime
                                        ? [symbol, endTime]
                                        : [symbol])];
                    case 4:
                        candles15m = _a.sent();
                        console.log("\u2705 Loaded: ".concat(candles1m.length, " 1m, ").concat(candles5m.length, " 5m, ").concat(candles15m.length, " 15m candles"));
                        // Check if we have data
                        if (candles1m.length === 0 || candles5m.length === 0 || candles15m.length === 0) {
                            throw new Error("Insufficient data in SQLite for ".concat(symbol, ". Found: 1m=").concat(candles1m.length, ", 5m=").concat(candles5m.length, ", 15m=").concat(candles15m.length));
                        }
                        return [2 /*return*/, {
                                candles1m: candles1m,
                                candles5m: candles5m,
                                candles15m: candles15m,
                            }];
                }
            });
        });
    };
    SqliteDataProvider.prototype.getSourceName = function () {
        return 'SQLite Database';
    };
    /**
     * Load orderbook snapshot for a specific timestamp
     * Finds the closest orderbook snapshot to the given timestamp (within 60 seconds)
     */
    SqliteDataProvider.prototype.loadOrderbookForCandle = function (symbol, timestamp) {
        return __awaiter(this, void 0, void 0, function () {
            var db, snapshot, bidsBuffer, asksBuffer, bidsDecompressed, asksDecompressed, bids, asks, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.openDatabase()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.get("SELECT timestamp, bids, asks\n       FROM orderbook_snapshots\n       WHERE symbol = ? AND ABS(timestamp - ?) <= 60000\n       ORDER BY ABS(timestamp - ?) ASC\n       LIMIT 1", [symbol, timestamp, timestamp])];
                    case 2:
                        snapshot = _a.sent();
                        if (!snapshot) {
                            return [2 /*return*/, null];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 6, , 7]);
                        bidsBuffer = Buffer.from(snapshot.bids);
                        asksBuffer = Buffer.from(snapshot.asks);
                        return [4 /*yield*/, gunzipAsync(bidsBuffer)];
                    case 4:
                        bidsDecompressed = _a.sent();
                        return [4 /*yield*/, gunzipAsync(asksBuffer)];
                    case 5:
                        asksDecompressed = _a.sent();
                        bids = JSON.parse(bidsDecompressed.toString());
                        asks = JSON.parse(asksDecompressed.toString());
                        return [2 /*return*/, {
                                symbol: symbol,
                                timestamp: snapshot.timestamp,
                                bids: bids,
                                asks: asks,
                                updateId: 0, // Not tracked in database
                            }];
                    case 6:
                        error_1 = _a.sent();
                        console.error("Failed to decompress orderbook snapshot:", error_1);
                        return [2 /*return*/, null];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return SqliteDataProvider;
}());
exports.SqliteDataProvider = SqliteDataProvider;
