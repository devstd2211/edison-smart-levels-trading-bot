/**
 * API Types and Interfaces
 * Shared between backend and frontend
 */

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

export interface WebSocketMessage {
  type: 'POSITION_UPDATE' | 'SIGNAL_NEW' | 'BALANCE_UPDATE' | 'JOURNAL_UPDATE' | 'SESSION_UPDATE' | 'BOT_STATUS_CHANGE' | 'ERROR' | 'PONG';
  payload: any;
  timestamp: number;
  requestId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
