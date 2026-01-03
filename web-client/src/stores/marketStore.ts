/**
 * Market Store (Zustand)
 *
 * Manages market data: price, indicators, level info
 */

import { create } from 'zustand';

export interface MarketState {
  // Price data
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;

  // Indicators
  rsi?: number;
  rsiEntry?: number;
  rsiTrend1?: number;
  ema20?: number;
  ema50?: number;
  atr?: number;

  // Market context
  trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  btcCorrelation?: number;

  // Level info
  nearestLevel?: number;
  distanceToLevel?: number;

  // Actions
  setPrice: (price: number, change?: number, changePercent?: number) => void;
  setIndicators: (indicators: Partial<MarketState>) => void;
  setTrend: (trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => void;
  setBtcCorrelation: (correlation: number) => void;
  setLevel: (nearestLevel: number, distanceToLevel: number) => void;
  reset: () => void;
}

const initialState = {
  currentPrice: 0,
  priceChange: 0,
  priceChangePercent: 0,
  rsi: undefined,
  rsiEntry: undefined,
  rsiTrend1: undefined,
  ema20: undefined,
  ema50: undefined,
  atr: undefined,
  trend: undefined,
  btcCorrelation: undefined,
  nearestLevel: undefined,
  distanceToLevel: undefined,
};

export const useMarketStore = create<MarketState>((set) => ({
  ...initialState,

  setPrice: (price: number, change?: number, changePercent?: number) =>
    set({
      currentPrice: price,
      priceChange: change ?? 0,
      priceChangePercent: changePercent ?? 0,
    }),

  setIndicators: (indicators: Partial<MarketState>) =>
    set((state) => ({
      ...state,
      ...indicators,
    })),

  setTrend: (trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => set({ trend }),

  setBtcCorrelation: (btcCorrelation: number) => set({ btcCorrelation }),

  setLevel: (nearestLevel: number, distanceToLevel: number) =>
    set({ nearestLevel, distanceToLevel }),

  reset: () => set(initialState),
}));
