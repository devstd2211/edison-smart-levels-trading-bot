"use strict";
/**
 * Types and Enums for Trading Bot
 * ALL types in ONE file - NO duplication!
 *
 * Rules:
 * - Only enums, NO string literals
 * - All constants as enums
 * - Descriptive names, no abbreviations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = exports.BreakevenMode = exports.StopLossType = exports.EMACrossover = exports.StructureDirection = exports.StructureEventType = exports.ContextFilteringMode = exports.TrendBias = exports.MarketStructure = exports.SwingPointType = exports.LogLevel = exports.TimeframeRole = exports.TrendType = exports.ExitType = exports.OrderType = exports.PositionSide = exports.SignalType = exports.SignalDirection = void 0;
// ============================================================================
// ENUMS (ALL CONSTANTS)
// ============================================================================
/**
 * Signal direction enum
 */
var SignalDirection;
(function (SignalDirection) {
    SignalDirection["LONG"] = "LONG";
    SignalDirection["SHORT"] = "SHORT";
    SignalDirection["HOLD"] = "HOLD";
})(SignalDirection || (exports.SignalDirection = SignalDirection = {}));
/**
 * Signal type (strategy type)
 */
var SignalType;
(function (SignalType) {
    SignalType["LEVEL_BASED"] = "LEVEL_BASED";
    SignalType["TREND_FOLLOWING"] = "TREND_FOLLOWING";
    SignalType["COUNTER_TREND"] = "COUNTER_TREND";
    SignalType["REVERSAL"] = "REVERSAL";
    SignalType["WHALE_HUNTER"] = "WHALE_HUNTER";
    SignalType["WHALE_HUNTER_FOLLOW"] = "WHALE_HUNTER_FOLLOW";
})(SignalType || (exports.SignalType = SignalType = {}));
/**
 * Position side for futures
 */
var PositionSide;
(function (PositionSide) {
    PositionSide["LONG"] = "LONG";
    PositionSide["SHORT"] = "SHORT";
})(PositionSide || (exports.PositionSide = PositionSide = {}));
/**
 * Order type
 */
var OrderType;
(function (OrderType) {
    OrderType["MARKET"] = "MARKET";
    OrderType["LIMIT"] = "LIMIT";
})(OrderType || (exports.OrderType = OrderType = {}));
/**
 * Exit type (why position was closed)
 */
var ExitType;
(function (ExitType) {
    ExitType["STOP_LOSS"] = "STOP_LOSS";
    ExitType["TAKE_PROFIT_1"] = "TAKE_PROFIT_1";
    ExitType["TAKE_PROFIT_2"] = "TAKE_PROFIT_2";
    ExitType["TAKE_PROFIT_3"] = "TAKE_PROFIT_3";
    ExitType["TRAILING_STOP"] = "TRAILING_STOP";
    ExitType["MANUAL"] = "MANUAL";
    ExitType["TIME_BASED_EXIT"] = "TIME_BASED_EXIT";
    ExitType["LIQUIDATION"] = "LIQUIDATION";
})(ExitType || (exports.ExitType = ExitType = {}));
/**
 * Trend type classification
 */
var TrendType;
(function (TrendType) {
    TrendType["STRONG_BULL"] = "STRONG_BULL";
    TrendType["BULL"] = "BULL";
    TrendType["NEUTRAL"] = "NEUTRAL";
    TrendType["BEAR"] = "BEAR";
    TrendType["STRONG_BEAR"] = "STRONG_BEAR";
})(TrendType || (exports.TrendType = TrendType = {}));
/**
 * Timeframe role in multi-timeframe analysis
 */
var TimeframeRole;
(function (TimeframeRole) {
    TimeframeRole["ENTRY"] = "ENTRY";
    TimeframeRole["PRIMARY"] = "PRIMARY";
    TimeframeRole["TREND1"] = "TREND1";
    TimeframeRole["TREND2"] = "TREND2";
    TimeframeRole["CONTEXT"] = "CONTEXT";
})(TimeframeRole || (exports.TimeframeRole = TimeframeRole = {}));
/**
 * Log level
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Swing point type for ZigZag
 */
var SwingPointType;
(function (SwingPointType) {
    SwingPointType["HIGH"] = "HIGH";
    SwingPointType["LOW"] = "LOW";
})(SwingPointType || (exports.SwingPointType = SwingPointType = {}));
/**
 * Market structure patterns (ZigZag analysis)
 */
var MarketStructure;
(function (MarketStructure) {
    MarketStructure["HIGHER_HIGH"] = "HH";
    MarketStructure["HIGHER_LOW"] = "HL";
    MarketStructure["LOWER_HIGH"] = "LH";
    MarketStructure["LOWER_LOW"] = "LL";
    MarketStructure["EQUAL_HIGH"] = "EH";
    MarketStructure["EQUAL_LOW"] = "EL";
})(MarketStructure || (exports.MarketStructure = MarketStructure = {}));
/**
 * Trend bias (direction)
 */
var TrendBias;
(function (TrendBias) {
    TrendBias["BULLISH"] = "BULLISH";
    TrendBias["BEARISH"] = "BEARISH";
    TrendBias["NEUTRAL"] = "NEUTRAL";
})(TrendBias || (exports.TrendBias = TrendBias = {}));
/**
 * Context filtering mode
 */
var ContextFilteringMode;
(function (ContextFilteringMode) {
    ContextFilteringMode["HARD_BLOCK"] = "HARD_BLOCK";
    ContextFilteringMode["WEIGHT_BASED"] = "WEIGHT_BASED";
})(ContextFilteringMode || (exports.ContextFilteringMode = ContextFilteringMode = {}));
/**
 * Market structure event type (CHoCH/BoS)
 */
var StructureEventType;
(function (StructureEventType) {
    StructureEventType["CHoCH"] = "CHoCH";
    StructureEventType["BoS"] = "BoS";
})(StructureEventType || (exports.StructureEventType = StructureEventType = {}));
/**
 * Structure event direction
 */
var StructureDirection;
(function (StructureDirection) {
    StructureDirection["BULLISH"] = "BULLISH";
    StructureDirection["BEARISH"] = "BEARISH";
})(StructureDirection || (exports.StructureDirection = StructureDirection = {}));
/**
 * EMA crossover state
 */
var EMACrossover;
(function (EMACrossover) {
    EMACrossover["BULLISH"] = "BULLISH";
    EMACrossover["BEARISH"] = "BEARISH";
    EMACrossover["NONE"] = "NONE";
})(EMACrossover || (exports.EMACrossover = EMACrossover = {}));
/**
 * Stop Loss calculation type priority
 * Priority order: SWEEP > ORDER_BLOCK > SWING > LEVEL > ATR > PERCENT
 */
var StopLossType;
(function (StopLossType) {
    StopLossType["SWEEP"] = "SWEEP";
    StopLossType["ORDER_BLOCK"] = "ORDER_BLOCK";
    StopLossType["SWING"] = "SWING";
    StopLossType["LEVEL"] = "LEVEL";
    StopLossType["ATR"] = "ATR";
    StopLossType["PERCENT"] = "PERCENT";
})(StopLossType || (exports.StopLossType = StopLossType = {}));
/**
 * Breakeven mode states
 */
var BreakevenMode;
(function (BreakevenMode) {
    BreakevenMode["NONE"] = "NONE";
    BreakevenMode["PRE_BE"] = "PRE_BE";
    BreakevenMode["BE_ACTIVE"] = "BE_ACTIVE";
})(BreakevenMode || (exports.BreakevenMode = BreakevenMode = {}));
// ============================================================================
// SERVICE EXPORTS
// ============================================================================
var logger_service_1 = require("./services/logger.service");
Object.defineProperty(exports, "LoggerService", { enumerable: true, get: function () { return logger_service_1.LoggerService; } });
