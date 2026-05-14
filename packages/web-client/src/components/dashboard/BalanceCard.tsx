/**
 * Balance Card Component
 *
 * Displays account balance and unrealized PnL
 */

import React from 'react';
import { useBotStore } from '../../stores/botStore';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getBoundedMagnitudePercent,
  getMetricDirection,
  getSignedValuePrefix,
} from '../../utils/metric-direction';

export function BalanceCard() {
  const { balance, unrealizedPnL } = useBotStore();

  const pnlPercent = balance > 0 ? (unrealizedPnL / balance) * 100 : 0;
  const pnlDirection = getMetricDirection(unrealizedPnL);
  const pnlPercentDirection = getMetricDirection(pnlPercent);

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
            {pnlDirection === 'positive' ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : pnlDirection === 'negative' ? (
              <TrendingDown className="w-4 h-4 text-red-600" />
            ) : (
              <Wallet className="w-4 h-4 text-gray-500" />
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <p
              className={`text-2xl font-bold ${
                pnlDirection === 'positive'
                  ? 'text-green-600'
                  : pnlDirection === 'negative'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {getSignedValuePrefix(pnlDirection)}{formatNumber(unrealizedPnL)} USDT
            </p>
            <p
              className={`text-sm font-medium ${
                pnlPercentDirection === 'positive'
                  ? 'text-green-600'
                  : pnlPercentDirection === 'negative'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {getSignedValuePrefix(pnlPercentDirection)}{pnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Visual indicator */}
      <div className="mt-6 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            pnlPercentDirection === 'positive'
              ? 'bg-green-500'
              : pnlPercentDirection === 'negative'
                ? 'bg-red-500'
                : 'bg-gray-400'
          }`}
          style={{
            width: `${getBoundedMagnitudePercent(pnlPercent, 2)}%`,
          }}
        />
      </div>
    </div>
  );
}
