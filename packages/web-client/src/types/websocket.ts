import type { WebApiCandle, WebApiFundingRateView, WebApiMarketData, WebApiOrderBookView, WebApiWallView, WebApiWallsView } from '@edison/contracts';
import type { BotStatus, Position, Signal } from './index';
import type { Strategy } from './strategy';

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
  error?: string;
  message?: string;
}

export interface WebSocketEventMap {
  BOT_STATUS_CHANGE: BotStatus;
  POSITION_UPDATE: { position: Position | null };
  BALANCE_UPDATE: { balance: number; unrealizedPnL: number };
  SIGNAL_NEW: Signal;
  TREND_UPDATE: { trend?: string };
  MARKET_DATA_UPDATE: WebApiMarketData;
  ORDERBOOK_UPDATE: WebApiOrderBookView;
  WALLS_UPDATE: WebApiWallsView | WebApiWallView[];
  FUNDING_RATE_UPDATE: WebApiFundingRateView;
  POSITION_OPENED: PositionOpenedPayload;
  POSITION_CLOSED: PositionClosedPayload;
  SIGNAL_GENERATED: SignalGeneratedPayload;
  ERROR: ErrorPayload;
  CANDLE_CLOSED: { timeframe: string; candle: WebApiCandle };
  STRATEGIES_RELOADED: { strategies: Strategy[] };
}
