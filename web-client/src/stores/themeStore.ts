/**
 * Theme Store (Zustand)
 *
 * Manages UI theme (light/dark mode)
 * Persists theme preference in localStorage
 */

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Load theme from localStorage or use system preference
const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored) {
    return stored;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);

      // Update document class for Tailwind dark mode
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      return { theme: newTheme };
    }),

  setTheme: (theme: Theme) =>
    set(() => {
      localStorage.setItem('theme', theme);

      // Update document class for Tailwind dark mode
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      return { theme };
    }),
}));
