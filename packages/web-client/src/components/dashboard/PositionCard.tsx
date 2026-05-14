/**
 * Position Card Component
 *
 * Displays current position details with enhanced visualization
 */

import React, { useState, useEffect } from 'react';
import { useBotStore } from '../../stores/botStore';
import type { Position } from '../../types';
import { TrendingUp, TrendingDown, X, Clock } from 'lucide-react';
import { getSignedValuePrefix } from '../../utils/metric-direction';
import {
  getPositionDistanceMetric,
  getPositionProgressPercent,
} from '../../utils/position-metrics';

function resolveTimestamp(value: number | string | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  return null;
}

export function PositionCard() {
  const { currentPosition } = useBotStore();
  const [timeInPosition, setTimeInPosition] = useState('0s');
  type TakeProfit = Position['takeProfits'][number];

  useEffect(() => {
    if (!currentPosition) return;

    const updateTime = () => {
      const openedAt = resolveTimestamp(currentPosition.openedAt);
      if (openedAt === null) {
        return;
      }

      const duration = Math.floor((Date.now() - openedAt) / 1000);
      setTimeInPosition(formatDuration(duration));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentPosition?.openedAt]);

  if (!currentPosition) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-gray-300 dark:border-gray-600 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Position</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">No active position</p>
          </div>
          <X className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    );
  }

  const isLong = currentPosition.side === 'LONG';
  const pnlPercent = currentPosition.unrealizedPnLPercent ?? 0;
  const unrealizedPnl = currentPosition.unrealizedPnL;
  const pnlDirection =
    unrealizedPnl > 0 ? 'profit' : unrealizedPnl < 0 ? 'loss' : 'flat';
  const resolvedCurrentPrice = currentPosition.currentPrice ?? currentPosition.entryPrice;

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

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 transition-colors ${
        isLong ? 'border-blue-500 dark:border-blue-400' : 'border-red-500 dark:border-red-400'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Position</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active trade</p>
            <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{timeInPosition}</p>
          </div>
        </div>
        {isLong ? (
          <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Side</p>
          <p
            className={`text-lg font-bold ${
              isLong ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {currentPosition.side}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Qty</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatNumber(currentPosition.quantity)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Entry</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${formatNumber(currentPosition.entryPrice)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Current</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${formatNumber(resolvedCurrentPrice)}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">Unrealized PnL</p>
          <p
            className={`text-sm font-semibold ${
              pnlDirection === 'profit'
                ? 'text-green-600 dark:text-green-400'
                : pnlDirection === 'loss'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {pnlDirection === 'profit' ? '+' : ''}
            {formatNumber(unrealizedPnl)} ({pnlPercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Stop Loss</p>
          <div className="text-right">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              ${formatNumber(currentPosition.stopLoss.price)}
            </p>
            {(() => {
              const slDistance = getPositionDistanceMetric(
                resolvedCurrentPrice,
                currentPosition.stopLoss.price,
                currentPosition.entryPrice
              );
              if (slDistance !== null) {
                return (
                  <p
                    className={`text-xs ${
                      slDistance.direction === 'negative'
                        ? 'text-red-600 dark:text-red-400'
                        : slDistance.direction === 'neutral'
                          ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {getSignedValuePrefix(slDistance.direction)}
                    {slDistance.value.toFixed(2)}% away
                  </p>
                );
              }
              return null;
            })()}
          </div>
        </div>
        {currentPosition.stopLoss.breakeven !== undefined && currentPosition.stopLoss.breakeven !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Breakeven triggered at: ${formatNumber(currentPosition.stopLoss.breakeven)}
          </p>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Take Profits</p>
        <div className="space-y-3">
          {currentPosition.takeProfits.map((tp: TakeProfit, idx: number) => {
            const targetPrice = tp.price ?? 0;
            const progress = getPositionProgressPercent(
              currentPosition.entryPrice,
              resolvedCurrentPrice,
              targetPrice
            );
            const distance = getPositionDistanceMetric(
              resolvedCurrentPrice,
              targetPrice,
              currentPosition.entryPrice
            );

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">TP{idx + 1}</span>
                    {tp.hit && (
                      <span className="text-green-600 dark:text-green-400 text-xs font-bold">Hit</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${formatNumber(tp.price)} ({formatNumber(tp.quantity)})
                    </div>
                    {!tp.hit && distance !== null && (
                      <div
                        className={`text-xs ${
                          distance.direction === 'positive'
                            ? 'text-green-600 dark:text-green-400'
                            : distance.direction === 'negative'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {getSignedValuePrefix(distance.direction)}
                        {distance.value.toFixed(2)}% away
                      </div>
                    )}
                  </div>
                </div>
                {!tp.hit && progress > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
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
