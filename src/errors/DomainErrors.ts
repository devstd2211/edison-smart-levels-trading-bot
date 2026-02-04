/**
 * Domain-specific error classes for the trading system
 * Each domain has specialized error types with relevant properties
 *
 * Domains:
 * - TRADING: Entry/exit logic errors
 * - EXCHANGE: API and connectivity errors
 * - POSITION: Position state and management errors
 * - ORDER: Order execution and lifecycle errors
 */

import { TradingError, ErrorDomain, ErrorSeverity, ErrorContext } from './BaseError';
import { Signal, Position } from '../types';

// ============================================================================
// TRADING DOMAIN ERRORS
// ============================================================================

/**
 * Entry signal validation failed
 * Indicates that an entry signal was rejected due to validation rules
 */
export class EntryValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      signal?: Signal;
      reason: string;
      confidence?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'ENTRY_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, EntryValidationError.prototype);
  }
}

/**
 * Exit signal execution failed
 * Indicates that an exit action could not be executed
 */
export class ExitExecutionError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId: string;
      exitAction: string;
      reason: string;
      pnl?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'EXIT_EXECUTION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ExitExecutionError.prototype);
  }
}

/**
 * Strategy execution error
 * Indicates failure during strategy coordination/execution
 */
export class StrategyExecutionError extends TradingError {
  constructor(
    message: string,
    context: {
      strategyId?: string;
      phase: string;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'STRATEGY_EXECUTION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, StrategyExecutionError.prototype);
  }
}

/**
 * Risk limit exceeded
 * Position/trade would exceed configured risk limits
 */
export class RiskLimitExceededError extends TradingError {
  constructor(
    message: string,
    context: {
      limitType: string; // e.g., 'MAX_POSITION_SIZE', 'MAX_DAILY_LOSS'
      currentValue: number;
      limit: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'RISK_LIMIT_EXCEEDED',
      ErrorDomain.TRADING,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, RiskLimitExceededError.prototype);
  }
}

/**
 * Insufficient balance for operation
 */
export class InsufficientBalanceError extends TradingError {
  constructor(
    message: string,
    context: {
      required: number;
      available: number;
      currency: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'INSUFFICIENT_BALANCE',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

// ============================================================================
// EXCHANGE DOMAIN ERRORS
// ============================================================================

/**
 * Exchange API connection error
 * Network connectivity issue or API unavailable
 */
export class ExchangeConnectionError extends TradingError {
  constructor(
    message: string,
    context: { exchangeName: string; endpoint?: string; [key: string]: unknown },
    originalError?: Error,
  ) {
    super(
      message,
      'EXCHANGE_CONNECTION_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ExchangeConnectionError.prototype);
  }
}

/**
 * Exchange rate limit error
 * API rate limit exceeded, retry after specified duration
 */
export class ExchangeRateLimitError extends TradingError {
  readonly retryAfterMs: number;

  constructor(
    message: string,
    context: {
      retryAfterMs?: number;
      exchangeName?: string;
      [key: string]: unknown;
    } = {},
    originalError?: Error,
  ) {
    const retryAfterMs = context.retryAfterMs || 60000;
    super(
      message,
      'EXCHANGE_RATE_LIMIT',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, ExchangeRateLimitError.prototype);
  }
}

/**
 * Exchange API error
 * Generic API error returned by exchange
 */
export class ExchangeAPIError extends TradingError {
  constructor(
    message: string,
    context: {
      exchangeName?: string;
      endpoint?: string;
      statusCode?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'EXCHANGE_API_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ExchangeAPIError.prototype);
  }
}

/**
 * Exchange order rejected
 * Order was rejected by exchange due to validation or other reasons
 */
export class OrderRejectedError extends TradingError {
  constructor(
    message: string,
    context: {
      orderId?: string;
      reason: string;
      details?: unknown;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'ORDER_REJECTED',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, OrderRejectedError.prototype);
  }
}

// ============================================================================
// POSITION DOMAIN ERRORS
// ============================================================================

/**
 * Position not found
 * Requested position does not exist
 */
export class PositionNotFoundError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      symbol?: string;
      [key: string]: unknown;
    } = {},
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_NOT_FOUND',
      ErrorDomain.POSITION,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionNotFoundError.prototype);
  }
}

/**
 * Position state error
 * Position is not in the expected state for this operation
 */
export class PositionStateError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId: string;
      currentState: string;
      expectedState?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_STATE_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionStateError.prototype);
  }
}

/**
 * Position sizing error
 * Position size is invalid or violates constraints
 */
export class PositionSizingError extends TradingError {
  constructor(
    message: string,
    context: {
      requestedSize: number;
      minSize?: number;
      maxSize?: number;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_SIZING_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionSizingError.prototype);
  }
}

/**
 * Leverage validation error
 * Leverage exceeds allowed limits
 */
export class LeverageValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      requestedLeverage: number;
      maxLeverage: number;
      symbol?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'LEVERAGE_VALIDATION_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, LeverageValidationError.prototype);
  }
}

// ============================================================================
// ORDER DOMAIN ERRORS
// ============================================================================

/**
 * Order timeout
 * Order was not filled within expected time
 */
export class OrderTimeoutError extends TradingError {
  readonly timeoutMs: number;

  constructor(
    message: string,
    context: {
      orderId?: string;
      symbol?: string;
      timeoutMs: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    const { timeoutMs } = context;
    super(
      message,
      'ORDER_TIMEOUT',
      ErrorDomain.ORDER,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, OrderTimeoutError.prototype);
  }
}

/**
 * Order slippage exceeded
 * Fill price exceeded acceptable slippage threshold
 */
export class OrderSlippageError extends TradingError {
  constructor(
    message: string,
    context: {
      orderId?: string;
      expectedPrice: number;
      actualPrice: number;
      slippagePercent: number;
      maxSlippagePercent: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'ORDER_SLIPPAGE_ERROR',
      ErrorDomain.ORDER,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, OrderSlippageError.prototype);
  }
}

/**
 * Order cancellation error
 * Failed to cancel order
 */
export class OrderCancellationError extends TradingError {
  constructor(
    message: string,
    context: {
      orderId?: string;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'ORDER_CANCELLATION_ERROR',
      ErrorDomain.ORDER,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, OrderCancellationError.prototype);
  }
}

/**
 * Order validation error
 * Order parameters are invalid
 */
export class OrderValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      field: string;
      value: unknown;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'ORDER_VALIDATION_ERROR',
      ErrorDomain.ORDER,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, OrderValidationError.prototype);
  }
}

// ============================================================================
// CONFIGURATION DOMAIN ERRORS
// ============================================================================

/**
 * Configuration error
 * Invalid or missing configuration
 */
export class ConfigurationError extends TradingError {
  constructor(
    message: string,
    context: {
      configKey: string;
      issue: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      ErrorDomain.CONFIGURATION,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

// ============================================================================
// PERFORMANCE DOMAIN ERRORS
// ============================================================================

/**
 * Performance threshold exceeded
 * Operation took longer than acceptable
 */
export class PerformanceError extends TradingError {
  constructor(
    message: string,
    context: {
      operation: string;
      durationMs: number;
      thresholdMs: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'PERFORMANCE_ERROR',
      ErrorDomain.PERFORMANCE,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PerformanceError.prototype);
  }
}

// ============================================================================
// WEBSOCKET DOMAIN ERRORS (Phase 8.8)
// ============================================================================

/**
 * WebSocket connection error
 * Indicates failure to establish or maintain WebSocket connection
 */
export class WebSocketConnectionError extends TradingError {
  constructor(
    message: string,
    context?: {
      url?: string;
      attemptNumber?: number;
      lastError?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'WEBSOCKET_CONNECTION_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, WebSocketConnectionError.prototype);
  }
}

/**
 * WebSocket authentication error
 * Indicates failure to authenticate WebSocket connection
 */
export class WebSocketAuthenticationError extends TradingError {
  constructor(
    message: string,
    context?: {
      reason?: string;
      apiKeyMissing?: boolean;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'WEBSOCKET_AUTH_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, WebSocketAuthenticationError.prototype);
  }
}

/**
 * WebSocket subscription error
 * Indicates failure to subscribe to required topics
 */
export class WebSocketSubscriptionError extends TradingError {
  constructor(
    message: string,
    context?: {
      topic?: string;
      failedTopics?: string[];
      successfulTopics?: string[];
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'WEBSOCKET_SUBSCRIPTION_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, WebSocketSubscriptionError.prototype);
  }
}

// ============================================================================
// RISK MANAGEMENT DOMAIN ERRORS
// ============================================================================

/**
 * Risk validation error
 * Indicates that a trade was rejected due to risk validation failures
 */
export class RiskValidationError extends TradingError {
  constructor(
    message: string,
    context?: {
      signal?: Signal;
      reason?: string;
      signalPrice?: number;
      confidence?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'RISK_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, RiskValidationError.prototype);
  }
}


/**
 * Insufficient account balance error
 * Indicates that account balance is insufficient or invalid for trading
 */
export class InsufficientAccountBalanceError extends TradingError {
  constructor(
    message: string,
    context?: {
      currentBalance?: number;
      requiredBalance?: number;
      reason?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'INSUFFICIENT_ACCOUNT_BALANCE_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, InsufficientAccountBalanceError.prototype);
  }
}

// ============================================================================
// PERSISTENCE DOMAIN ERRORS
// ============================================================================

/**
 * Journal read error
 * Failed to load journal from disk (file missing, corrupted, or parse error)
 */
export class JournalReadError extends TradingError {
  constructor(
    message: string,
    context: {
      filePath: string;
      operation: 'read' | 'parse' | 'corrupt';
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'JOURNAL_READ_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, JournalReadError.prototype);
  }
}

/**
 * Journal write error
 * Failed to save journal to disk (write error, disk full, permission)
 */
export class JournalWriteError extends TradingError {
  constructor(
    message: string,
    context: {
      filePath: string;
      operation: 'write' | 'serialize' | 'directory';
      reason: string;
      entriesCount?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'JOURNAL_WRITE_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, JournalWriteError.prototype);
  }
}

/**
 * Trade record validation error
 * Invalid trade ID, duplicate, or missing required fields
 */
export class TradeRecordValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      field: string;
      value: unknown;
      reason: string;
      tradeId?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TRADE_RECORD_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TradeRecordValidationError.prototype);
  }
}

/**
 * CSV export error
 * Non-critical failure during CSV history export
 */
export class CSVExportError extends TradingError {
  constructor(
    message: string,
    context: {
      filePath: string;
      reason: string;
      recordsCount?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CSV_EXPORT_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, CSVExportError.prototype);
  }
}

// ============================================================================
// POSITION MONITORING DOMAIN ERRORS (Phase 8.9.3)
// ============================================================================

/**
 * Position monitoring error
 * Base error for position monitoring operations
 */
export class PositionMonitoringError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      operation: string;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_MONITORING_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionMonitoringError.prototype);
  }
}

/**
 * Position exchange sync error
 * Failed to sync position state with exchange (price, quantity, status)
 */
export class PositionExchangeSyncError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      syncType: 'closed' | 'price' | 'quantity' | 'status';
      expectedValue?: unknown;
      actualValue?: unknown;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_EXCHANGE_SYNC_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionExchangeSyncError.prototype);
  }
}

/**
 * Position protection error
 * Protection (TP/SL) verification or setup failed
 */
export class PositionProtectionError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      protectionType: 'stopLoss' | 'takeProfit' | 'trailingStop' | 'all';
      hasStopLoss?: boolean;
      hasTakeProfit?: boolean;
      hasTrailingStop?: boolean;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_PROTECTION_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionProtectionError.prototype);
  }
}

/**
 * Position price fetch error
 * Failed to fetch current market price for position monitoring
 */
export class PositionPriceFetchError extends TradingError {
  constructor(
    message: string,
    context: {
      symbol?: string;
      positionId?: string;
      reason: string;
      lastSuccessfulPrice?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'POSITION_PRICE_FETCH_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PositionPriceFetchError.prototype);
  }
}

// ============================================================================
// NOTIFICATION DOMAIN ERRORS (Phase 8.9.5)
// ============================================================================

/**
 * Telegram API error
 * HTTP errors from Telegram Bot API (4xx, 5xx)
 */
export class TelegramAPIError extends TradingError {
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    context: {
      statusCode: number;
      endpoint?: string;
      response?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    const { statusCode } = context;
    const retryable = statusCode >= 500; // 5xx errors are retryable, 4xx are not

    super(
      message,
      'TELEGRAM_API_ERROR',
      ErrorDomain.NOTIFICATION,
      retryable ? ErrorSeverity.HIGH : ErrorSeverity.LOW,
      originalError,
      context,
    );
    this.statusCode = statusCode;
    this.retryable = retryable;
    Object.setPrototypeOf(this, TelegramAPIError.prototype);
  }
}

/**
 * Telegram network error
 * Network connectivity issues (timeout, DNS, connection refused)
 */
export class TelegramNetworkError extends TradingError {
  constructor(
    message: string,
    context: {
      operation: string;
      reason: string;
      timeout?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TELEGRAM_NETWORK_ERROR',
      ErrorDomain.NOTIFICATION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TelegramNetworkError.prototype);
  }
}

/**
 * Telegram message validation error
 * Message validation failures (too long, invalid HTML, etc)
 */
export class TelegramMessageError extends TradingError {
  constructor(
    message: string,
    context: {
      messageLength?: number;
      maxLength?: number;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TELEGRAM_MESSAGE_ERROR',
      ErrorDomain.NOTIFICATION,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TelegramMessageError.prototype);
  }
}

/**
 * Telegram rate limit error
 * Rate limit exceeded (429 Too Many Requests)
 */
export class TelegramRateLimitError extends TradingError {
  readonly retryAfterMs: number;

  constructor(
    message: string,
    context: {
      retryAfterMs?: number;
      [key: string]: unknown;
    } = {},
    originalError?: Error,
  ) {
    const retryAfterMs = context.retryAfterMs || 60000;
    super(
      message,
      'TELEGRAM_RATE_LIMIT',
      ErrorDomain.NOTIFICATION,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, TelegramRateLimitError.prototype);
  }
}

// ============================================================================
// STRATEGY DOMAIN ERRORS (Phase 8.9.6)
// ============================================================================

/**
 * Strategy load error
 * Failed to load strategy from file system (file missing, permission denied, network)
 */
export class StrategyLoadError extends TradingError {
  constructor(
    message: string,
    context: {
      strategyName: string;
      reason: 'file_not_found' | 'permission_denied' | 'network' | 'unknown';
      filePath?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'STRATEGY_LOAD_ERROR',
      ErrorDomain.CONFIGURATION,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, StrategyLoadError.prototype);
  }
}

/**
 * Strategy parse error
 * Invalid JSON or parsing failure
 */
export class StrategyParseError extends TradingError {
  constructor(
    message: string,
    context: {
      strategyName: string;
      parseError?: string;
      position?: { line: number; column: number };
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'STRATEGY_PARSE_ERROR',
      ErrorDomain.CONFIGURATION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, StrategyParseError.prototype);
  }
}

// ============================================================================
// SESSION STATS ERRORS (Phase 8.9.10)
// ============================================================================

/**
 * Session stats read error
 * Failed to load or parse session database file
 */
export class SessionStatsReadError extends TradingError {
  constructor(
    message: string,
    context: {
      filePath: string;
      operation: 'read' | 'parse' | 'corrupt';
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'SESSION_STATS_READ_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, SessionStatsReadError.prototype);
  }
}

/**
 * Session stats write error
 * Failed to save session database file
 */
export class SessionStatsWriteError extends TradingError {
  constructor(
    message: string,
    context: {
      filePath: string;
      operation: 'write' | 'serialize' | 'directory';
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'SESSION_STATS_WRITE_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, SessionStatsWriteError.prototype);
  }
}

/**
 * Session record validation error
 * Invalid trade record or duplicate validation failure
 */
export class SessionRecordValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      field: string;
      value?: unknown;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'SESSION_RECORD_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, SessionRecordValidationError.prototype);
  }
}

// ============================================================================
// LIMIT ORDER EXECUTION ERRORS (Phase 8.9.15)
// ============================================================================

/**
 * Limit order placement error
 * Failed to place limit order on exchange
 */
export class LimitOrderPlacementError extends TradingError {
  constructor(
    message: string,
    context: {
      symbol?: string;
      side: 'Buy' | 'Sell';
      quantity: number;
      limitPrice: number;
      reason: string;
      retryable?: boolean;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'LIMIT_ORDER_PLACEMENT_ERROR',
      ErrorDomain.ORDER,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, LimitOrderPlacementError.prototype);
  }
}

/**
 * Limit order fill timeout error
 * Order was not filled within configured timeout
 */
export class LimitOrderFillTimeoutError extends TradingError {
  readonly timeoutMs: number;

  constructor(
    message: string,
    context: {
      orderId?: string;
      symbol?: string;
      limitPrice: number;
      timeoutMs: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    const { timeoutMs } = context;
    super(
      message,
      'LIMIT_ORDER_FILL_TIMEOUT',
      ErrorDomain.ORDER,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, LimitOrderFillTimeoutError.prototype);
  }
}

/**
 * Market order fallback error
 * Fallback to market order failed
 */
export class MarketOrderFallbackError extends TradingError {
  constructor(
    message: string,
    context: {
      orderId?: string;
      symbol?: string;
      fallbackReason: string;
      primaryError: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'MARKET_ORDER_FALLBACK_ERROR',
      ErrorDomain.ORDER,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, MarketOrderFallbackError.prototype);
  }
}

// ============================================================================
// PERFORMANCE DOMAIN ERRORS (Phase 8.9.16)
// ============================================================================

/**
 * Indicator calculation error
 * Calculation failed for a specific indicator (NaN, Infinity, insufficient data, etc)
 */
export class IndicatorCalculationError extends TradingError {
  constructor(
    message: string,
    context: {
      calculator?: string;
      indicatorName?: string;
      period?: number;
      timeframe?: string;
      reason: string;
      error?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'INDICATOR_CALCULATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, IndicatorCalculationError.prototype);
  }
}

/**
 * Indicator cache synchronization error
 * Cache operation (invalidate/set) failed
 */
export class IndicatorCacheSyncError extends TradingError {
  constructor(
    message: string,
    context: {
      cacheKey: string;
      operation: 'invalidate' | 'set' | 'get';
      reason: string;
      value?: unknown;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'INDICATOR_CACHE_SYNC_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, IndicatorCacheSyncError.prototype);
  }
}

/**
 * Candle data missing error
 * Insufficient historical candle data for indicator calculation
 */
export class CandleDataMissingError extends TradingError {
  constructor(
    message: string,
    context: {
      calculator?: string;
      timeframe?: string;
      minRequired: number;
      available?: number;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CANDLE_DATA_MISSING_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, CandleDataMissingError.prototype);
  }
}

/**
 * Take profit calculation error
 * PnL or fee calculation failed during partial close recording
 */
export class TakeProfitCalculationError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      level: number;
      quantity: number;
      exitPrice: number;
      entryPrice?: number;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TAKE_PROFIT_CALCULATION_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TakeProfitCalculationError.prototype);
  }
}

/**
 * Take profit recording error
 * Logging or persistence of partial close failed
 */
export class TakeProfitRecordingError extends TradingError {
  constructor(
    message: string,
    context: {
      positionId?: string;
      level: number;
      quantity: number;
      exitPrice: number;
      operation: string; // 'logging', 'persistence', etc
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TAKE_PROFIT_RECORDING_ERROR',
      ErrorDomain.POSITION,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TakeProfitRecordingError.prototype);
  }
}

// ============================================================================
// WALL TRACKING ERRORS (Phase 8.9.28)
// ============================================================================

/**
 * Wall tracking error
 * Error during orderbook wall detection/tracking
 */
export class WallTrackingError extends TradingError {
  readonly wallPrice?: number;
  readonly wallSide?: 'BID' | 'ASK';

  constructor(
    message: string,
    context: {
      wallPrice?: number;
      wallSide?: 'BID' | 'ASK';
      operation: 'detect' | 'remove' | 'update' | 'score' | 'cluster';
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    const { wallPrice, wallSide } = context;
    super(
      message,
      'WALL_TRACKING_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    this.wallPrice = wallPrice;
    this.wallSide = wallSide;
    Object.setPrototypeOf(this, WallTrackingError.prototype);
  }
}

// ============================================================================
// CONFIGURATION DOMAIN ERRORS (Phase 8.9.31)
// ============================================================================

/**
 * Configuration validation error
 * Indicates that a required configuration field is missing or empty
 * Blocks startup - requires manual configuration fix
 */
export class ConfigValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      field: string;
      reason: string;
      value?: unknown;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIG_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

/**
 * Configuration deprecation error
 * Indicates that a deprecated configuration key is present
 * Blocks startup - requires manual removal from config.json
 */
export class ConfigDeprecationError extends TradingError {
  constructor(
    message: string,
    context: {
      deprecatedKey: string;
      suggestion?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIG_DEPRECATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigDeprecationError.prototype);
  }
}

/**
 * Configuration format error
 * Indicates that a configuration value has invalid format or range
 * Blocks startup - requires manual correction
 */
export class ConfigFormatError extends TradingError {
  constructor(
    message: string,
    context: {
      field: string;
      value: unknown;
      expectedFormat: string;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIG_FORMAT_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigFormatError.prototype);
  }
}

/**
 * Analyzer configuration validation error
 * Indicates missing analyzer configuration in strategicWeights
 * Blocks startup - requires manual configuration
 */
export class ConfigAnalyzerValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      section: string;
      analyzers: string[];
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIG_ANALYZER_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigAnalyzerValidationError.prototype);
  }
}

/**
 * Strategy configuration validation error
 * Indicates missing required strategy configuration
 * Blocks startup - requires manual configuration
 */
export class ConfigStrategyValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      strategyName: string;
      missingFields: string[];
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'CONFIG_STRATEGY_VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ConfigStrategyValidationError.prototype);
  }
}

// ============================================================================
// FUNDING RATE ERRORS (Phase 8.9.32)
// ============================================================================

/**
 * Funding rate API error
 * Failed to fetch or parse funding rate from exchange API
 * Used with RETRY strategy for transient network failures
 */
export class FundingRateApiError extends TradingError {
  constructor(
    message: string,
    context: {
      symbol?: string;
      endpoint?: string;
      statusCode?: number;
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'FUNDING_RATE_API_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, FundingRateApiError.prototype);
  }
}

/**
 * Funding rate cache error
 * Failed to cache or retrieve cached funding rate data
 * Used with GRACEFUL_DEGRADE strategy to fall back to older cached data
 */
export class FundingRateCacheError extends TradingError {
  constructor(
    message: string,
    context: {
      symbol?: string;
      cacheKey?: string;
      operation: 'get' | 'set' | 'invalidate' | 'clear';
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'FUNDING_RATE_CACHE_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, FundingRateCacheError.prototype);
  }
}

/**
 * Risk calculation error
 * Validation or calculation failure in risk management (SL/TP calculation)
 * Used with THROW strategy for critical validation, GRACEFUL_DEGRADE for missing ATR
 */
export class RiskCalculationError extends TradingError {
  constructor(
    message: string,
    context: {
      entryPrice?: number;
      referenceLevel?: number;
      slMultiplier?: number;
      minSlDistancePercent?: number;
      atrPercent?: number;
      takeProfitConfigs?: unknown;
      slPercent?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'RISK_CALCULATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, RiskCalculationError.prototype);
  }
}

// ============================================================================
// DATA COLLECTION DOMAIN ERRORS (Phase 8.9.35)
// ============================================================================

/**
 * Data collection operation error
 * Indicates failure during market data collection (WebSocket, queuing)
 * Used with RETRY strategy for transient network failures
 */
export class DataCollectionError extends TradingError {
  constructor(
    message: string,
    context: {
      operation: string;
      recordsLost?: number;
      retryable?: boolean;
      symbol?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'DATA_COLLECTION_ERROR',
      ErrorDomain.DATA_COLLECTION,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, DataCollectionError.prototype);
  }
}

/**
 * Data compression error
 * Indicates failure during compression of orderbook/trade data
 * Used with GRACEFUL_DEGRADE strategy for fallback to uncompressed
 */
export class DataCompressionError extends TradingError {
  constructor(
    message: string,
    context: {
      compressionType: string;
      originalSize?: number;
      compressedSize?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'DATA_COMPRESSION_ERROR',
      ErrorDomain.DATA_COLLECTION,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, DataCompressionError.prototype);
  }
}

/**
 * Database batch write error
 * Indicates failure during batch INSERT operations in DataCollectorService
 * Used with RETRY strategy for transient database locks
 */
export class DatabaseBatchError extends TradingError {
  constructor(
    message: string,
    context: {
      batchType: 'candles' | 'orderbooks' | 'ticks';
      batchSize: number;
      recordsLost?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'DATABASE_BATCH_ERROR',
      ErrorDomain.PERSISTENCE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, DatabaseBatchError.prototype);
  }
}

/**
 * Data queue overflow error
 * Indicates queue memory pressure during high-frequency data collection
 * Used with GRACEFUL_DEGRADE strategy to drop excess data
 */
export class DataQueueOverflowError extends TradingError {
  constructor(
    message: string,
    context: {
      queueType: 'candles' | 'orderbooks' | 'ticks';
      maxSize: number;
      currentSize: number;
      droppedCount?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'DATA_QUEUE_OVERFLOW_ERROR',
      ErrorDomain.DATA_COLLECTION,
      ErrorSeverity.LOW,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, DataQueueOverflowError.prototype);
  }
}

// ============================================================================
// PERFORMANCE ANALYTICS DOMAIN ERRORS
// ============================================================================

/**
 * Phase 8.9.36: PerformanceCalculationError
 * Thrown when performance metric calculations fail
 */
export class PerformanceCalculationError extends TradingError {
  constructor(
    message: string,
    context: {
      operation: string;
      tradesProvided?: unknown;
      period?: number | string;
      validPeriods?: string[];
      limit?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'PERFORMANCE_CALCULATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, PerformanceCalculationError.prototype);
  }
}

// ============================================================================
// EXCHANGE FACTORY DOMAIN ERRORS (Phase 8.9.37)
// ============================================================================

/**
 * Exchange factory configuration validation error
 * Thrown when exchange config is invalid (missing required fields, unsupported exchange)
 */
export class ExchangeFactoryConfigError extends TradingError {
  constructor(
    message: string,
    context: {
      exchangeName?: string;
      symbol?: string;
      missingField?: string;
      supportedExchanges?: string[];
      reason: 'missing_field' | 'unsupported_exchange' | 'invalid_symbol' | 'invalid_config';
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'EXCHANGE_FACTORY_CONFIG_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ExchangeFactoryConfigError.prototype);
  }
}

/**
 * Exchange adapter instantiation error
 * Thrown when creating exchange adapter (Bybit, Binance) fails
 */
export class ExchangeAdapterInstantiationError extends TradingError {
  constructor(
    message: string,
    context: {
      exchangeName: string;
      symbol?: string;
      operation: 'service_creation' | 'adapter_creation' | 'initialization';
      reason: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'EXCHANGE_ADAPTER_INSTANTIATION_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ExchangeAdapterInstantiationError.prototype);
  }
}

/**
 * BotFactory configuration validation error
 * Thrown when bot config is missing required fields or has invalid values
 * Phase 8.9.41: Factory config validation
 */
export class BotFactoryConfigValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      missingField?: string;
      field?: string;
      received?: unknown;
      type?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'BOT_FACTORY_CONFIG_VALIDATION_ERROR',
      ErrorDomain.CONFIGURATION,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, BotFactoryConfigValidationError.prototype);
  }
}

/**
 * BotFactory service initialization error
 * Thrown when BotServices fails to initialize
 * Phase 8.9.41: Factory initialization
 */
export class BotFactoryInitializationError extends TradingError {
  constructor(
    message: string,
    context: {
      originalError?: string;
      failedService?: string;
      phase?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'BOT_FACTORY_INITIALIZATION_ERROR',
      ErrorDomain.INTERNAL,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, BotFactoryInitializationError.prototype);
  }
}

/**
 * Time synchronization with exchange failed
 * Indicates failure to sync local time with exchange server time
 * Phase 8.9.42: TimeService error handling
 */
export class TimeSyncError extends TradingError {
  constructor(
    message: string,
    context: {
      reason: string;
      failureCount?: number;
      maxAttempts?: number;
      lastKnownOffset?: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TIME_SYNC_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TimeSyncError.prototype);
  }
}

/**
 * Time synchronization timeout
 * Indicates that time sync operation exceeded timeout threshold
 * Phase 8.9.42: TimeService error handling
 */
export class TimeSyncTimeoutError extends TradingError {
  constructor(
    message: string,
    context: {
      timeoutMs: number;
      elapsedMs: number;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'TIME_SYNC_TIMEOUT_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, TimeSyncTimeoutError.prototype);
  }
}

/**
 * File system operation error
 * Indicates that a file I/O operation failed
 * Phase 8.9.43: VirtualBalanceService error handling
 */
export class FileSystemError extends TradingError {
  constructor(
    message: string,
    context: {
      operation: string;
      filePath?: string;
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'FILE_SYSTEM_ERROR',
      ErrorDomain.EXCHANGE,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Validation error
 * Indicates that input validation failed
 * Phase 8.9.43: VirtualBalanceService error handling
 */
export class ValidationError extends TradingError {
  constructor(
    message: string,
    context: {
      [key: string]: unknown;
    },
    originalError?: Error,
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      ErrorDomain.TRADING,
      ErrorSeverity.MEDIUM,
      originalError,
      context,
    );
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
