/**
 * Config Editor Component
 *
 * JSON editor with validation and diff preview
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Copy, RefreshCw, Save } from 'lucide-react';
import { configApi } from '../../services/api.service';

interface ValidationError {
  field: string;
  message: string;
}

interface ConfigEditorProps {
  currentConfig?: Record<string, any>;
  onSave?: (config: Record<string, any>) => Promise<void>;
}

export function ConfigEditor({ currentConfig = {}, onSave }: ConfigEditorProps) {
  const [configJson, setConfigJson] = useState(JSON.stringify(currentConfig, null, 2));
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const parseConfig = (jsonString: string): Record<string, any> | null => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  const validateConfig = (config: Record<string, any>): ValidationError[] => {
    const newErrors: ValidationError[] = [];

    if (!config || typeof config !== 'object') {
      newErrors.push({ field: 'root', message: 'Configuration must be a valid object' });
      return newErrors;
    }

    // Validate risk settings if present
    if (config.risk) {
      if (config.risk.maxLeverage && typeof config.risk.maxLeverage !== 'number') {
        newErrors.push({ field: 'risk.maxLeverage', message: 'Must be a number' });
      }
      if (config.risk.maxPositionSize && typeof config.risk.maxPositionSize !== 'number') {
        newErrors.push({ field: 'risk.maxPositionSize', message: 'Must be a number' });
      }
      if (config.risk.dailyLossLimit && typeof config.risk.dailyLossLimit !== 'number') {
        newErrors.push({ field: 'risk.dailyLossLimit', message: 'Must be a number' });
      }
    }

    // Validate strategies if present
    if (config.strategies && typeof config.strategies !== 'object') {
      newErrors.push({ field: 'strategies', message: 'Must be an object' });
    }

    return newErrors;
  };

  const handleJsonChange = (newJson: string) => {
    setConfigJson(newJson);
    setSuccess(false);

    const parsed = parseConfig(newJson);
    if (parsed) {
      const validationErrors = validateConfig(parsed);
      setErrors(validationErrors);
    } else {
      setErrors([{ field: 'json', message: 'Invalid JSON syntax' }]);
    }
  };

  const handleSave = async () => {
    const parsed = parseConfig(configJson);
    if (!parsed) {
      setErrors([{ field: 'json', message: 'Invalid JSON syntax' }]);
      return;
    }

    const validationErrors = validateConfig(parsed);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsLoading(true);
      if (onSave) {
        await onSave(parsed);
      } else {
        // Save via API
        const result = await configApi.saveConfig(parsed);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save configuration');
        }
      }

      setSuccess(true);
      setErrors([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setErrors([
        {
          field: 'save',
          message: error instanceof Error ? error.message : 'Failed to save configuration',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setConfigJson(JSON.stringify(currentConfig, null, 2));
    setErrors([]);
    setSuccess(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(configJson);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Configuration Editor</h2>
        <p className="text-sm text-gray-600">
          Edit configuration in JSON format. Changes require bot restart.
        </p>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-6 space-y-2">
          {errors.map((error, idx) => (
            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error.field}</p>
                <p className="text-sm text-red-700">{error.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">Configuration Saved</p>
            <p className="text-sm text-green-700">
              Changes have been saved. Bot restart required for changes to take effect.
            </p>
          </div>
        </div>
      )}

      {/* JSON Editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">JSON Configuration</label>
        <textarea
          value={configJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          className={`w-full h-96 p-4 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'
          }`}
          spellCheck="false"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={isLoading || errors.length > 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleReset}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>

        <button
          onClick={() => setShowDiff(!showDiff)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition font-medium ${
            showDiff
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Show Diff
        </button>
      </div>

      {/* Validation Hints */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuration Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
          <div className="flex gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Risk settings must be numbers</span>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Strategies object contains strategy configs</span>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>All changes require bot restart</span>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Automatic backups created on save</span>
          </div>
        </div>
      </div>

      {/* JSON Preview */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuration Preview</h3>
        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-700 font-mono">
            {parseConfig(configJson)
              ? JSON.stringify(parseConfig(configJson), null, 2)
              : 'Invalid JSON'}
          </pre>
        </div>
      </div>
    </div>
  );
}
