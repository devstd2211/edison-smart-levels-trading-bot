/**
 * Journal types
 */

import type { ExitCondition } from '../../types/legacy';
import type { BTCAnalysis } from '../../types/core';
import type { Signal } from '../../types/signal';
import type { PositionSide } from '../../types/enums';

/**
 * Trade record for journal
 */
export interface TradeRecord {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  entryCondition: EntryCondition;
  exitCondition?: ExitCondition;
  openedAt: number;
  closedAt?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
  status: 'OPEN' | 'CLOSED';
}

/**
 * Entry condition for journal - Extended for ML
 */
export interface EntryCondition {
  signal: Signal;
  marketData?: Record<string, unknown>;
  btcData?: BTCAnalysis;
  indicators?: Record<string, unknown>;
  rawData?: Record<string, unknown>;
}
