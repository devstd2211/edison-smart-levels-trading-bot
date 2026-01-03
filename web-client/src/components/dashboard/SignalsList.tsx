/**
 * Signals List Component
 *
 * Displays recent trading signals
 */

import React from 'react';
import { useBotStore } from '../../stores/botStore';
import { MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';

export function SignalsList() {
  const { recentSignals } = useBotStore();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'LONG':
        return 'text-green-600 bg-green-50';
      case 'SHORT':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'LONG' ? (
      <ArrowUp className="w-4 h-4" />
    ) : direction === 'SHORT' ? (
      <ArrowDown className="w-4 h-4" />
    ) : null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recent Signals</h2>
          <p className="text-sm text-gray-500">Last 10 trading signals</p>
        </div>
        <MessageSquare className="w-6 h-6 text-purple-600" />
      </div>

      {recentSignals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No signals yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentSignals.map((signal, idx) => (
            <div
              key={idx}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${getDirectionColor(
                      signal.direction
                    )}`}
                  >
                    {getDirectionIcon(signal.direction)}
                    {signal.direction}
                  </div>
                  <span className="text-sm text-gray-600">{signal.type}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTime(signal.timestamp)}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                <div>
                  <p className="text-gray-600">Confidence</p>
                  <p className="font-semibold text-gray-900">{signal.confidence}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Price</p>
                  <p className="font-semibold text-gray-900">
                    ${signal.price.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">SL</p>
                  <p className="font-semibold text-gray-900">
                    ${signal.stopLoss.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">TP Count</p>
                  <p className="font-semibold text-gray-900">
                    {signal.takeProfits.length}
                  </p>
                </div>
              </div>

              {signal.reason && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {signal.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
