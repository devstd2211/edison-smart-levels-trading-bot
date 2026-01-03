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
  const isProfit = unrealizedPnL >= 0;

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
            {isProfit ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <p
              className={`text-2xl font-bold ${
                isProfit ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isProfit ? '+' : ''}{formatNumber(unrealizedPnL)} USDT
            </p>
            <p
              className={`text-sm font-medium ${
                isProfit ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Visual indicator */}
      <div className="mt-6 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}
          style={{
            width: `${Math.min(Math.abs(pnlPercent) * 2, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
