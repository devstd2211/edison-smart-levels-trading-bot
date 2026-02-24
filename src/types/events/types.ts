/**
 * Bot events (position lifecycle)
 */

import type { Position } from '../position';

/**
 * Stop Loss Hit Event
 */
export interface StopLossHitEvent {
  position: Position;
  currentPrice: number;
  reason: string;
}

/**
 * Take Profit Hit Event
 */
export interface TakeProfitHitEvent {
  position: Position;
  currentPrice: number;
  tpLevel: number;
  reason: string;
}

/**
 * Order Filled Event
 */
export interface OrderFilledEvent {
  orderId: string;
  symbol: string;
  side: string;
  execQty: string;
  execPrice: string;
}
