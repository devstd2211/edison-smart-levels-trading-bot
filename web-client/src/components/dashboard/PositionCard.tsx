/**
 * Position Card Component
 *
 * Displays current position details with enhanced visualization
 */

import React, { useState, useEffect } from 'react';
import { useBotStore } from '../../stores/botStore';
import { TrendingUp, TrendingDown, X, Clock } from 'lucide-react';

export function PositionCard() {
  const { currentPosition } = useBotStore();
  const [timeInPosition, setTimeInPosition] = useState('0s');

  // Update time in position every second
  useEffect(() => {
    if (!currentPosition?.openedAt) return;

    const updateTime = () => {
      const openedAt = typeof currentPosition.openedAt === 'number'
        ? currentPosition.openedAt
        : new Date(currentPosition.openedAt).getTime();
      const duration = Math.floor((Date.now() - openedAt) / 1000);
      setTimeInPosition(formatDuration(duration));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentPosition?.openedAt]);

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

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const calculateProgress = (entry: number, current: number, target: number): number => {
    if (entry === target) return 0;
    const progress = ((current - entry) / (target - entry)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const calculateDistance = (current: number, target: number, entry: number): number => {
    return ((target - current) / entry) * 100;
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">Active trade</p>
            <Clock className="w-3 h-3 text-gray-400" />
            <p className="text-sm text-gray-600 font-medium">{timeInPosition}</p>
          </div>
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
          <div className="text-right">
            <p className="text-sm font-semibold text-red-600">
              ${formatNumber(currentPosition.stopLoss.price)}
            </p>
            {(() => {
              const slDistance = calculateDistance(
                currentPosition.currentPrice || currentPosition.entryPrice,
                currentPosition.stopLoss.price,
                currentPosition.entryPrice
              );
              if (slDistance !== 0) {
                return (
                  <p className={`text-xs ${slDistance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {slDistance > 0 ? '+' : ''}{slDistance.toFixed(2)}% away
                  </p>
                );
              }
              return null;
            })()}
          </div>
        </div>
        {currentPosition.stopLoss.breakeven && (
          <p className="text-xs text-gray-500">
            Breakeven triggered at: ${formatNumber(currentPosition.stopLoss.breakeven)}
          </p>
        )}
      </div>

      {/* Take Profits */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-600 mb-3">Take Profits</p>
        <div className="space-y-3">
          {(currentPosition?.takeProfits || []).map((tp: any, idx: number) => {
            const progress = calculateProgress(
              currentPosition.entryPrice,
              currentPosition.currentPrice || currentPosition.entryPrice,
              tp?.price || 0
            );
            const distance = calculateDistance(
              currentPosition.currentPrice || currentPosition.entryPrice,
              tp?.price || 0,
              currentPosition.entryPrice
            );

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">TP{idx + 1}</span>
                    {tp?.hit && (
                      <span className="text-green-600 text-xs font-bold">✓ HIT</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${formatNumber(tp?.price)} ({formatNumber(tp?.quantity)})
                    </div>
                    {!tp?.hit && distance !== 0 && (
                      <div className={`text-xs ${distance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {distance > 0 ? '+' : ''}{distance.toFixed(2)}% away
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {!tp?.hit && progress > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
