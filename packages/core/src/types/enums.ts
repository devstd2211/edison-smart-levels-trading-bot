/**
 * Edison Trading Bot - All Enums
 * Centralized enum definitions for type safety
 */

// ============================================================================
// SIGNAL & DIRECTION ENUMS
// ============================================================================

/**
 * Signal direction enum
 */
export enum SignalDirection {
  LONG = 'LONG',
  SHORT = 'SHORT',
  HOLD = 'HOLD',
}

/**
 * Signal type (strategy type)
 */
export enum SignalType {
  LEVEL_BASED = 'LEVEL_BASED',
  TREND_FOLLOWING = 'TREND_FOLLOWING',
  COUNTER_TREND = 'COUNTER_TREND',
  REVERSAL = 'REVERSAL',
  WHALE_HUNTER = 'WHALE_HUNTER',
  WHALE_HUNTER_FOLLOW = 'WHALE_HUNTER_FOLLOW',
  SCALPING_MICRO_WALL = 'SCALPING_MICRO_WALL',
  SCALPING_TICK_DELTA = 'SCALPING_TICK_DELTA',
  SCALPING_LADDER_TP = 'SCALPING_LADDER_TP',
  SCALPING_LIMIT_ORDER = 'SCALPING_LIMIT_ORDER',
  SCALPING_ORDER_FLOW = 'SCALPING_ORDER_FLOW',
  EDGE_REVERSALS = 'EDGE_REVERSALS',
  FRACTAL_BREAKOUT_RETEST = 'FRACTAL_BREAKOUT_RETEST',
}

// ============================================================================
// POSITION & ORDER ENUMS
// ============================================================================

/**
 * Position side for futures
 */
export enum PositionSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

/**
 * Order type
 */
export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
}

/**
 * Exit type (why position was closed)
 */
export enum ExitType {
  STOP_LOSS = 'STOP_LOSS',
  TAKE_PROFIT_1 = 'TAKE_PROFIT_1',
  TAKE_PROFIT_2 = 'TAKE_PROFIT_2',
  TAKE_PROFIT_3 = 'TAKE_PROFIT_3',
  TRAILING_STOP = 'TRAILING_STOP',
  MANUAL = 'MANUAL',
  TIME_BASED_EXIT = 'TIME_BASED_EXIT',
  LIQUIDATION = 'LIQUIDATION',
}

// ============================================================================
// TREND & MARKET STRUCTURE ENUMS
// ============================================================================

/**
 * Trend type classification
 */
export enum TrendType {
  STRONG_BULL = 'STRONG_BULL',
  BULL = 'BULL',
  NEUTRAL = 'NEUTRAL',
  BEAR = 'BEAR',
  STRONG_BEAR = 'STRONG_BEAR',
}

/**
 * Trend bias (direction)
 */
export enum TrendBias {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

/**
 * Market structure patterns (ZigZag analysis)
 */
export enum MarketStructure {
  HIGHER_HIGH = 'HH',
  HIGHER_LOW = 'HL',
  LOWER_HIGH = 'LH',
  LOWER_LOW = 'LL',
  EQUAL_HIGH = 'EH',
  EQUAL_LOW = 'EL',
}

/**
 * Market structure event type (CHoCH/BoS)
 */
export enum StructureEventType {
  CHoCH = 'CHoCH',
  BoS = 'BoS',
}

/**
 * Structure event direction
 */
export enum StructureDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
}

/**
 * EMA crossover state
 */
export enum EMACrossover {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NONE = 'NONE',
}

// ============================================================================
// TIMEFRAME & CONTEXT ENUMS
// ============================================================================

/**
 * Timeframe role in multi-timeframe analysis
 */
export enum TimeframeRole {
  ENTRY = 'ENTRY',
  PRIMARY = 'PRIMARY',
  TREND1 = 'TREND1',
  TREND2 = 'TREND2',
  CONTEXT = 'CONTEXT',
}

/**
 * Context filtering mode
 */
export enum ContextFilteringMode {
  HARD_BLOCK = 'HARD_BLOCK',
  WEIGHT_BASED = 'WEIGHT_BASED',
}

/**
 * Trading mode for multi-timeframe analysis
 */
export enum TradingMode {
  SWING = 'swing',
  DAY = 'day',
  SCALP = 'scalp',
}

// ============================================================================
// STOP LOSS & EXIT ENUMS
// ============================================================================

/**
 * Stop Loss calculation type priority
 * Priority order: SWEEP > ORDER_BLOCK > SWING > LEVEL > ATR > PERCENT
 */
export enum StopLossType {
  SWEEP = 'SWEEP',
  ORDER_BLOCK = 'ORDER_BLOCK',
  SWING = 'SWING',
  LEVEL = 'LEVEL',
  ATR = 'ATR',
  PERCENT = 'PERCENT',
}

/**
 * Breakeven mode states
 */
export enum BreakevenMode {
  NONE = 'NONE',
  PRE_BE = 'PRE_BE',
  BE_ACTIVE = 'BE_ACTIVE',
}

// ============================================================================
// SWING & TECHNICAL ENUMS
// ============================================================================

/**
 * Swing point type for ZigZag
 */
export enum SwingPointType {
  HIGH = 'HIGH',
  LOW = 'LOW',
}

/**
 * Type of sweep event
 */
export enum SweepType {
  BULLISH_SWEEP = 'BULLISH_SWEEP',
  BEARISH_SWEEP = 'BEARISH_SWEEP',
}

// ============================================================================
// VOLATILITY & REGIME ENUMS
// ============================================================================

/**
 * Volatility regime classification
 */
export enum VolatilityRegime {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// ============================================================================
// BTC CORRELATION ENUMS
// ============================================================================

/**
 * BTC direction enumeration
 */
export enum BTCDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  NEUTRAL = 'NEUTRAL',
}

// ============================================================================
// SMC (SMART MONEY CONCEPTS) ENUMS
// ============================================================================

/**
 * Order Block Type
 */
export enum OrderBlockType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
}

/**
 * Fair Value Gap Type
 */
export enum FVGType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
}

/**
 * Fair Value Gap Status
 */
export enum FVGStatus {
  UNFILLED = 'UNFILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
}

/**
 * Fractal signal type
 */
export enum FractalType {
  SUPPORT = 'FRACTAL_SUPPORT',
  RESISTANCE = 'FRACTAL_RESISTANCE',
}

// ============================================================================
// ORCHESTRATOR ENUMS
// ============================================================================

/**
 * Entry decision from orchestrator
 */
export enum EntryDecision {
  ENTER = 'ENTER',
  SKIP = 'SKIP',
  WAIT = 'WAIT',
}

/**
 * Position state machine
 */
export enum PositionState {
  OPEN = 'OPEN',
  TP1_HIT = 'TP1_HIT',
  TP2_HIT = 'TP2_HIT',
  TP3_HIT = 'TP3_HIT',
  CLOSED = 'CLOSED',
}

/**
 * Exit action type
 */
export enum ExitAction {
  CLOSE_PERCENT = 'CLOSE_PERCENT',
  UPDATE_SL = 'UPDATE_SL',
  ACTIVATE_TRAILING = 'ACTIVATE_TRAILING',
  MOVE_SL_TO_BREAKEVEN = 'MOVE_SL_TO_BREAKEVEN',
  CLOSE_ALL = 'CLOSE_ALL',
}

// ============================================================================
// LOGGING ENUMS
// ============================================================================

/**
 * Log level
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}
