/**
 * Event Handler Type Definitions
 *
 * Strict types for WebSocket and EventEmitter event handlers.
 * Used throughout: bot.ts, webSocketManager, positionMonitor, publicWebSocket
 */

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/**
 * Server-initiated ping message (Bybit V5 format)
 * Server sends: {"op": "ping", "args": ["timestamp"]}
 */
export interface ServerPingMessage {
  op: 'ping';
  args: string[]; // Bybit sends timestamp as string array
}

/**
 * Generic Bybit WebSocket message (base for all message types)
 */
export interface BybitWebSocketMessage {
  op?: string;
  [key: string]: unknown; // Allow flexibility for SDK compatibility
}

// ============================================================================
// POSITION & EXECUTION DATA TYPES
// ============================================================================

/**
 * Position data from WebSocket position topic (Bybit V5 format)
 * Can be single object or array of objects
 */
export interface PositionData {
  symbol?: string;
  side?: string; // 'Buy' | 'Sell'
  size?: string;
  avgPrice?: string;
  entryPrice?: string;
  leverage?: string;
  unrealisedPnl?: string;
  curRealisedPnl?: string;
  markPrice?: string;
  positionIdx?: number;
  positionIM?: string; // Initial margin
  [key: string]: unknown; // SDK compatibility
}

/**
 * Order execution data from WebSocket execution topic (Bybit V5 format)
 * Represents fills/executions from market orders and conditional orders
 */
export interface OrderExecutionData {
  symbol?: string;
  orderId?: string;
  side?: string; // 'Buy' | 'Sell'
  orderStatus?: string;
  execQty?: string;
  execPrice?: string;
  execType?: string;
  stopOrderType?: string;
  orderType?: string;
  closedSize?: string;
  execValue?: string;
  execFee?: string;
  createType?: string;
  [key: string]: unknown; // SDK compatibility
}

/**
 * Order update data from WebSocket order topic (Bybit V5 format)
 * Represents order state changes (pending, filled, cancelled, etc)
 */
export interface OrderUpdateData {
  symbol?: string;
  orderId?: string;
  orderType?: string;
  orderStatus?: string; // 'Filled', 'Cancelled', etc
  stopOrderType?: string; // 'TakeProfit', 'StopLoss', 'Trailing', 'UNKNOWN'
  avgPrice?: string;
  qty?: string;
  cumExecQty?: string;
  side?: string; // 'Buy' | 'Sell'
  [key: string]: unknown; // SDK compatibility
}

// ============================================================================
// PUBLIC WEBSOCKET DATA TYPES
// ============================================================================

/**
 * Kline (candlestick) data from WebSocket kline topic (Bybit V5 format)
 */
export interface KlineData {
  start?: string; // Candle start time (ms timestamp)
  end?: string; // Candle end time (ms timestamp)
  interval?: string; // Timeframe ('1', '5', '15', '30', '60', '240')
  open?: string; // Open price
  close?: string; // Close price
  high?: string; // High price
  low?: string; // Low price
  volume?: string; // Volume
  turnover?: string; // Turnover (volume in USDT)
  confirm?: boolean; // True if candle is closed
  timestamp?: string; // Timestamp
  [key: string]: unknown; // SDK compatibility
}

/**
 * Orderbook data from WebSocket orderbook topic (Bybit V5 format)
 * Represents bid/ask levels with snapshot/delta detection
 */
export interface OrderbookData {
  s?: string; // Symbol
  b?: Array<[string, string]>; // Bids [[price, size], ...]
  a?: Array<[string, string]>; // Asks [[price, size], ...]
  u?: number; // Update ID
  seq?: number; // Sequence number
  type?: string; // 'snapshot' or 'delta'
  [key: string]: unknown; // SDK compatibility
}

/**
 * Trade data from WebSocket public trade topic (Bybit V5 format)
 */
export interface TradeData {
  T?: number; // Timestamp (ms)
  s?: string; // Symbol
  S?: 'Buy' | 'Sell'; // Trade side
  v?: string; // Volume
  p?: string; // Price
  L?: string; // Trade direction
  i?: string; // Trade ID
  BT?: boolean; // Block trade
  [key: string]: unknown; // SDK compatibility
}

// ============================================================================
// ORDER & FILL EVENTS
// ============================================================================

/**
 * Take Profit filled event (from WebSocket order/position topics)
 */
export interface TakeProfitFilledEvent {
  orderId: string;
  avgPrice: string | number | undefined;
  cumExecQty: string | number | undefined;
}

/**
 * Stop Loss filled event (from WebSocket order topic)
 */
export interface StopLossFilledEvent {
  orderId: string;
  avgPrice: string | number | undefined;
  cumExecQty: string | number | undefined;
}

/**
 * Trade tick event (from public trade stream)
 */
export interface TradeTickEvent {
  timestamp: number;
  price: number;
  quantity: number;
  side: 'Buy' | 'Sell' | 'BUY' | 'SELL'; // SDK and our code may use different formats
}

// ============================================================================
// POSITION & EXIT EVENTS
// ============================================================================

/**
 * Time-based exit event (triggered by PositionMonitor)
 */
export interface TimeBasedExitEvent {
  reason: string;
  openedMinutes?: number;
  pnlPercent?: number;
  position: {
    id: string;
    side: 'Buy' | 'Sell'; // PositionSide (Buy = LONG, Sell = SHORT)
    quantity: number;
    currentPrice?: number;
    entryPrice?: number;
    takeProfits?: Array<{ level: number; price: number }>;
  };
}

/**
 * Orderbook update event (from public orderbook stream)
 */
export interface OrderbookUpdateEvent {
  type?: 'snapshot' | 'delta';
  timestamp?: number;
  symbol?: string;
  bids?: Array<[number, number]>;
  asks?: Array<[number, number]>;
  updateId?: number;
  // SDK may include additional fields
  [key: string]: unknown;
}

export type OrderbookSnapshot = OrderbookUpdateEvent;
