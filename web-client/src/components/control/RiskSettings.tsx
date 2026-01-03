/**
 * Risk Settings Component
 *
 * Configure risk management parameters
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { configApi } from '../../services/api.service';

interface RiskParams {
  maxLeverage?: number;
  maxPositionSize?: number;
  dailyLossLimit?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

interface RiskSettingsProps {
  currentRisk?: RiskParams;
  onSave?: (risk: RiskParams) => Promise<void>;
}

export function RiskSettings({ currentRisk = {}, onSave }: RiskSettingsProps) {
  const [risk, setRisk] = useState<RiskParams>({
    maxLeverage: currentRisk.maxLeverage || 5,
    maxPositionSize: currentRisk.maxPositionSize || 0.1,
    dailyLossLimit: currentRisk.dailyLossLimit || 100,
    stopLossPercent: currentRisk.stopLossPercent || 1.5,
    takeProfitPercent: currentRisk.takeProfitPercent || 3.0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validateRisk = (): boolean => {
    const newErrors: string[] = [];

    if (!risk.maxLeverage || risk.maxLeverage < 1 || risk.maxLeverage > 100) {
      newErrors.push('Max Leverage must be between 1 and 100');
    }

    if (!risk.maxPositionSize || risk.maxPositionSize <= 0 || risk.maxPositionSize > 1) {
      newErrors.push('Max Position Size must be between 0 and 1 (0-100%)');
    }

    if (!risk.dailyLossLimit || risk.dailyLossLimit <= 0) {
      newErrors.push('Daily Loss Limit must be greater than 0');
    }

    if (!risk.stopLossPercent || risk.stopLossPercent <= 0 || risk.stopLossPercent > 10) {
      newErrors.push('Stop Loss % must be between 0 and 10');
    }

    if (!risk.takeProfitPercent || risk.takeProfitPercent <= 0) {
      newErrors.push('Take Profit % must be greater than 0');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateRisk()) {
      return;
    }

    try {
      setIsLoading(true);

      if (onSave) {
        await onSave(risk);
      } else {
        // Call API to update risk settings
        const result = await configApi.updateRiskSettings(risk);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save risk settings');
        }
      }

      setSuccess(true);
      setErrors([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to save risk settings']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof RiskParams, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setRisk((prev) => ({
        ...prev,
        [field]: numValue,
      }));
      setSuccess(false);
    }
  };

  // Calculate W/L ratio example
  const wlRatio = risk.takeProfitPercent && risk.stopLossPercent
    ? (risk.takeProfitPercent / risk.stopLossPercent).toFixed(2)
    : 'N/A';

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Risk Management</h2>
          <p className="text-sm text-gray-600">Configure risk parameters and position limits</p>
        </div>
        <AlertTriangle className="w-6 h-6 text-yellow-600" />
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-6 space-y-2">
          {errors.map((error, idx) => (
            <div
              key={idx}
              className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-green-800">Risk settings saved successfully</p>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Max Leverage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Leverage
            <span className="text-gray-500 font-normal"> (1-100x)</span>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            step="0.1"
            value={risk.maxLeverage}
            onChange={(e) => handleChange('maxLeverage', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Maximum position leverage allowed (1x = no leverage)
          </p>
        </div>

        {/* Max Position Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Position Size
            <span className="text-gray-500 font-normal"> (0-1)</span>
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={risk.maxPositionSize}
            onChange={(e) => handleChange('maxPositionSize', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            {`${(((risk.maxPositionSize || 0) * 100)).toFixed(1)}% of account balance per trade`}
          </p>
        </div>

        {/* Daily Loss Limit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Loss Limit
            <span className="text-gray-500 font-normal"> (USDT)</span>
          </label>
          <input
            type="number"
            min="0"
            step="10"
            value={risk.dailyLossLimit}
            onChange={(e) => handleChange('dailyLossLimit', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Maximum loss allowed per day (stops trading when exceeded)
          </p>
        </div>

        {/* Stop Loss Percent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stop Loss %
            <span className="text-gray-500 font-normal"> (0-10%)</span>
          </label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={risk.stopLossPercent}
            onChange={(e) => handleChange('stopLossPercent', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Default distance from entry to place stop loss
          </p>
        </div>

        {/* Take Profit Percent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Take Profit %
            <span className="text-gray-500 font-normal"> (&gt;0%)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={risk.takeProfitPercent}
            onChange={(e) => handleChange('takeProfitPercent', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Default distance from entry to place take profit
          </p>
        </div>

        {/* Risk Ratio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Risk/Reward Ratio
            <span className="text-gray-500 font-normal"> (Auto-calculated)</span>
          </label>
          <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
            <span className="text-lg font-semibold text-gray-900">1:{wlRatio}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Ratio of profit target to loss limit (higher is better)
          </p>
        </div>
      </div>

      {/* Risk Information */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 space-y-2 text-sm text-yellow-800">
        <div className="font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Risk Parameters
        </div>
        <ul className="space-y-1 text-yellow-700 ml-6 list-disc">
          <li>Stop Loss % defines automatic exit loss limit</li>
          <li>Take Profit % defines automatic exit profit target</li>
          <li>Risk/Reward ratio should ideally be 1:2 or higher</li>
          <li>Current ratio: 1:{wlRatio}</li>
          <li>Daily Loss Limit acts as circuit breaker for the day</li>
        </ul>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isLoading}
        className="flex items-center gap-2 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
      >
        <Save className="w-4 h-4" />
        {isLoading ? 'Saving...' : 'Save Risk Settings'}
      </button>
    </div>
  );
}
