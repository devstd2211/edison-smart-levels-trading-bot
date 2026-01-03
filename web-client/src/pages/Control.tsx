/**
 * Control Page
 *
 * Bot control panel for configuration, strategies, and risk management
 */

import React, { useState } from 'react';
import { Settings, ToggleLeft, AlertTriangle } from 'lucide-react';
import { ConfigEditor } from '../components/control/ConfigEditor';
import { StrategyToggles } from '../components/control/StrategyToggles';
import { RiskSettings } from '../components/control/RiskSettings';

type Tab = 'config' | 'strategies' | 'risk';

export function Control() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [currentConfig, setCurrentConfig] = useState<Record<string, any>>({
    trading: {
      symbol: 'APEXUSDT',
      timeframe: '5m',
      enabled: true,
    },
    risk: {
      maxLeverage: 5,
      maxPositionSize: 0.1,
      dailyLossLimit: 100,
      stopLossPercent: 1.5,
      takeProfitPercent: 3.0,
    },
    strategies: {
      'Level Based': {
        enabled: true,
        minConfidence: 70,
      },
      'Trend Following': {
        enabled: true,
        minConfidence: 65,
      },
      'Counter Trend': {
        enabled: false,
        minConfidence: 75,
      },
    },
  });

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
              strategies={[
                {
                  name: 'Level Based',
                  enabled: currentConfig.strategies?.['Level Based']?.enabled ?? true,
                  description: 'Trade from support and resistance levels',
                },
                {
                  name: 'Trend Following',
                  enabled: currentConfig.strategies?.['Trend Following']?.enabled ?? true,
                  description: 'Follow EMA crossover signals',
                },
                {
                  name: 'Counter Trend',
                  enabled: currentConfig.strategies?.['Counter Trend']?.enabled ?? false,
                  description: 'Trade reversals from RSI extremes',
                },
                {
                  name: 'WhaleHunter',
                  enabled: false,
                  description: 'Detect and follow large wall orders',
                },
              ]}
              onToggle={async (strategyName, enabled) => {
                // Update local config
                setCurrentConfig((prev) => ({
                  ...prev,
                  strategies: {
                    ...prev.strategies,
                    [strategyName]: {
                      ...prev.strategies?.[strategyName],
                      enabled,
                    },
                  },
                }));
              }}
            />

            {/* Strategy Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Details</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <p className="font-medium text-gray-900">Level Based</p>
                  <p className="mt-1">Identifies support/resistance zones and trades bounces</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Trend Following</p>
                  <p className="mt-1">
                    Uses EMA crossovers to identify and follow trending movements
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Counter Trend</p>
                  <p className="mt-1">Detects oversold/overbought RSI conditions for reversals</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Risk Management Tab */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            <RiskSettings
              currentRisk={currentConfig.risk}
              onSave={async (risk) => {
                setCurrentConfig((prev) => ({
                  ...prev,
                  risk,
                }));
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
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Leverage:</span>
                    <span className="font-semibold text-gray-900">{currentConfig.risk?.maxLeverage}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Position Size:</span>
                    <span className="font-semibold text-gray-900">
                      {((currentConfig.risk?.maxPositionSize || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Loss Limit:</span>
                    <span className="font-semibold text-gray-900">
                      ${currentConfig.risk?.dailyLossLimit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SL:</span>
                    <span className="font-semibold text-gray-900">
                      {currentConfig.risk?.stopLossPercent}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TP:</span>
                    <span className="font-semibold text-gray-900">
                      {currentConfig.risk?.takeProfitPercent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
