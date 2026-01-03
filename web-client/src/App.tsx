/**
 * App Component
 *
 * Main application root with routing and WebSocket setup
 */

import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Settings, Zap } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { AdvancedAnalytics } from './pages/AdvancedAnalytics';
import { Control } from './pages/Control';
import { OrderBook } from './pages/OrderBook';
import { wsClient } from './services/websocket.service';
import { configApi } from './services/api.service';
import { useConfigStore } from './stores/configStore';

type Page = 'dashboard' | 'analytics' | 'advanced-analytics' | 'orderbook' | 'control';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { setConfig, setLoading, setError } = useConfigStore();

  useEffect(() => {
    // Initialize: fetch bot config and WebSocket
    const initializeApp = async () => {
      setLoading(true);
      try {
        // Fetch bot configuration
        const response = await configApi.getConfig();
        if (response.success && response.data) {
          const config = response.data as any;
          setConfig({
            symbol: config.exchange?.symbol || 'BTCUSDT',
            timeframe: config.exchange?.timeframe || '5m',
            leverage: config.trading?.leverage || 1,
            riskPercent: config.trading?.riskPercent || 1,
          });
          console.log(`[App] Config loaded: ${config.exchange?.symbol}`);
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Edison</h1>

          <nav className="flex gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'dashboard'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
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
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <div className="hidden group-hover:block absolute left-0 mt-0 w-48 bg-white rounded-lg shadow-lg z-10">
                <button
                  onClick={() => setCurrentPage('analytics')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                >
                  Trade Analytics
                </button>
                <button
                  onClick={() => setCurrentPage('advanced-analytics')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                >
                  Advanced Analytics
                </button>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('orderbook')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'orderbook'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Zap className="w-4 h-4" />
              OrderBook
            </button>

            <button
              onClick={() => setCurrentPage('control')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'control'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              Control
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

      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-gray-500">
          <p>Trading Bot Web Interface v3.0 - PHASE 6 Complete (Dashboard - Analytics - OrderBook - Control)</p>
        </div>
      </footer>
    </div>
  );
}

export default App;