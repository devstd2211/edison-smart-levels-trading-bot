/**
 * Config Store (Zustand)
 *
 * Manages bot configuration: symbol, timeframe, trading settings
 * Fetched from backend on app initialization
 */

import { create } from 'zustand';

export interface ConfigState {
  // Exchange config
  symbol: string;
  timeframe: string;
  leverage: number;
  riskPercent: number;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setLeverage: (leverage: number) => void;
  setRiskPercent: (riskPercent: number) => void;
  setConfig: (config: Partial<ConfigState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialState = {
  symbol: 'BTCUSDT',
  timeframe: '5m',
  leverage: 1,
  riskPercent: 1,
  isLoading: false,
  error: null,
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...initialState,

  setSymbol: (symbol: string) => set({ symbol }),
  setTimeframe: (timeframe: string) => set({ timeframe }),
  setLeverage: (leverage: number) => set({ leverage }),
  setRiskPercent: (riskPercent: number) => set({ riskPercent }),

  setConfig: (config: Partial<ConfigState>) =>
    set((state) => ({
      ...state,
      ...config,
    })),

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
}));
