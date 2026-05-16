/**
 * Strategy Status Component
 *
 * Displays enabled/disabled status of trading strategies with ability to toggle
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Settings, Loader } from 'lucide-react';
import type { StrategyConfigSummary, StrategyReloadedPayload } from '@edison/contracts/runtime-api';
import { configApi } from '../../services/api.service';
import { wsClient } from '../../services/websocket.service';

type Strategy = StrategyConfigSummary;

interface StrategyStatusProps {
  strategies?: Strategy[];
}

export function StrategyStatus({ strategies: initialStrategies = [] }: StrategyStatusProps) {
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const response = await configApi.getStrategies();
        if (response.success && response.data?.strategies) {
          setStrategies(response.data.strategies);
        }
      } catch (error) {
        console.error('Failed to load strategies:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadStrategies();
  }, []);

  useEffect(() => {
    const handleStrategiesReloaded = (data: StrategyReloadedPayload) => {
      if (data.strategies) {
        setStrategies(data.strategies);
      }
    };

    wsClient.on('STRATEGIES_RELOADED', handleStrategiesReloaded);

    return () => {
      wsClient.off('STRATEGIES_RELOADED', handleStrategiesReloaded);
    };
  }, []);

  const toggleStrategy = async (strategyId: string, currentEnabled: boolean) => {
    setToggling(strategyId);
    try {
      const response = await configApi.toggleStrategy(strategyId, !currentEnabled);
      if (response.success) {
        setStrategies((prev) =>
          prev.map((strategy) =>
            strategy.id === strategyId ? { ...strategy, enabled: !strategy.enabled } : strategy
          )
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

  const getStrategyStateLabel = (enabled: boolean): string => (enabled ? 'Enabled' : 'Disabled');
  const getToggleActionLabel = (enabled: boolean): string => (enabled ? 'Disable' : 'Enable');

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
          <p className="text-sm text-gray-500">Click to enable or disable strategies</p>
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
                  {getStrategyStateLabel(strategy.enabled)}
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
                  ) : (
                    getToggleActionLabel(strategy.enabled)
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-3 mt-4">
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-600">Active Strategies</p>
          <p className="font-semibold text-gray-900">
            {strategies.filter((strategy) => strategy.enabled).length}/{strategies.length}
          </p>
        </div>
      </div>
    </div>
  );
}
