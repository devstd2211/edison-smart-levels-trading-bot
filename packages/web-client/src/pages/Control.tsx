/**
 * Control Page
 *
 * Bot control panel for configuration, strategies, and risk management
 */

import React, { useEffect, useState } from 'react';
import { Settings, ToggleLeft, AlertTriangle } from 'lucide-react';
import type {
  ConfigSchemaPayload,
  ControlConfigPayload,
  StrategyConfigSummary,
} from '@edison/contracts/runtime-api';
import { ConfigEditor } from '../components/control/ConfigEditor';
import { StrategyToggles } from '../components/control/StrategyToggles';
import { RiskSettings } from '../components/control/RiskSettings';
import { configApi } from '../services/api.service';
import {
  applyRiskSettingsToConfig,
  buildRiskSummaryRows,
  applyStrategyToggleToConfig,
  createFallbackConfigSchema,
  createFallbackControlConfig,
  getStrategyDescription,
  loadControlBootstrap,
} from '../services/control-config-bootstrap';

type Tab = 'config' | 'strategies' | 'risk';

export function Control() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [currentConfig, setCurrentConfig] = useState<ControlConfigPayload>(() => createFallbackControlConfig());
  const [strategySummaries, setStrategySummaries] = useState<StrategyConfigSummary[]>([]);
  const [configSchema, setConfigSchema] = useState<ConfigSchemaPayload>(() => createFallbackConfigSchema());

  useEffect(() => {
    let cancelled = false;

    const loadControlData = async () => {
      try {
        if (cancelled) {
          return;
        }

        const bootstrap = await loadControlBootstrap();
        if (!cancelled) {
          setCurrentConfig(bootstrap.config);
          setStrategySummaries(bootstrap.strategies);
          setConfigSchema(bootstrap.schema);
        }
      } catch (error) {
        console.error('Failed to load control data:', error);
      }
    };

    void loadControlData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bot Control Panel</h1>
        <p className="text-gray-600 mt-1">Configure bot parameters, strategies, and risk settings</p>
      </div>

      {/* Warning Notice */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Important</p>
          <p className="text-sm text-red-700 mt-1">
            Configuration changes require a bot restart to take effect. Backups are automatically
            created before each change.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configuration
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('strategies')}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'strategies'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <ToggleLeft className="w-4 h-4" />
          Strategies
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('risk')}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'risk'
              ? 'border-yellow-600 text-yellow-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Risk Management
        </button>
      </div>

      {/* Content */}
      <div>
        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <ConfigEditor
              currentConfig={currentConfig}
              onSave={async (config) => {
                setCurrentConfig(config);
                // API call happens in the component itself
              }}
            />

            {/* Configuration Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Reference</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <p className="font-medium text-gray-900">Config Locations</p>
                    <code className="text-xs bg-gray-50 p-2 rounded block mt-1 break-all">
                      D:\src\Edison\config.json
                    </code>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Backup Location</p>
                    <code className="text-xs bg-gray-50 p-2 rounded block mt-1 break-all">
                      Same directory (config.json.backup.*)
                    </code>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Hot Tips</h3>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Always validate JSON before saving</li>
                  <li>Backups are created automatically</li>
                  <li>Changes take effect after bot restart</li>
                  <li>Use Copy button to backup current config</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <div className="space-y-6">
            <StrategyToggles
              strategies={strategySummaries.map((strategy) => ({
                ...strategy,
                description: getStrategyDescription(strategy),
              }))}
              onToggle={async (strategyId, enabled) => {
                const result = await configApi.toggleStrategy(strategyId, enabled);
                if (!result.success) {
                  throw new Error(result.error || 'Failed to toggle strategy');
                }

                setStrategySummaries((prev) =>
                  prev.map((strategy) =>
                    strategy.id === strategyId ? { ...strategy, enabled } : strategy
                  )
                );
                setCurrentConfig((prev) => applyStrategyToggleToConfig(prev, strategyId, enabled));
              }}
            />

            {/* Strategy Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Details</h3>
              {strategySummaries.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Strategy details appear after the active runtime configuration loads.
                </p>
              ) : (
                <div className="space-y-3 text-sm text-gray-600">
                  {strategySummaries.map((strategy) => (
                    <div key={strategy.id}>
                      <p className="font-medium text-gray-900">{strategy.name}</p>
                      <p className="mt-1">{getStrategyDescription(strategy)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Management Tab */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            <RiskSettings
              currentRisk={currentConfig.risk}
              onSave={async (risk) => {
                setCurrentConfig((prev) => applyRiskSettingsToConfig(prev, risk));
              }}
            />

            {/* Risk Guidelines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Risk Management Guidelines
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Risk/Reward ratio should be 1:2 or higher</li>
                  <li>Max position size typically 5-10% of account</li>
                  <li>Stop loss tighter = higher win rate potential</li>
                  <li>Daily loss limit prevents large drawdowns</li>
                  <li>Leverage increases both profit and loss potential</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Settings</h3>
                <div className="space-y-2 text-sm">
                  {buildRiskSummaryRows(currentConfig.risk, configSchema).map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-gray-600">{item.label}:</span>
                      <span className="font-semibold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
