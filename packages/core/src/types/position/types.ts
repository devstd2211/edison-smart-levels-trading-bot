/**
 * Position types
 */

import type { PositionSide } from '../enums';

/**
 * Take profit level configuration
 */
export interface TakeProfit {
  level: number;
  percent: number;
  sizePercent: number;
  price: number;
  orderId?: string; // Order ID after placement
  hit: boolean; // Whether this TP was hit
  hitAt?: number; // Timestamp when TP was hit
}

/**
 * Stop loss configuration for positions
 */
export interface StopLossConfig {
  price: number; // Current SL price
  initialPrice: number; // Original SL price
  orderId?: string; // Order ID for SL order
  isBreakeven: boolean; // Whether SL is at breakeven
  isTrailing: boolean; // Whether trailing stop is active
  trailingPercent?: number; // Trailing stop distance in %
  trailingOrderId?: string; // Server-side trailing stop order ID
  updatedAt: number; // Last update timestamp
  trailingActivationPrice?: number; // Price at which trailing was activated (TP2 price for smart TP3)
  tp3MovedTicks?: number; // Number of ticks TP3 has been moved (for smart TP3)
}

/**
 * Open position
 */
export interface Position {
  id: string; // Exchange ID (e.g., "APEXUSDT_Sell") - used for WebSocket sync
  journalId?: string; // Unique journal ID (e.g., "APEXUSDT_Sell_1761696424935") - used for trade history
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  leverage: number;
  marginUsed: number; // Margin used in USDT
  stopLoss: StopLossConfig; // Stop loss configuration
  takeProfits: TakeProfit[];
  openedAt: number;
  unrealizedPnL: number;
  orderId: string; // Entry order ID
  reason: string; // Why position was opened
  confidence?: number; // Signal confidence
  strategy?: string; // Strategy name
  strategyId?: string; // [Phase 10.2] Multi-strategy support - which strategy owns this position
  protectionVerifiedOnce?: boolean; // Protection verified once - no need to check repeatedly
  status: 'OPEN' | 'CLOSED'; // Position status - used for idempotent close operations
}
