/**
 * Strategy Toggles Component
 *
 * Enable/disable individual trading strategies
 */

import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { configApi } from '../../services/api.service';

interface Strategy {
  name: string;
  enabled: boolean;
  description?: string;
  icon?: string;
}

interface StrategyTogglesProps {
  strategies?: Strategy[];
  onToggle?: (strategyName: string, enabled: boolean) => Promise<void>;
}

export function StrategyToggles({ strategies = [], onToggle }: StrategyTogglesProps) {
  const [strategiesList, setStrategiesList] = useState<Strategy[]>(
    strategies.length > 0
      ? strategies
      : [
          {
            name: 'Level Based',
            enabled: true,
            description: 'Trade from support/resistance levels',
          },
          {
            name: 'Trend Following',
            enabled: true,
            description: 'Follow EMA crossovers',
          },
          {
            name: 'Counter Trend',
            enabled: false,
            description: 'Trade reversals from RSI extremes',
          },
          {
            name: 'WhaleHunter',
            enabled: false,
            description: 'Detect and follow whale orders',
          },
        ]
  );

  const [loading, setLoading] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleToggle = async (strategyName: string, newState: boolean) => {
    try {
      setLoading(strategyName);

      if (onToggle) {
        await onToggle(strategyName, newState);
      } else {
        // Call API to toggle strategy
        const result = await configApi.toggleStrategy(strategyName, newState);
        if (!result.success) {
          throw new Error(result.error || 'Failed to toggle strategy');
        }
      }

      // Update local state
      setStrategiesList((prev) =>
        prev.map((s) => (s.name === strategyName ? { ...s, enabled: newState } : s))
      );

      setMessages({
        type: 'success',
        text: `${strategyName} ${newState ? 'enabled' : 'disabled'} successfully`,
      });

      setTimeout(() => setMessages(null), 3000);
    } catch (error) {
      setMessages({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to toggle strategy',
      });
    } finally {
      setLoading(null);
    }
  };

  const enabledCount = strategiesList.filter((s) => s.enabled).length;
  const totalCount = strategiesList.length;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Strategy Controls</h2>
          <p className="text-sm text-gray-600">
            Enable or disable trading strategies individually
          </p>
        </div>
        <Zap className="w-6 h-6 text-green-600" />
      </div>

      {/* Messages */}
      {messages && (
        <div
          className={`mb-6 p-4 rounded-lg flex gap-3 ${
            messages.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {messages.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm font-medium ${
              messages.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {messages.text}
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Active Strategies: <span className="font-semibold text-gray-900">{enabledCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalCount}</span>
        </p>
        <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(enabledCount / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="space-y-3">
        {strategiesList.map((strategy) => (
          <div
            key={strategy.name}
            className={`p-4 rounded-lg border transition ${
              strategy.enabled
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{strategy.name}</h3>
                {strategy.description && (
                  <p className="text-sm text-gray-600 mt-1">{strategy.description}</p>
                )}
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => handleToggle(strategy.name, !strategy.enabled)}
                disabled={loading === strategy.name}
                className="ml-4 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === strategy.name ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                ) : strategy.enabled ? (
                  <ToggleRight className="w-8 h-8 text-green-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`px-2 py-1 rounded ${
                  strategy.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {strategy.enabled ? '✓ Active' : '✗ Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-6 pt-6 border-t border-gray-200 bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Note:</span> Toggling strategies is instant. However, new
          strategy configurations may require a bot restart to take full effect.
        </p>
      </div>
    </div>
  );
}
