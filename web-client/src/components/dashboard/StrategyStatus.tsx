/**
 * Strategy Status Component
 *
 * Displays enabled/disabled status of trading strategies with ability to toggle
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Settings, Loader } from 'lucide-react';
import { configApi } from '../../services/api.service';
import { wsClient } from '../../services/websocket.service';

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

interface StrategyStatusProps {
  strategies?: Strategy[];
}

export function StrategyStatus({ strategies: initialStrategies = [] }: StrategyStatusProps) {
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Load strategies from API
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const response = await configApi.getStrategies() as any;
        if (response?.success && response?.data?.strategies) {
          setStrategies(response.data?.strategies as any);
        }
      } catch (error) {
        console.error('Failed to load strategies:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadStrategies();
  }, []);

  // Listen for strategy changes via WebSocket
  useEffect(() => {
    wsClient.on('STRATEGIES_RELOADED', (data: any) => {
      if (data.strategies) {
        setStrategies(data.strategies);
      }
    });

    return () => {
      wsClient.off('STRATEGIES_RELOADED', () => {});
    };
  }, []);

  const toggleStrategy = async (strategyId: string, currentEnabled: boolean) => {
    setToggling(strategyId);
    try {
      const response = await configApi.toggleStrategy(strategyId, !currentEnabled);
      if (response.success) {
        // Update local state
        setStrategies((prev) =>
          prev.map((s) => (s.id === strategyId ? { ...s, enabled: !s.enabled } : s))
        );
      } else {
        console.error('Failed to toggle strategy:', response.error);
      }
    } catch (error) {
      console.error('Failed to toggle strategy:', error);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500 flex items-center justify-center h-64">
        <Loader className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Active Strategies</h2>
          <p className="text-sm text-gray-500">Click to enable/disable strategies</p>
        </div>
        <Settings className="w-6 h-6 text-indigo-600" />
      </div>

      <div className="space-y-3">
        {strategies.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No strategies configured</p>
        ) : (
          strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={`p-3 rounded-lg border transition ${
                strategy.enabled
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {strategy.enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{strategy.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-medium ${
                    strategy.enabled ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {strategy.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
                <button
                  onClick={() => toggleStrategy(strategy.id, strategy.enabled)}
                  disabled={toggling === strategy.id}
                  className="px-3 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: strategy.enabled ? '#ef4444' : '#22c55e',
                    color: 'white',
                    opacity: toggling === strategy.id ? 0.7 : 1,
                    cursor: toggling === strategy.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {toggling === strategy.id ? (
                    <span className="flex items-center gap-1">
                      <Loader className="w-3 h-3 animate-spin" />
                      Updating...
                    </span>
                  ) : strategy.enabled ? (
                    'Disable'
                  ) : (
                    'Enable'
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="border-t pt-3 mt-4">
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-600">Active Strategies</p>
          <p className="font-semibold text-gray-900">
            {strategies.filter((s) => s.enabled).length}/{strategies.length}
          </p>
        </div>
      </div>
    </div>
  );
}
