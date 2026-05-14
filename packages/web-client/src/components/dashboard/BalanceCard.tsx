/**
 * Balance Card Component
 *
 * Displays account balance and unrealized PnL
 */

import React from 'react';
import { useBotStore } from '../../stores/botStore';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

export function BalanceCard() {
  const { balance, unrealizedPnL } = useBotStore();

  const pnlPercent = balance > 0 ? (unrealizedPnL / balance) * 100 : 0;
  const pnlDirection =
    unrealizedPnL > 0 ? 'profit' : unrealizedPnL < 0 ? 'loss' : 'flat';

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Account Balance</h2>
          <p className="text-sm text-gray-500">Current trading account</p>
        </div>
        <Wallet className="w-6 h-6 text-green-600" />
      </div>

      <div className="space-y-6">
        {/* Balance */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Balance</p>
          <p className="text-3xl font-bold text-gray-900">
            ${formatNumber(balance)}
          </p>
        </div>

        {/* Unrealized PnL */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Unrealized PnL</p>
            {pnlDirection === 'profit' ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : pnlDirection === 'loss' ? (
              <TrendingDown className="w-4 h-4 text-red-600" />
            ) : (
              <Wallet className="w-4 h-4 text-gray-500" />
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <p
              className={`text-2xl font-bold ${
                pnlDirection === 'profit'
                  ? 'text-green-600'
                  : pnlDirection === 'loss'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {pnlDirection === 'profit' ? '+' : ''}{formatNumber(unrealizedPnL)} USDT
            </p>
            <p
              className={`text-sm font-medium ${
                pnlDirection === 'profit'
                  ? 'text-green-600'
                  : pnlDirection === 'loss'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {pnlDirection === 'profit' ? '+' : ''}{pnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Visual indicator */}
      <div className="mt-6 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            pnlDirection === 'profit'
              ? 'bg-green-500'
              : pnlDirection === 'loss'
                ? 'bg-red-500'
                : 'bg-gray-400'
          }`}
          style={{
            width: `${Math.min(Math.abs(pnlPercent) * 2, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
