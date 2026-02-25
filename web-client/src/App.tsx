/**
 * App Component
 *
 * Main application root with routing and WebSocket setup
 */

import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Settings, Zap, Moon, Sun } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { AdvancedAnalytics } from './pages/AdvancedAnalytics';
import { Control } from './pages/Control';
import { OrderBook } from './pages/OrderBook';
import { wsClient } from './services/websocket.service';
import { configApi } from './services/api.service';
import { useConfigStore } from './stores/configStore';
import { useThemeStore } from './stores/themeStore';

type Page = 'dashboard' | 'analytics' | 'advanced-analytics' | 'orderbook' | 'control';

type BotConfigShape = {
  exchange?: {
    symbol?: string;
    timeframe?: string;
  };
  trading?: {
    leverage?: number;
    riskPercent?: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toBotConfig = (value: unknown): BotConfigShape | null => {
  if (!isRecord(value)) {
    return null;
  }
  const exchange = isRecord(value.exchange) ? value.exchange : undefined;
  const trading = isRecord(value.trading) ? value.trading : undefined;

  return {
    exchange: exchange
      ? {
          symbol: getString(exchange.symbol),
          timeframe: getString(exchange.timeframe),
        }
      : undefined,
    trading: trading
      ? {
          leverage: getNumber(trading.leverage),
          riskPercent: getNumber(trading.riskPercent),
        }
      : undefined,
  };
};

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { setConfig, setLoading, setError } = useConfigStore();
  const { theme, toggleTheme, setTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme on mount
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Initialize: fetch bot config and WebSocket
    const initializeApp = async () => {
      setLoading(true);
      try {
        // Fetch bot configuration
        const response = await configApi.getConfig();
        if (response.success && response.data) {
          const config = toBotConfig(response.data);
          setConfig({
            symbol: config?.exchange?.symbol || 'BTCUSDT',
            timeframe: config?.exchange?.timeframe || '5m',
            leverage: config?.trading?.leverage || 1,
            riskPercent: config?.trading?.riskPercent || 1,
          });
          console.log(`[App] Config loaded: ${config?.exchange?.symbol ?? 'Unknown'}`);
        }
      } catch (error) {
        console.error('[App] Failed to load config:', error);
        setError('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    // Connect WebSocket
    wsClient.connect().catch((error) => {
      console.error('[App] Failed to connect to WebSocket:', error);
    });

    // Load config
    void initializeApp();

    return () => {
      wsClient.disconnect();
    };
  }, [setConfig, setLoading, setError]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edison</h1>

          <nav className="flex gap-4 items-center">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'dashboard'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              Dashboard
            </button>

            <div className="relative group">
              <button
                onClick={() => setCurrentPage('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === 'analytics' || currentPage === 'advanced-analytics'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <div className="hidden group-hover:block absolute left-0 mt-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => setCurrentPage('analytics')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                >
                  Trade Analytics
                </button>
                <button
                  onClick={() => setCurrentPage('advanced-analytics')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                >
                  Advanced Analytics
                </button>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('orderbook')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'orderbook'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              OrderBook
            </button>

            <button
              onClick={() => setCurrentPage('control')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'control'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Control
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'analytics' && <Analytics />}
        {currentPage === 'advanced-analytics' && <AdvancedAnalytics />}
        {currentPage === 'orderbook' && <OrderBook />}
        {currentPage === 'control' && <Control />}
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Trading Bot Web Interface v3.0 - PHASE 6 Complete (Dashboard - Analytics - OrderBook - Control)</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
