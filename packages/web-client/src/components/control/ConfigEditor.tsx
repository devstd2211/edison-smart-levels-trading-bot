/**
 * Config Editor Component
 *
 * JSON editor with validation and diff preview
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import type {
  BotConfigPayload,
  ConfigMutationPreviewPayload,
  ConfigUpdateResponsePayload,
  ConfigValidationIssuePayload,
  ConfigValidationResponsePayload,
} from '@edison/contracts/runtime-api';
import { configApi } from '../../services/api.service';
import {
  describeMutationPreviewChange,
  describeMutationPreviewSummary,
} from './config-mutation-preview';

interface ConfigEditorProps {
  currentConfig?: BotConfigPayload;
  onSave?: (config: BotConfigPayload) => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type ConfigEditorStatusTone = 'neutral' | 'info' | 'success' | 'error';

interface ConfigEditorStatus {
  tone: ConfigEditorStatusTone;
  title: string;
  description: string;
}

const EMPTY_VALIDATION_RESULT: ConfigValidationResponsePayload = {
  valid: true,
  errors: [],
  warnings: [],
  summary: {
    errorCount: 0,
    warningCount: 0,
    issueCount: 0,
  },
};

const createIssue = (path: string, message: string): ConfigValidationIssuePayload => ({
  path,
  message,
});

const createValidationResponse = (
  errors: ConfigValidationIssuePayload[],
  warnings: ConfigValidationIssuePayload[] = [],
): ConfigValidationResponsePayload => ({
  valid: errors.length === 0,
  errors,
  warnings,
  summary: {
    errorCount: errors.length,
    warningCount: warnings.length,
    issueCount: errors.length + warnings.length,
  },
});

export function ConfigEditor({ currentConfig = {}, onSave }: ConfigEditorProps) {
  const [configJson, setConfigJson] = useState(JSON.stringify(currentConfig, null, 2));
  const [validationResult, setValidationResult] =
    useState<ConfigValidationResponsePayload>(EMPTY_VALIDATION_RESULT);
  const [status, setStatus] = useState<ConfigEditorStatus>({
    tone: 'neutral',
    title: 'Editor Ready',
    description: 'Validate the JSON payload before saving configuration changes.',
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [previewResult, setPreviewResult] = useState<ConfigMutationPreviewPayload | null>(null);

  const parseConfig = (jsonString: string): BotConfigPayload | null => {
    try {
      const parsed = JSON.parse(jsonString);
      return isRecord(parsed) ? (parsed as BotConfigPayload) : null;
    } catch {
      return null;
    }
  };

  const createSyntaxValidationResult = (message: string): ConfigValidationResponsePayload =>
    createValidationResponse([createIssue('json', message)]);

  const applyValidationResult = (
    nextValidation: ConfigValidationResponsePayload,
    nextStatus?: ConfigEditorStatus,
  ) => {
    setValidationResult(nextValidation);

    if (nextStatus) {
      setStatus(nextStatus);
      return;
    }

    if (nextValidation.valid) {
      setStatus({
        tone: 'success',
        title: 'Configuration Validated',
        description: 'The shared config validation endpoint accepted the current JSON payload.',
      });
      return;
    }

    setStatus({
      tone: 'error',
      title: 'Validation Failed',
      description: `Found ${nextValidation.summary.errorCount} validation issue(s) that must be fixed before saving.`,
    });
  };

  const validateParsedConfig = async (
    config: BotConfigPayload,
  ): Promise<ConfigValidationResponsePayload | null> => {
    const response = await configApi.validateConfig(config);

    if (!response.success || !response.data) {
      setStatus({
        tone: 'error',
        title: 'Validation Request Failed',
        description: !response.success
          ? (response.error || 'Failed to validate configuration')
          : 'Failed to validate configuration',
      });
      return null;
    }

    applyValidationResult(response.data);
    return response.data;
  };

  const applySaveSuccess = async (
    config: BotConfigPayload,
    result: ConfigUpdateResponsePayload,
  ) => {
    setPreviewResult(result.preview);
    setValidationResult(result.validation);
    setStatus({
      tone: 'success',
      title: 'Configuration Saved',
      description: `${result.message}. ${describeMutationPreviewSummary(result.preview.summary)} Backup snapshot: ${result.backupPath}`,
    });

    await onSave?.(config);
  };

  const handleJsonChange = (newJson: string) => {
    setConfigJson(newJson);
    setPreviewResult(null);
    setValidationResult(EMPTY_VALIDATION_RESULT);

    const parsed = parseConfig(newJson);
    if (parsed) {
      setStatus({
        tone: 'info',
        title: 'JSON Updated',
        description: 'Run validation to refresh the shared config checks before saving.',
      });
    } else {
      applyValidationResult(
        createSyntaxValidationResult('Invalid JSON syntax'),
        {
          tone: 'error',
          title: 'Invalid JSON',
          description: 'Fix the JSON syntax before validation or save.',
        },
      );
    }
  };

  const handleValidate = async () => {
    const parsed = parseConfig(configJson);
    if (!parsed) {
      applyValidationResult(
        createSyntaxValidationResult('Invalid JSON syntax'),
        {
          tone: 'error',
          title: 'Invalid JSON',
          description: 'Fix the JSON syntax before validation or save.',
        },
      );
      return;
    }

    setIsValidating(true);
    setStatus({
      tone: 'info',
      title: 'Validating Configuration',
      description: 'Running shared server-side config validation.',
    });

    try {
      await validateParsedConfig(parsed);
    } catch (error) {
      setStatus({
        tone: 'error',
        title: 'Validation Request Failed',
        description: error instanceof Error ? error.message : 'Failed to validate configuration',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    const parsed = parseConfig(configJson);
    if (!parsed) {
      applyValidationResult(
        createSyntaxValidationResult('Invalid JSON syntax'),
        {
          tone: 'error',
          title: 'Invalid JSON',
          description: 'Fix the JSON syntax before validation or save.',
        },
      );
      return;
    }

    setIsSaving(true);
    setStatus({
      tone: 'info',
      title: 'Saving Configuration',
      description: 'Validating the payload and writing the updated config snapshot.',
    });

    try {
      const validation = await validateParsedConfig(parsed);
      if (!validation || !validation.valid) {
        return;
      }

      const result = await configApi.saveConfig(parsed);
      if (!result.success || !result.data) {
        throw new Error(
          !result.success ? (result.error || 'Failed to save configuration') : 'Failed to save configuration',
        );
      }

      await applySaveSuccess(parsed, result.data);
    } catch (error) {
      setStatus({
        tone: 'error',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    const parsed = parseConfig(configJson);
    if (!parsed) {
      setPreviewResult(null);
      applyValidationResult(
        createSyntaxValidationResult('Invalid JSON syntax'),
        {
          tone: 'error',
          title: 'Invalid JSON',
          description: 'Fix the JSON syntax before previewing changes.',
        },
      );
      return;
    }

    setIsPreviewing(true);
    setStatus({
      tone: 'info',
      title: 'Preparing Diff Preview',
      description: 'Comparing the current JSON payload with the loaded configuration snapshot.',
    });

    try {
      const response = await configApi.previewConfig(parsed);

      if (!response.success || !response.data) {
        throw new Error(
          !response.success ? (response.error || 'Failed to preview configuration changes') : 'Failed to preview configuration changes',
        );
      }

      setPreviewResult(response.data);
      applyValidationResult(response.data.validation, {
        tone: response.data.validation.valid ? 'info' : 'error',
        title: response.data.summary.totalChanges > 0 ? 'Diff Preview Ready' : 'No Changes Detected',
        description: describeMutationPreviewSummary(response.data.summary),
      });
    } catch (error) {
      setPreviewResult(null);
      setStatus({
        tone: 'error',
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to preview configuration changes',
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleReset = () => {
    setConfigJson(JSON.stringify(currentConfig, null, 2));
    setPreviewResult(null);
    setValidationResult(EMPTY_VALIDATION_RESULT);
    setStatus({
      tone: 'neutral',
      title: 'Editor Reset',
      description: 'The editor content now matches the last loaded configuration snapshot.',
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(configJson);
  };

  useEffect(() => {
    setConfigJson(JSON.stringify(currentConfig, null, 2));
    setPreviewResult(null);
    setValidationResult(EMPTY_VALIDATION_RESULT);
    setStatus({
      tone: 'neutral',
      title: 'Configuration Loaded',
      description: 'Validate the current JSON payload before saving changes.',
    });
  }, [currentConfig]);

  const issues = [...validationResult.errors, ...validationResult.warnings];
  const isBusy = isValidating || isPreviewing || isSaving;
  const hasBlockingErrors = !validationResult.valid && validationResult.summary.errorCount > 0;
  const statusClassName = status.tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-800'
    : status.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : status.tone === 'info'
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-gray-200 bg-gray-50 text-gray-700';

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Configuration Editor</h2>
        <p className="text-sm text-gray-600">
          Edit configuration in JSON format. Changes require bot restart.
        </p>
      </div>

      <div className={`mb-6 rounded-lg border p-4 ${statusClassName}`}>
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{status.title}</p>
            <p className="text-sm">{status.description}</p>
            <p className="mt-2 text-xs">
              Errors: {validationResult.summary.errorCount} | Warnings: {validationResult.summary.warningCount}
            </p>
          </div>
        </div>
      </div>

      {/* Validation Messages */}
      {issues.length > 0 && (
        <div className="mb-6 space-y-2">
          {issues.map((issue, idx) => (
            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{issue.path}</p>
                <p className="text-sm text-red-700">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* JSON Editor */}
      <div className="mb-6">
        <label htmlFor="config-editor-json" className="block text-sm font-medium text-gray-700 mb-2">
          JSON Configuration
        </label>
        <textarea
          id="config-editor-json"
          value={configJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          className={`w-full h-96 p-4 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            hasBlockingErrors ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'
          }`}
          spellCheck="false"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleValidate}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          <CheckCircle className="w-4 h-4" />
          {isValidating ? 'Validating...' : 'Validate Configuration'}
        </button>

        <button
          onClick={handleSave}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleReset}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={handleCopy}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>

        <button
          onClick={() => {
            if (showDiff) {
              setShowDiff(false);
              return;
            }

            setShowDiff(true);
            void handlePreview();
          }}
          disabled={isBusy}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition font-medium ${
            showDiff
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {isPreviewing ? 'Loading Diff...' : showDiff ? 'Hide Diff' : 'Show Diff'}
        </button>
      </div>

      {showDiff && (
        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">Config Change Preview</h3>
          <p className="mt-1 text-sm text-blue-800">
            {previewResult
              ? describeMutationPreviewSummary(previewResult.summary)
              : 'Preview the current JSON payload to inspect typed config changes before saving.'}
          </p>

          {previewResult && previewResult.changes.length > 0 ? (
            <div className="mt-4 space-y-3">
              {previewResult.changes.map((change) => (
                <div key={`${change.kind}-${change.path}`} className="rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-sm font-medium text-blue-900">
                    {change.path} <span className="uppercase text-xs text-blue-600">{change.kind}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{describeMutationPreviewChange(change)}</p>
                </div>
              ))}
            </div>
          ) : previewResult ? (
            <p className="mt-4 text-sm text-blue-800">
              The edited JSON matches the currently loaded configuration snapshot.
            </p>
          ) : null}
        </div>
      )}

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
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuration JSON Preview</h3>
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
