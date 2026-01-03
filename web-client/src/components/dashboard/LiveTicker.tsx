/**
 * Live Ticker Component
 *
 * Displays current price and key indicators
 * Updates via WebSocket for real-time data
 */

import React, { useEffect, useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { dataApi } from '../../services/api.service';
import { wsClient } from '../../services/websocket.service';
import { Zap } from 'lucide-react';

export function LiveTicker() {
  const market = useMarketStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [lastPrice, setLastPrice] = useState(market.currentPrice);
  const [loading, setLoading] = useState(true);

  // Load initial market data from API
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await dataApi.getMarketData();
        if (response.success && response.data) {
          // Update market store with real data
          // TODO: dispatch to market store once WebSocket event is set up
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchMarketData();
  }, []);

  // Listen for market data updates via WebSocket
  useEffect(() => {
    wsClient.on('MARKET_DATA_UPDATE', (data: any) => {
      // Update price and indicators
      // This would typically update the market store
      if (data.currentPrice) {
        setLastPrice(data.currentPrice);
      }
    });

    return () => {
      wsClient.off('MARKET_DATA_UPDATE', () => {});
    };
  }, []);

  useEffect(() => {
    if (market.currentPrice !== lastPrice && lastPrice !== 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      return () => clearTimeout(timer);
    }
    setLastPrice(market.currentPrice);
  }, [market.currentPrice]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatIndicator = (value: number | undefined) => {
    if (value === undefined) return '—';
    return value.toFixed(2);
  };

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'BULLISH':
        return 'text-green-600';
      case 'BEARISH':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Live Market Data</h2>
          <p className="text-sm text-gray-500">Real-time price and indicators</p>
        </div>
        <Zap className="w-6 h-6 text-yellow-600" />
      </div>

      {/* Current Price */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">Current Price</p>
        <div className="flex items-baseline gap-3">
          <p
            className={`text-4xl font-bold transition-colors ${
              isFlashing ? 'bg-yellow-100 text-yellow-900' : 'text-gray-900'
            }`}
          >
            ${formatPrice(market.currentPrice)}
          </p>
          <p
            className={`text-lg font-semibold ${
              market.priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {market.priceChangePercent >= 0 ? '+' : ''}{market.priceChangePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t pt-6">
        {/* RSI */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">RSI (14)</p>
          <p className="text-lg font-bold text-gray-900">
            {formatIndicator(market.rsi)}
          </p>
          {market.rsi !== undefined && (
            <p className="text-xs text-gray-500 mt-1">
              {market.rsi > 70 ? 'Overbought' : market.rsi < 30 ? 'Oversold' : 'Neutral'}
            </p>
          )}
        </div>

        {/* EMA20 */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">EMA20</p>
          <p className="text-lg font-bold text-gray-900">
            ${formatPrice(market.ema20 || 0)}
          </p>
        </div>

        {/* EMA50 */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">EMA50</p>
          <p className="text-lg font-bold text-gray-900">
            ${formatPrice(market.ema50 || 0)}
          </p>
        </div>

        {/* ATR */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">ATR</p>
          <p className="text-lg font-bold text-gray-900">
            ${formatPrice(market.atr || 0)}
          </p>
        </div>

        {/* Trend */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Trend</p>
          <p className={`text-lg font-bold ${getTrendColor(market.trend)}`}>
            {market.trend || '—'}
          </p>
        </div>

        {/* BTC Correlation */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">BTC Corr</p>
          <p className="text-lg font-bold text-gray-900">
            {market.btcCorrelation ? market.btcCorrelation.toFixed(3) : '—'}
          </p>
        </div>
      </div>

      {/* Level Info */}
      {market.nearestLevel !== undefined && (
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Nearest Level</p>
            <p className="text-sm font-semibold text-gray-900">
              ${formatPrice(market.nearestLevel)}
              <span className="text-gray-500 ml-2">
                ({market.distanceToLevel?.toFixed(2)}%)
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
