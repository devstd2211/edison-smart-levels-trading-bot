/**
 * Trade Store (Zustand)
 *
 * State management for trade history and analytics
 */

import { create } from 'zustand';

export interface TradeEntry {
  id: string;
  timestamp: number;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  strategy: string;
  exitReason: string;
}

export interface StrategyStats {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  wins: number;
  losses: number;
}

export interface JournalStats {
  totalTrades: number;
  totalPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  longWinRate: number;
  shortWinRate: number;
}

export interface PnLHistoryPoint {
  time: string;
  timestamp: number;
  pnl: number;
  cumulativePnL: number;
  tradeNumber: number;
}

export interface EquityCurvePoint {
  time: string;
  timestamp: number;
  equity: number;
  pnl: number;
  tradeNumber: number;
  drawdown: number;
}

interface TradeState {
  // Trade History
  tradeHistory: TradeEntry[];
  last24hTrades: TradeEntry[];
  currentPage: number;
  pageSize: number;
  totalTrades: number;
  totalPages: number;

  // Statistics
  journalStats: JournalStats | null;
  strategyStats: StrategyStats[];

  // Charts
  pnlHistory: PnLHistoryPoint[];
  equityCurve: EquityCurvePoint[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setTradeHistory: (trades: TradeEntry[], total: number, pages: number) => void;
  setLast24hTrades: (trades: TradeEntry[]) => void;
  setJournalStats: (stats: JournalStats) => void;
  setStrategyStats: (stats: StrategyStats[]) => void;
  setPnLHistory: (history: PnLHistoryPoint[]) => void;
  setEquityCurve: (curve: EquityCurvePoint[]) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  tradeHistory: [],
  last24hTrades: [],
  currentPage: 1,
  pageSize: 50,
  totalTrades: 0,
  totalPages: 0,
  journalStats: null,
  strategyStats: [],
  pnlHistory: [],
  equityCurve: [],
  isLoading: false,
  error: null,
};

export const useTradeStore = create<TradeState>((set) => ({
  ...initialState,

  setTradeHistory: (trades, total, pages) =>
    set({
      tradeHistory: trades,
      totalTrades: total,
      totalPages: pages,
    }),

  setLast24hTrades: (trades) =>
    set({
      last24hTrades: trades,
    }),

  setJournalStats: (stats) =>
    set({
      journalStats: stats,
    }),

  setStrategyStats: (stats) =>
    set({
      strategyStats: stats,
    }),

  setPnLHistory: (history) =>
    set({
      pnlHistory: history,
    }),

  setEquityCurve: (curve) =>
    set({
      equityCurve: curve,
    }),

  setCurrentPage: (page) =>
    set({
      currentPage: page,
    }),

  setPageSize: (size) =>
    set({
      pageSize: size,
    }),

  setLoading: (isLoading) =>
    set({
      isLoading,
    }),

  setError: (error) =>
    set({
      error,
    }),

  reset: () =>
    set(initialState),
}));
