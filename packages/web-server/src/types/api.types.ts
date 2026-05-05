/**
 * API Types and Interfaces
 * Shared between backend and frontend
 */

import type {
  ApiResponse,
  BotStatus,
  ErrorPayload,
  Position,
  PositionClosedPayload,
  PositionOpenedPayload,
  Signal,
  SignalGeneratedPayload,
  WebSocketMessage,
  WebSocketPayloadMap,
} from '@edison/contracts';

export type {
  ApiResponse,
  BotStatus,
  ErrorPayload,
  Position,
  PositionClosedPayload,
  PositionOpenedPayload,
  Signal,
  SignalGeneratedPayload,
  WebSocketMessage,
  WebSocketPayloadMap,
};

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

export type WebSocketEventType = keyof WebSocketPayloadMap;
