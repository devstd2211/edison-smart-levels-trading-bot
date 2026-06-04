/**
 * Config Management Service
 *
 * Encapsulates configuration management logic:
 * - Validation
 * - Backup/Restore
 * - History tracking
 * - Single Responsibility Principle
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  BotConfigPayload,
  ConfigBackupPayload,
  ConfigBackupCollectionPayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigMutationPreviewEntryPayload,
  ConfigMutationPreviewPayload,
  ConfigMutationPreviewSummaryPayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaPayload,
  ConfigUpdateResponsePayload,
  ConfigValidationIssuePayload,
  ConfigValidationResponsePayload,
  RiskSettingsPayload,
  RiskUpdateResponsePayload,
  StrategiesConfigPayload,
  StrategiesResponsePayload,
  StrategyConfigEntryPayload,
  StrategyToggleResponsePayload,
} from '@edison/contracts/runtime-api';
import {
  CONFIG_SCHEMA_METADATA as SHARED_CONFIG_SCHEMA_METADATA,
} from '@edison/contracts/runtime-api';
import { mapStrategyConfigSummaries } from '../routes/config-strategy-summary.js';
import { createConfigLifecycleLogPayload } from '../logging/request-scoped-error-log.js';

export interface ValidationResult {
  valid: boolean;
  errors: ConfigValidationIssuePayload[];
  warnings: ConfigValidationIssuePayload[];
  summary: ConfigValidationResponsePayload['summary'];
}

export type ConfigWriteResult = ConfigUpdateResponsePayload;
export type ConfigPreviewResult = ConfigMutationPreviewPayload;

type ConfigDocumentSnapshot = {
  config: BotConfigPayload;
  raw: string;
};

export class ConfigManagementService {
  constructor(private configPath: string) {}

  private logConfigInfo(message: string, payload: Record<string, unknown>): void {
    console.log(message, payload);
  }

  private logConfigWarn(message: string, payload: Record<string, unknown>): void {
    console.warn(message, payload);
  }

  private logConfigError(message: string, payload: Record<string, unknown>): void {
    console.error(message, payload);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getErrorCode(error: unknown): string | undefined {
    if (!this.isRecord(error)) {
      return undefined;
    }
    const code = error.code;
    return typeof code === 'string' ? code : undefined;
  }

  private ensureRecord(value: unknown, message: string): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new Error(message);
    }
    return value;
  }

  private createValidationIssue(path: string, message: string): ConfigValidationIssuePayload {
    return { path, message };
  }

  private createValidationResponse(
    errors: ConfigValidationIssuePayload[],
    warnings: ConfigValidationIssuePayload[] = [],
  ): ConfigValidationResponsePayload {
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
        issueCount: errors.length + warnings.length,
      },
    };
  }

  private ensureConfigPayload(value: unknown, message: string): BotConfigPayload {
    return this.ensureRecord(value, message) as BotConfigPayload;
  }

  private parseConfigDocument(data: string, invalidShapeMessage: string): BotConfigPayload {
    return this.ensureConfigPayload(
      JSON.parse(data),
      invalidShapeMessage,
    );
  }

  private async readConfigDocument(): Promise<ConfigDocumentSnapshot> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      return {
        raw,
        config: this.parseConfigDocument(
          raw,
          'Configuration file must contain a JSON object',
        ),
      };
    } catch (error) {
      if (this.getErrorCode(error) === 'ENOENT') {
        throw new Error('Configuration file not found');
      }
      throw new Error(`Failed to read configuration: ${(error as Error).message}`);
    }
  }

  private createTimestampedConfigPath(label: 'backup' | 'pre-restore'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${this.configPath}.${label}.${timestamp}.json`;
  }

  private async writeConfigFile(config: BotConfigPayload): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private formatValidationIssues(issues: ConfigValidationIssuePayload[]): string {
    return issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join(', ');
  }

  private valuesMatch(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private serializePreviewValue(value: unknown): string | null {
    if (value === undefined) {
      return null;
    }

    return JSON.stringify(value, null, 2);
  }

  private buildMutationPreviewChanges(
    currentValue: unknown,
    nextValue: unknown,
    currentPath: string = 'root',
  ): ConfigMutationPreviewEntryPayload[] {
    if (this.isRecord(currentValue) && this.isRecord(nextValue)) {
      const keys = new Set([
        ...Object.keys(currentValue),
        ...Object.keys(nextValue),
      ]);

      return [...keys]
        .sort((left, right) => left.localeCompare(right))
        .flatMap((key) => {
          const nextPath = currentPath === 'root' ? key : `${currentPath}.${key}`;
          const hasCurrent = Object.prototype.hasOwnProperty.call(currentValue, key);
          const hasNext = Object.prototype.hasOwnProperty.call(nextValue, key);

          if (!hasCurrent) {
            return [{
              path: nextPath,
              kind: 'added',
              previousValue: null,
              nextValue: this.serializePreviewValue(nextValue[key]),
            }];
          }

          if (!hasNext) {
            return [{
              path: nextPath,
              kind: 'removed',
              previousValue: this.serializePreviewValue(currentValue[key]),
              nextValue: null,
            }];
          }

          return this.buildMutationPreviewChanges(currentValue[key], nextValue[key], nextPath);
        });
    }

    if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
      return this.valuesMatch(currentValue, nextValue)
        ? []
        : [{
          path: currentPath,
          kind: 'updated',
          previousValue: this.serializePreviewValue(currentValue),
          nextValue: this.serializePreviewValue(nextValue),
        }];
    }

    return this.valuesMatch(currentValue, nextValue)
      ? []
      : [{
        path: currentPath,
        kind: 'updated',
        previousValue: this.serializePreviewValue(currentValue),
        nextValue: this.serializePreviewValue(nextValue),
      }];
  }

  private createMutationPreviewSummary(
    changes: ConfigMutationPreviewEntryPayload[],
  ): ConfigMutationPreviewSummaryPayload {
    const addedCount = changes.filter((change) => change.kind === 'added').length;
    const updatedCount = changes.filter((change) => change.kind === 'updated').length;
    const removedCount = changes.filter((change) => change.kind === 'removed').length;

    return {
      addedCount,
      updatedCount,
      removedCount,
      totalChanges: changes.length,
    };
  }

  private createMutationPreview(
    currentConfig: BotConfigPayload,
    nextConfig: BotConfigPayload,
    validation: ConfigValidationResponsePayload,
  ): ConfigMutationPreviewPayload {
    const changes = this.buildMutationPreviewChanges(currentConfig, nextConfig);

    return {
      changes,
      summary: this.createMutationPreviewSummary(changes),
      validation,
    };
  }

  /**
   * Validate configuration object
   */
  validate(config: unknown): ValidationResult {
    const errors: ConfigValidationIssuePayload[] = [];

    if (!this.isRecord(config)) {
      errors.push(this.createValidationIssue('root', 'Config must be a valid object'));
      return this.createValidationResponse(errors);
    }

    // Validate required fields
    if (!('trading' in config) && !('strategies' in config)) {
      errors.push(
        this.createValidationIssue(
          'root',
          'Config must have trading or strategies section',
        ),
      );
    }

    // Validate risk parameters if present
    if (this.isRecord(config.risk)) {
      if (config.risk.maxLeverage !== undefined && typeof config.risk.maxLeverage !== 'number') {
        errors.push(this.createValidationIssue('risk.maxLeverage', 'Must be a number'));
      }
      if (config.risk.maxPositionSize !== undefined && typeof config.risk.maxPositionSize !== 'number') {
        errors.push(this.createValidationIssue('risk.maxPositionSize', 'Must be a number'));
      }
      if (config.risk.dailyLossLimit !== undefined && typeof config.risk.dailyLossLimit !== 'number') {
        errors.push(this.createValidationIssue('risk.dailyLossLimit', 'Must be a number'));
      }
      if (config.risk.stopLossPercent !== undefined && typeof config.risk.stopLossPercent !== 'number') {
        errors.push(this.createValidationIssue('risk.stopLossPercent', 'Must be a number'));
      }
    }

    // Validate strategies if present
    if (config.strategies !== undefined && !this.isRecord(config.strategies)) {
      errors.push(this.createValidationIssue('strategies', 'Must be an object'));
    }

    // Validate riskManagement if present
    if (this.isRecord(config.riskManagement)) {
      if (
        config.riskManagement.positionSizeUsdt !== undefined
        && typeof config.riskManagement.positionSizeUsdt !== 'number'
      ) {
        errors.push(this.createValidationIssue('riskManagement.positionSizeUsdt', 'Must be a number'));
      }
      if (
        config.riskManagement.stopLossPercent !== undefined
        && typeof config.riskManagement.stopLossPercent !== 'number'
      ) {
        errors.push(this.createValidationIssue('riskManagement.stopLossPercent', 'Must be a number'));
      }
    }

    return this.createValidationResponse(errors);
  }

  /**
   * Read current configuration
   */
  async read(): Promise<BotConfigPayload> {
    const document = await this.readConfigDocument();
    return document.config;
  }

  /**
   * Write configuration with automatic backup
   */
  async write(
    config: BotConfigPayload
  ): Promise<ConfigWriteResult> {
    const currentDocument = await this.readConfigDocument();
    const currentConfig = currentDocument.config;

    // Validate before writing
    const validation = this.validate(config);
    const preview = this.createMutationPreview(currentConfig, config, validation);
    if (!validation.valid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(', ')}`,
      );
    }

    try {
      // Create backup of current config
      const backupPath = this.createTimestampedConfigPath('backup');

      try {
        await fs.writeFile(backupPath, currentDocument.raw);
        this.logConfigInfo('[Config] Backup created', createConfigLifecycleLogPayload({
          event: 'backup-created',
          backupPath,
        }));
      } catch (backupError) {
        this.logConfigWarn(
          '[Config] Failed to create backup, continuing with write',
          createConfigLifecycleLogPayload({
            event: 'backup-create-failed',
            backupPath,
            error: backupError,
          }),
        );
      }

      // Write new configuration
      await this.writeConfigFile(config);
      this.logConfigInfo('[Config] Configuration updated successfully', createConfigLifecycleLogPayload({
        event: 'config-updated',
        backupPath,
      }));

      return {
        backupPath,
        message: 'Configuration updated successfully',
        requiresRestart: true,
        preview,
        validation,
      };
    } catch (error) {
      throw new Error(`Failed to write configuration: ${(error as Error).message}`);
    }
  }

  async preview(config: BotConfigPayload): Promise<ConfigPreviewResult> {
    const currentConfig = await this.read();
    const validation = this.validate(config);
    return this.createMutationPreview(currentConfig, config, validation);
  }

  async getStrategySummaries(): Promise<StrategiesResponsePayload> {
    const config = await this.read();
    const strategies = mapStrategyConfigSummaries(config.strategies);

    return {
      strategies,
      total: strategies.length,
      active: strategies.filter((strategy) => strategy.enabled).length,
    };
  }

  async updateStrategyToggle(
    strategyId: string,
    enabled: boolean,
  ): Promise<StrategyToggleResponsePayload> {
    const config = await this.read();
    const strategies = this.ensureRecord(config.strategies, 'Invalid strategies configuration');
    const strategyConfig = this.ensureRecord(
      strategies[strategyId],
      `Strategy '${strategyId}' not found in configuration`,
    );
    const nextStrategies: StrategiesConfigPayload = {
      ...(strategies as StrategiesConfigPayload),
      [strategyId]: {
        ...(strategyConfig as StrategyConfigEntryPayload),
        enabled,
      },
    };

    await this.write({
      ...config,
      strategies: nextStrategies,
    });

    return {
      strategy: strategyId,
      enabled,
      message: `Strategy ${strategyId} ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  async updateRiskSettings(riskPatch: RiskSettingsPayload): Promise<RiskUpdateResponsePayload> {
    const config = await this.read();
    const risk = this.isRecord(config.risk) ? { ...config.risk } : {};
    const riskManagement = this.isRecord(config.riskManagement) ? { ...config.riskManagement } : {};

    if (riskPatch.maxLeverage !== undefined) risk.maxLeverage = riskPatch.maxLeverage;
    if (riskPatch.maxPositionSize !== undefined) risk.maxPositionSize = riskPatch.maxPositionSize;
    if (riskPatch.dailyLossLimit !== undefined) risk.dailyLossLimit = riskPatch.dailyLossLimit;
    if (riskPatch.stopLossPercent !== undefined) {
      risk.stopLossPercent = riskPatch.stopLossPercent;
      riskManagement.stopLossPercent = riskPatch.stopLossPercent;
    }
    if (riskPatch.takeProfitPercent !== undefined) risk.takeProfitPercent = riskPatch.takeProfitPercent;

    const nextConfig: BotConfigPayload = {
      ...config,
      risk,
    };

    if (Object.keys(riskManagement).length > 0) {
      nextConfig.riskManagement = riskManagement;
    }

    await this.write(nextConfig);

    return {
      message: 'Risk settings updated successfully',
      risk: {
        ...risk,
        ...riskManagement,
      },
    };
  }

  /**
   * Get configuration backups
   */
  async getBackups(): Promise<ConfigBackupPayload[]> {
    try {
      const dir = path.dirname(this.configPath);
      const filename = path.basename(this.configPath);
      const backupPattern = `${filename}.backup.`;

      const files = await fs.readdir(dir);
      const backups: ConfigBackupPayload[] = [];

      for (const file of files) {
        if (file.startsWith(backupPattern)) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          const timestampStr = file.replace(backupPattern, '').replace('.json', '');

          backups.push({
            id: timestampStr,
            timestamp: stats.mtimeMs,
            filePath,
            path: filePath,
            filename: file,
            size: stats.size,
          });
        }
      }

      // Sort by timestamp descending
      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logConfigError('[Config] Failed to get backups', createConfigLifecycleLogPayload({
        event: 'backups-read-failed',
        error,
      }));
      return [];
    }
  }

  async getBackupCollection(): Promise<ConfigBackupCollectionPayload> {
    const backups = await this.getBackups();
    return {
      backups,
      count: backups.length,
    };
  }

  async getHistory(): Promise<ConfigHistoryResponsePayload> {
    return this.getBackupCollection();
  }

  /**
   * Restore configuration from backup
   */
  async restore(backupId: string): Promise<ConfigRestoreResponsePayload> {
    try {
      const backups = await this.getBackups();
      const backup = backups.find((b) => b.id === backupId);

      if (!backup) {
        throw new Error(`Backup with ID ${backupId} not found`);
      }

      // Read backup file
      const backupData = await fs.readFile(backup.filePath, 'utf-8');
      const config = this.ensureConfigPayload(
        JSON.parse(backupData),
        'Backup file must contain a JSON object',
      );

      // Validate before restoring
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new Error(`Backup is invalid: ${this.formatValidationIssues(validation.errors)}`);
      }

      // Create backup of current config before restoring
      const preRestoreBackupPath = this.createTimestampedConfigPath('pre-restore');
      let savedPreRestoreBackupPath: string | null = null;

      try {
        const currentDocument = await this.readConfigDocument();
        await fs.writeFile(preRestoreBackupPath, currentDocument.raw);
        savedPreRestoreBackupPath = preRestoreBackupPath;
      } catch (error) {
        this.logConfigWarn('[Config] Failed to create pre-restore backup', createConfigLifecycleLogPayload({
          event: 'pre-restore-backup-create-failed',
          backupPath: preRestoreBackupPath,
          error,
        }));
      }

      // Restore configuration
      await this.writeConfigFile(config);
      this.logConfigInfo('[Config] Configuration restored from backup', createConfigLifecycleLogPayload({
        event: 'config-restored',
        backupId,
        backupPath: backup.filePath,
        ...(savedPreRestoreBackupPath ? { details: { preRestoreBackupPath: savedPreRestoreBackupPath } } : {}),
      }));

      return {
        success: true,
        message: `Configuration restored from ${new Date(backup.timestamp).toISOString()}`,
        restoredBackup: backup,
        preRestoreBackupPath: savedPreRestoreBackupPath,
        requiresRestart: true,
      };
    } catch (error) {
      throw new Error(`Failed to restore configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Delete old backups (keep only N most recent)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<ConfigCleanupResponsePayload> {
    try {
      const backups = await this.getBackups();
      const totalBackups = backups.length;

      if (backups.length <= keepCount) {
        return {
          deleted: 0,
          remainingBackups: backups.length,
          totalBackups,
          message: `No backups to delete (${backups.length}/${keepCount} kept)`,
        };
      }

      const toDelete = backups.slice(keepCount);
      let deleted = 0;

      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.filePath);
          deleted++;
        } catch (error) {
          this.logConfigWarn('[Config] Failed to delete backup', createConfigLifecycleLogPayload({
            event: 'backup-delete-failed',
            backupPath: backup.filePath,
            error,
          }));
        }
      }

      this.logConfigInfo('[Config] Deleted old backups', createConfigLifecycleLogPayload({
        event: 'backups-cleaned-up',
        deleted,
        remainingBackups: Math.max(totalBackups - deleted, 0),
        totalBackups,
        keepCount,
      }));
      return {
        deleted,
        remainingBackups: Math.max(totalBackups - deleted, 0),
        totalBackups,
        message: `Deleted ${deleted} old backup(s)`,
      };
    } catch (error) {
      this.logConfigError('[Config] Failed to cleanup backups', createConfigLifecycleLogPayload({
        event: 'backups-cleanup-failed',
        keepCount,
        error,
      }));
      return {
        deleted: 0,
        remainingBackups: 0,
        totalBackups: 0,
        message: 'Failed to cleanup backups',
      };
    }
  }

  /**
   * Get configuration schema for UI hints
   */
  getSchema(): ConfigSchemaPayload {
    return SHARED_CONFIG_SCHEMA_METADATA;
  }
}
