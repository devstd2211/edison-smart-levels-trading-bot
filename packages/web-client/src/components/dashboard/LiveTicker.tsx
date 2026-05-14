/**
 * Live Ticker Component
 *
 * Displays current price and key indicators
 * Updates via WebSocket for real-time data
 */

import React, { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import type { WebApiMarketData } from '@edison/contracts';
import { dataApi } from '../../services/api.service';
import { useMarketStore } from '../../stores/marketStore';
import { wsClient } from '../../services/websocket.service';
import {
  getBoundedMagnitudePercent,
  getMetricDirection,
  getSignedValuePrefix,
} from '../../utils/metric-direction';

const FALLBACK_LABEL = 'N/A';
type PriceDirection = 'up' | 'down' | 'flat';

export function LiveTicker() {
  const market = useMarketStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [lastPrice, setLastPrice] = useState(market.currentPrice);
  const [loading, setLoading] = useState(true);
  const pendingMarketPrice = useRef<number | null>(null);

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
    const handleMarketDataUpdate = (data: WebApiMarketData) => {
      // Update price and indicators
      // This would typically update the market store
      if (typeof data.currentPrice === 'number') {
        pendingMarketPrice.current = data.currentPrice;
        setLastPrice(data.currentPrice);
      }
    };

    wsClient.on('MARKET_DATA_UPDATE', handleMarketDataUpdate);

    return () => {
      wsClient.off('MARKET_DATA_UPDATE', handleMarketDataUpdate);
    };
  }, []);

  useEffect(() => {
    if (
      pendingMarketPrice.current !== null
      && market.currentPrice !== pendingMarketPrice.current
    ) {
      return;
    }

    if (market.currentPrice !== lastPrice && lastPrice !== 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      pendingMarketPrice.current = null;
      setLastPrice(market.currentPrice);
      return () => clearTimeout(timer);
    }

    pendingMarketPrice.current = null;
    setLastPrice(market.currentPrice);
  }, [lastPrice, market.currentPrice]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatIndicator = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return value.toFixed(2);
  };

  const formatMetricPrice = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return `$${formatPrice(value)}`;
  };

  const formatCorrelation = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return value.toFixed(3);
  };

  const formatDistanceToLevel = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return `${value.toFixed(2)}%`;
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

  const priceChangeDirection = getMetricDirection(market.priceChangePercent);
  const priceDirection: PriceDirection =
    priceChangeDirection === 'positive'
      ? 'up'
      : priceChangeDirection === 'negative'
        ? 'down'
        : 'flat';

  const priceChangeColorClass =
    priceDirection === 'up'
      ? 'text-green-600 dark:text-green-400'
      : priceDirection === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-300';

  const priceChangeBarColorClass =
    priceDirection === 'up'
      ? 'bg-green-500 dark:bg-green-400'
      : 'bg-red-500 dark:bg-red-400';

  const priceDirectionLabel =
    priceDirection === 'up'
      ? 'UP'
      : priceDirection === 'down'
        ? 'DOWN'
        : 'FLAT';

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-gray-300 dark:border-gray-600 animate-pulse transition-colors">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <Zap className="w-6 h-6 text-gray-300 dark:text-gray-600" />
        </div>
        <div className="mb-6">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500 dark:border-yellow-400 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Market Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Real-time price and indicators</p>
        </div>
        <div className="flex items-center gap-2">
          {isFlashing && (
            <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full animate-ping"></div>
          )}
          <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Price</p>
        <div className="flex items-baseline gap-3">
          <p
            className={`text-4xl font-bold transition-all duration-300 ${
              isFlashing
                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 px-2 rounded'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            ${formatPrice(market.currentPrice)}
          </p>
          <div className="flex flex-col">
            <p
              className={`text-lg font-bold ${priceChangeColorClass}`}
            >
              {priceDirectionLabel}{' '}
              {getSignedValuePrefix(priceChangeDirection)}
              {market.priceChangePercent.toFixed(2)}%
            </p>
            {market.priceChangePercent !== 0 && (
              <div className="mt-1">
                <div
                  className={`h-1 rounded-full ${priceChangeBarColorClass}`}
                  style={{ width: `${getBoundedMagnitudePercent(market.priceChangePercent, 10)}px` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">RSI (14)</p>
          <p
            className={`text-lg font-bold ${
              market.rsi !== undefined
                ? market.rsi > 70
                  ? 'text-red-600 dark:text-red-400'
                  : market.rsi < 30
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {formatIndicator(market.rsi)}
          </p>
          {market.rsi !== undefined && (
            <>
              <p
                className={`text-xs font-semibold mt-1 ${
                  market.rsi > 70
                    ? 'text-red-600 dark:text-red-400'
                    : market.rsi < 30
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {market.rsi > 70 ? 'Overbought' : market.rsi < 30 ? 'Oversold' : 'Neutral'}
              </p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    market.rsi > 70
                      ? 'bg-red-500 dark:bg-red-400'
                      : market.rsi < 30
                        ? 'bg-green-500 dark:bg-green-400'
                        : 'bg-blue-500 dark:bg-blue-400'
                  }`}
                  style={{ width: `${market.rsi}%` }}
                />
              </div>
            </>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">EMA20</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMetricPrice(market.ema20)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">EMA50</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMetricPrice(market.ema50)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">ATR</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMetricPrice(market.atr)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Trend</p>
          <p className={`text-lg font-bold ${getTrendColor(market.trend)}`}>
            {market.trend || FALLBACK_LABEL}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">BTC Corr</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCorrelation(market.btcCorrelation)}
          </p>
        </div>
      </div>

      {market.nearestLevel !== undefined && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">Nearest Level</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              ${formatPrice(market.nearestLevel)}
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                ({formatDistanceToLevel(market.distanceToLevel)})
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
