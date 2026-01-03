"use strict";
/**
 * Logger Service
 *
 * Centralized logging service with file and console support
 * Features:
 * - File logging with daily rotation
 * - Console logging with colors
 * - Async queue-based file writes
 * - 7-day log cleanup
 *
 * RULE: NO fallbacks, FAIL FAST
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
var fs_1 = require("fs");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var types_1 = require("../types");
var LOG_LEVEL_PRIORITY = (_a = {},
    _a[types_1.LogLevel.DEBUG] = 0,
    _a[types_1.LogLevel.INFO] = 1,
    _a[types_1.LogLevel.WARN] = 2,
    _a[types_1.LogLevel.ERROR] = 3,
    _a);
var LoggerService = /** @class */ (function () {
    function LoggerService(minLevel, logDir, logToFile) {
        if (minLevel === void 0) { minLevel = types_1.LogLevel.INFO; }
        if (logDir === void 0) { logDir = './logs'; }
        if (logToFile === void 0) { logToFile = true; }
        this.logs = [];
        this.writeQueue = [];
        this.isProcessingQueue = false;
        this.minLevel = minLevel;
        this.logDir = logDir;
        this.logToFile = logToFile;
        if (this.logToFile) {
            this.ensureLogDirectory();
            // Start cleanup in background
            void this.cleanOldLogs();
        }
    }
    /**
     * Ensure log directory exists
     */
    LoggerService.prototype.ensureLogDirectory = function () {
        if (!(0, fs_1.existsSync)(this.logDir)) {
            (0, fs_1.mkdirSync)(this.logDir, { recursive: true });
            console.log("\uD83D\uDCC1 Created log directory: ".concat(this.logDir));
        }
    };
    /**
     * Clean old log files (>7 days)
     */
    LoggerService.prototype.cleanOldLogs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, readdir, stat, unlink, files, now, maxAge, _i, files_1, file, filePath, stats, age, daysOld, fileError_1, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 11, , 12]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                    case 1:
                        _a = _b.sent(), readdir = _a.readdir, stat = _a.stat, unlink = _a.unlink;
                        return [4 /*yield*/, readdir(this.logDir)];
                    case 2:
                        files = _b.sent();
                        now = Date.now();
                        maxAge = 7 * 24 * 60 * 60 * 1000;
                        _i = 0, files_1 = files;
                        _b.label = 3;
                    case 3:
                        if (!(_i < files_1.length)) return [3 /*break*/, 10];
                        file = files_1[_i];
                        if (!file.endsWith('.log'))
                            return [3 /*break*/, 9];
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 8, , 9]);
                        filePath = (0, path_1.join)(this.logDir, file);
                        return [4 /*yield*/, stat(filePath)];
                    case 5:
                        stats = _b.sent();
                        age = now - stats.mtime.getTime();
                        if (!(age > maxAge)) return [3 /*break*/, 7];
                        return [4 /*yield*/, unlink(filePath)];
                    case 6:
                        _b.sent();
                        daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                        console.log("\uD83D\uDDD1\uFE0F Deleted old log file: ".concat(file, " (").concat(daysOld, " days old)"));
                        _b.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        fileError_1 = _b.sent();
                        console.error("Failed to process log file ".concat(file, ":"), fileError_1);
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 3];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_1 = _b.sent();
                        console.error('Failed to clean old log files:', error_1);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get today's date string for filename
     */
    LoggerService.prototype.getTodayString = function () {
        var today = new Date().toISOString().split('T')[0];
        if (!today)
            throw new Error('Failed to get date string');
        return today;
    };
    /**
     * Format log entry as string
     */
    LoggerService.prototype.formatLogEntry = function (entry) {
        var timestamp = new Date(entry.timestamp).toISOString();
        var contextStr = entry.context ? " | ".concat(JSON.stringify(entry.context)) : '';
        return "[".concat(timestamp, "] [").concat(entry.level, "] ").concat(entry.message).concat(contextStr);
    };
    /**
     * Write log entry to file (async queue)
     */
    LoggerService.prototype.writeToFile = function (entry) {
        if (!this.logToFile)
            return;
        var today = this.getTodayString();
        var fileName = "trading-bot-".concat(today, ".log");
        var filePath = (0, path_1.join)(this.logDir, fileName);
        var logLine = this.formatLogEntry(entry) + '\n';
        this.writeQueue.push({ filePath: filePath, content: logLine });
        void this.processWriteQueue();
    };
    /**
     * Process write queue asynchronously
     */
    LoggerService.prototype.processWriteQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fileGroups, batchSize, batch, _i, batch_1, _a, filePath, content, writePromises;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.isProcessingQueue || this.writeQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        this.isProcessingQueue = true;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        fileGroups = new Map();
                        batchSize = Math.min(10, this.writeQueue.length);
                        batch = this.writeQueue.splice(0, batchSize);
                        for (_i = 0, batch_1 = batch; _i < batch_1.length; _i++) {
                            _a = batch_1[_i], filePath = _a.filePath, content = _a.content;
                            if (!fileGroups.has(filePath)) {
                                fileGroups.set(filePath, []);
                            }
                            fileGroups.get(filePath).push(content);
                        }
                        writePromises = Array.from(fileGroups.entries()).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var combinedContent, error_2;
                            var filePath = _b[0], contents = _b[1];
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 2, , 3]);
                                        combinedContent = contents.join('');
                                        return [4 /*yield*/, (0, promises_1.appendFile)(filePath, combinedContent)];
                                    case 1:
                                        _c.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_2 = _c.sent();
                                        console.error("Failed to write to log file ".concat(filePath, ":"), error_2);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(writePromises)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this.isProcessingQueue = false;
                        // Process remaining queue
                        if (this.writeQueue.length > 0) {
                            setImmediate(function () { return void _this.processWriteQueue(); });
                        }
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Write log entry to console with colors
     */
    LoggerService.prototype.writeToConsole = function (entry) {
        var formattedMessage = this.formatLogEntry(entry);
        switch (entry.level) {
            case types_1.LogLevel.DEBUG:
                console.debug('\x1b[36m%s\x1b[0m', formattedMessage); // Cyan
                break;
            case types_1.LogLevel.INFO:
                console.info('\x1b[32m%s\x1b[0m', formattedMessage); // Green
                break;
            case types_1.LogLevel.WARN:
                console.warn('\x1b[33m%s\x1b[0m', formattedMessage); // Yellow
                break;
            case types_1.LogLevel.ERROR:
                console.error('\x1b[31m%s\x1b[0m', formattedMessage); // Red
                break;
        }
    };
    /**
     * Log debug message
     */
    LoggerService.prototype.debug = function (message, context) {
        this.log(types_1.LogLevel.DEBUG, message, context);
    };
    /**
     * Log info message
     */
    LoggerService.prototype.info = function (message, context) {
        this.log(types_1.LogLevel.INFO, message, context);
    };
    /**
     * Log warning message
     */
    LoggerService.prototype.warn = function (message, context) {
        this.log(types_1.LogLevel.WARN, message, context);
    };
    /**
     * Log error message
     */
    LoggerService.prototype.error = function (message, context) {
        this.log(types_1.LogLevel.ERROR, message, context);
    };
    /**
     * Internal log method
     */
    LoggerService.prototype.log = function (level, message, context) {
        var levelPriority = LOG_LEVEL_PRIORITY[level];
        var minPriority = LOG_LEVEL_PRIORITY[this.minLevel];
        if (levelPriority < minPriority) {
            return; // Skip logs below minimum level
        }
        var entry = {
            level: level,
            message: message,
            timestamp: Date.now(),
            context: context,
        };
        this.logs.push(entry);
        this.writeToConsole(entry);
        this.writeToFile(entry);
    };
    /**
     * Get all logs
     */
    LoggerService.prototype.getLogs = function () {
        return __spreadArray([], this.logs, true);
    };
    /**
     * Get logs by level
     */
    LoggerService.prototype.getLogsByLevel = function (level) {
        return this.logs.filter(function (log) { return log.level === level; });
    };
    /**
     * Clear logs
     */
    LoggerService.prototype.clear = function () {
        this.logs = [];
    };
    /**
     * Get current log file path
     */
    LoggerService.prototype.getLogFilePath = function () {
        if (!this.logToFile)
            return null;
        var today = this.getTodayString();
        var fileName = "trading-bot-".concat(today, ".log");
        return (0, path_1.join)(this.logDir, fileName);
    };
    return LoggerService;
}());
exports.LoggerService = LoggerService;
