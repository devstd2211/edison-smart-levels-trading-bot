/**
 * Bot Store (Zustand)
 *
 * Manages bot state: running status, position, balance, signals
 */

import { create } from 'zustand';
import type { Position, Signal } from '@edison/contracts/runtime-api';

export interface BotState {
  // Bot status
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;

  // Position data
  currentPosition: Position | null;
  balance: number;
  unrealizedPnL: number;

  // Recent signals
  recentSignals: Signal[];

  // Actions
  setRunning: (running: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPosition: (position: Position | null) => void;
  setBalance: (balance: number) => void;
  setUnrealizedPnL: (pnl: number) => void;
  addSignal: (signal: Signal) => void;
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
  setPosition: (position: Position | null) => set({ currentPosition: position }),
  setBalance: (balance: number) => set({ balance }),
  setUnrealizedPnL: (pnl: number) => set({ unrealizedPnL: pnl }),

  addSignal: (signal: Signal) =>
    set((state) => ({
      recentSignals: [signal, ...state.recentSignals].slice(0, 10),
    })),

  clearSignals: () => set({ recentSignals: [] }),

  reset: () => set(initialState),
}));
