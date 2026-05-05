import type {
  WebApiBotPosition,
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiWallsView,
} from './web-api';

export type Position = WebApiBotPosition;

export interface BotStatus {
  isRunning: boolean;
  currentPosition: Position | null;
  balance: number;
  unrealizedPnL: number;
  timestamp: number;
  error?: string;
}

export interface Signal {
  id: string;
  direction: 'LONG' | 'SHORT' | 'HOLD';
  type: string;
  confidence: number;
  price: number;
  stopLoss: number;
  takeProfits: Array<{
    price: number;
    quantity: number;
    hit?: boolean;
  }>;
  reason?: string;
  timestamp: number;
  marketData?: {
    rsi?: number;
    rsiEntry?: number;
    rsiTrend1?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    nearestLevel?: number;
    distanceToLevel?: number;
  };
}

export interface PositionOpenedPayload {
  position?: Position;
  signal?: {
    strategy?: string;
    reasoning?: string;
    entryConditions?: string;
  };
}

export interface PositionClosedPayload {
  pnl?: number;
  exitType?: string;
}

export interface SignalGeneratedPayload {
  strategy?: string;
  direction?: string;
  confidence?: number;
}

export interface ErrorPayload {
  error: string;
  details?: string;
  message?: string;
}

export interface WebSocketPayloadMap {
  BOT_STATUS_CHANGE: BotStatus;
  POSITION_UPDATE: { position: Position | null };
  BALANCE_UPDATE: { balance: number; unrealizedPnL: number };
  SIGNAL_NEW: Signal;
  TREND_UPDATE: { trend?: string };
  MARKET_DATA_UPDATE: WebApiMarketData;
  ORDERBOOK_UPDATE: WebApiOrderBookView;
  WALLS_UPDATE: WebApiWallsView;
  FUNDING_RATE_UPDATE: WebApiFundingRateView;
  CANDLE_CLOSED: { timeframe: string; candle: WebApiCandle };
  POSITION_OPENED: PositionOpenedPayload;
  POSITION_CLOSED: PositionClosedPayload;
  SIGNAL_GENERATED: SignalGeneratedPayload;
  TP_HIT: { level?: number; price?: number; pnl?: number };
  SL_HIT: { price?: number; pnl?: number };
  STRATEGIES_RELOADED: {
    strategies: Array<{ id: string; name: string; enabled: boolean; config?: Record<string, unknown> }>;
  };
  JOURNAL_UPDATE: { journal: unknown };
  SESSION_UPDATE: { sessions: unknown };
  ERROR: ErrorPayload;
  PONG: Record<string, never>;
}

export type WebSocketEventType = keyof WebSocketPayloadMap;

export interface WebSocketMessage<T extends WebSocketEventType = WebSocketEventType> {
  type: T;
  payload: WebSocketPayloadMap[T];
  timestamp: number;
  requestId?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  timestamp: number;
}

export interface ApiErrorResponse {
  success: false;
  error?: string;
  timestamp: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
