/**
 * API Types and Interfaces
 * Shared between backend and frontend
 */

import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
  WebApiWallView,
} from '@edison/contracts';

export interface BotStatus {
  isRunning: boolean;
  currentPosition: Position | null;
  balance: number;
  unrealizedPnL: number;
  timestamp: number;
  error?: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss: {
    price: number;
    breakeven?: number;
    trailing?: boolean;
  };
  takeProfits: Array<{
    price: number;
    quantity: number;
    hit?: boolean;
  }>;
  openedAt: number;
  status: 'OPEN' | 'CLOSED';
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
  }>;
  reason: string;
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

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  entryCondition?: string;
  exitCondition?: string;
  openedAt: number;
  closedAt?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  status: 'OPEN' | 'CLOSED';
  strategy?: string;
  confidence?: number;
  holdingTime?: number;
  tpHit?: number;
}

export interface SessionStats {
  id: string;
  startTime: number;
  endTime?: number;
  trades: TradeRecord[];
  totalPnL: number;
  totalPnLPercent: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  wLRatio: number;
  stopOutRate: number;
  maxDrawdown: number;
  equityCurve: Array<{
    timestamp: number;
    equity: number;
  }>;
}

export interface WebSocketMessage<T extends WebSocketEventType = WebSocketEventType> {
  type: T;
  payload: WebSocketPayloadMap[T];
  timestamp: number;
  requestId?: string;
}

export type WebSocketEventType = keyof WebSocketPayloadMap;

export interface WebSocketPayloadMap {
  BOT_STATUS_CHANGE: BotStatus;
  POSITION_UPDATE: { position: Position | null };
  BALANCE_UPDATE: { balance: number; unrealizedPnL: number };
  SIGNAL_NEW: Signal;
  TREND_UPDATE: { trend?: string };
  MARKET_DATA_UPDATE: WebApiMarketData;
  ORDERBOOK_UPDATE: WebApiOrderBookView;
  WALLS_UPDATE: WebApiWallsView | WebApiWallView[];
  FUNDING_RATE_UPDATE: WebApiFundingRateView;
  CANDLE_CLOSED: { timeframe: string; candle: WebApiCandle };
  POSITION_OPENED: { position?: Position; signal?: { strategy?: string; reasoning?: string; entryConditions?: string } };
  POSITION_CLOSED: { pnl?: number; exitType?: string };
  SIGNAL_GENERATED: { strategy?: string; direction?: string; confidence?: number };
  TP_HIT: { level?: number; price?: number; pnl?: number };
  SL_HIT: { price?: number; pnl?: number };
  STRATEGIES_RELOADED: { strategies: Array<{ id: string; name: string; enabled: boolean; config?: Record<string, unknown> }> };
  JOURNAL_UPDATE: { journal: unknown };
  SESSION_UPDATE: { sessions: unknown };
  ERROR: { error: string; details?: string };
  PONG: Record<string, never>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
