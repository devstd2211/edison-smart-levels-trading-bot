/**
 * Bot Store (Zustand)
 *
 * Manages bot state: running status, position, balance, signals
 */

import { create } from 'zustand';

export interface BotState {
  // Bot status
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;

  // Position data
  currentPosition: any | null;
  balance: number;
  unrealizedPnL: number;

  // Recent signals
  recentSignals: any[];

  // Actions
  setRunning: (running: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPosition: (position: any | null) => void;
  setBalance: (balance: number) => void;
  setUnrealizedPnL: (pnl: number) => void;
  addSignal: (signal: any) => void;
  clearSignals: () => void;
  reset: () => void;
}

const initialState = {
  isRunning: false,
  isLoading: false,
  error: null,
  currentPosition: null,
  balance: 0,
  unrealizedPnL: 0,
  recentSignals: [],
};

export const useBotStore = create<BotState>((set) => ({
  ...initialState,

  setRunning: (running: boolean) => set({ isRunning: running }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  setPosition: (position: any | null) => set({ currentPosition: position }),
  setBalance: (balance: number) => set({ balance }),
  setUnrealizedPnL: (pnl: number) => set({ unrealizedPnL: pnl }),

  addSignal: (signal: any) =>
    set((state) => ({
      recentSignals: [signal, ...state.recentSignals].slice(0, 10),
    })),

  clearSignals: () => set({ recentSignals: [] }),

  reset: () => set(initialState),
}));
