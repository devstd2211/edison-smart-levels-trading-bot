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
