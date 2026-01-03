/**
 * Trend Slider Component
 *
 * Displays market trend direction as a dynamic slider
 * Visual representation from BEARISH (left) to BULLISH (right)
 */

import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketStore } from '../../stores/marketStore';

export function TrendSlider() {
  const { trend, btcCorrelation } = useMarketStore();

  // Calculate position based on trend
  // Assume trend values: BEARISH (-1), NEUTRAL (0), BULLISH (1)
  // Map to percentage: -1 → 0%, 0 → 50%, 1 → 100%
  const getTrendValue = (): number => {
    switch (trend) {
      case 'BEARISH':
        return 0;
      case 'NEUTRAL':
        return 50;
      case 'BULLISH':
        return 100;
      default:
        return 50; // Default to neutral
    }
  };

  const position = getTrendValue();

  // Get trend color
  const getTrendColor = (): string => {
    switch (trend) {
      case 'BULLISH':
        return '#22c55e';
      case 'BEARISH':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  // Get strength description
  const getStrengthDescription = (): string => {
    switch (trend) {
      case 'BULLISH':
        return 'Strong Uptrend';
      case 'BEARISH':
        return 'Strong Downtrend';
      default:
        return 'Ranging Market';
    }
  };

  const trendColor = getTrendColor();
  const strengthDesc = getStrengthDescription();

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Market Trend</h2>
          <p className="text-sm text-gray-500">{strengthDesc}</p>
        </div>
      </div>

      {/* Trend Slider */}
      <div className="mb-6">
        <div className="relative h-10 bg-gradient-to-r from-red-500 via-gray-300 to-green-500 rounded-full overflow-hidden mb-4">
          {/* Position indicator */}
          <div
            className="absolute top-0 h-10 w-1 bg-white shadow-lg transition-all duration-300"
            style={{
              left: `${position}%`,
              transform: 'translateX(-50%)',
            }}
          />

          {/* Slider thumb */}
          <div
            className="absolute top-1 h-8 w-8 bg-white border-4 rounded-full transition-all duration-300"
            style={{
              left: `${position}%`,
              transform: 'translateX(-50%)',
              borderColor: trendColor,
              boxShadow: `0 0 12px ${trendColor}40`,
            }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between px-2">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-600">BEARISH</span>
          </div>
          <span className="text-xs font-medium text-gray-600">NEUTRAL</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-green-600">BULLISH</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
        </div>
      </div>

      {/* Trend Details */}
      <div className="grid grid-cols-2 gap-3 border-t pt-4">
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Current Trend</p>
          <p
            className="text-lg font-bold"
            style={{ color: trendColor }}
          >
            {trend || '—'}
          </p>
        </div>

        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">BTC Correlation</p>
          <p className="text-lg font-bold text-gray-900">
            {btcCorrelation ? btcCorrelation.toFixed(3) : '—'}
          </p>
        </div>
      </div>

      {/* Trend Signals */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-medium text-blue-900">
          {trend === 'BULLISH'
            ? '📈 Momentum favors buyers - Long positions advantageous'
            : trend === 'BEARISH'
              ? '📉 Momentum favors sellers - Short positions advantageous'
              : '⚖️ Market is ranging - Both directions possible'}
        </p>
      </div>
    </div>
  );
}
