/**
 * Position Card Component
 *
 * Displays current position details
 */

import React from 'react';
import { useBotStore } from '../../stores/botStore';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

export function PositionCard() {
  const { currentPosition } = useBotStore();

  if (!currentPosition) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Position</h2>
            <p className="text-sm text-gray-500">No active position</p>
          </div>
          <X className="w-8 h-8 text-gray-400" />
        </div>
      </div>
    );
  }

  const isLong = currentPosition.side === 'LONG';
  const pnlPercent = currentPosition.unrealizedPnLPercent || 0;
  const isProfit = currentPosition.unrealizedPnL >= 0;

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) {
      return '0.00';
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-6 border-l-4 ${
        isLong ? 'border-blue-500' : 'border-red-500'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Current Position</h2>
          <p className="text-sm text-gray-500">Active trade details</p>
        </div>
        {isLong ? (
          <TrendingUp className="w-6 h-6 text-blue-600" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-600" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Side */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Side</p>
          <p
            className={`text-lg font-bold ${
              isLong ? 'text-blue-600' : 'text-red-600'
            }`}
          >
            {currentPosition.side}
          </p>
        </div>

        {/* Quantity */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Qty</p>
          <p className="text-lg font-bold text-gray-900">
            {formatNumber(currentPosition?.quantity)}
          </p>
        </div>

        {/* Entry Price */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Entry</p>
          <p className="text-lg font-bold text-gray-900">
            ${formatNumber(currentPosition?.entryPrice)}
          </p>
        </div>

        {/* Current Price */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Current</p>
          <p className="text-lg font-bold text-gray-900">
            ${formatNumber(currentPosition?.currentPrice)}
          </p>
        </div>
      </div>

      {/* PnL */}
      <div className="border-t pt-4 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Unrealized PnL</p>
          <p
            className={`text-sm font-semibold ${
              isProfit ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isProfit ? '+' : ''}{formatNumber(currentPosition.unrealizedPnL)} ({pnlPercent.toFixed(
              2
            )}%)
          </p>
        </div>
      </div>

      {/* Stop Loss */}
      <div className="border-t pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Stop Loss</p>
          <p className="text-sm font-semibold text-red-600">
            ${formatNumber(currentPosition.stopLoss.price)}
          </p>
        </div>
        {currentPosition.stopLoss.breakeven && (
          <p className="text-xs text-gray-500">
            Breakeven triggered at: ${formatNumber(currentPosition.stopLoss.breakeven)}
          </p>
        )}
      </div>

      {/* Take Profits */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-600 mb-2">Take Profits</p>
        <div className="space-y-1">
          {(currentPosition?.takeProfits || []).map((tp: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">TP{idx + 1}</span>
              <span className="font-semibold text-gray-900">
                ${formatNumber(tp?.price)} ({formatNumber(tp?.quantity)})
              </span>
              {tp?.hit && <span className="text-green-600 text-xs font-bold">✓ HIT</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
