import { PERCENT_MULTIPLIER } from '../../constants';
import type { TradeHistoryCsvValue } from './trade-history-csv.utils';

type TradeStatsRecord = {
  netPnl: number;
  strategy: string;
  sessionVersion: string;
  [key: string]: TradeHistoryCsvValue;
};

export type TradeHistoryStatistics = {
  totalTrades: number;
  totalPnL: number;
  winRate: number;
  avgPnL: number;
  byStrategy: { [key: string]: number };
  bySession: { [key: string]: number };
};

export function createDefaultTradeStatistics(): TradeHistoryStatistics {
  return {
    totalTrades: 0,
    totalPnL: 0,
    winRate: 0,
    avgPnL: 0,
    byStrategy: {},
    bySession: {},
  };
}

export function calculateTradeStatistics(trades: TradeStatsRecord[]): TradeHistoryStatistics {
  const defaultStats = createDefaultTradeStatistics();
  if (trades.length === 0) {
    return defaultStats;
  }

  const wins = trades.filter((trade) => trade.netPnl > 0).length;
  const totalPnL = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const byStrategy: { [key: string]: number } = {};
  const bySession: { [key: string]: number } = {};

  for (const trade of trades) {
    byStrategy[trade.strategy] = (byStrategy[trade.strategy] || 0) + trade.netPnl;
    bySession[trade.sessionVersion] = (bySession[trade.sessionVersion] || 0) + trade.netPnl;
  }

  return {
    totalTrades: trades.length,
    totalPnL,
    winRate: (wins / trades.length) * PERCENT_MULTIPLIER,
    avgPnL: totalPnL / trades.length,
    byStrategy,
    bySession,
  };
}

export function calculateTradeStatisticsByField(
  trades: Array<{ netPnl: number; [key: string]: TradeHistoryCsvValue }>,
  fieldName: string,
): { [key: string]: number } {
  const stats: { [key: string]: number } = {};

  for (const trade of trades) {
    const key = String(trade[fieldName] || 'unknown');
    stats[key] = (stats[key] || 0) + trade.netPnl;
  }

  return stats;
}
