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
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaPayload,
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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ConfigWriteResult {
  success: boolean;
  backupPath: string;
  message: string;
}

export class ConfigManagementService {
  constructor(private configPath: string) {}

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

  /**
   * Validate configuration object
   */
  validate(config: unknown): ValidationResult {
    const errors: string[] = [];

    if (!this.isRecord(config)) {
      errors.push('Config must be a valid object');
      return { valid: false, errors };
    }

    // Validate required fields
    if (!('trading' in config) && !('strategies' in config)) {
      errors.push('Config must have trading or strategies section');
    }

    // Validate risk parameters if present
    if (this.isRecord(config.risk)) {
      if (config.risk.maxLeverage !== undefined && typeof config.risk.maxLeverage !== 'number') {
        errors.push('maxLeverage must be a number');
      }
      if (config.risk.maxPositionSize !== undefined && typeof config.risk.maxPositionSize !== 'number') {
        errors.push('maxPositionSize must be a number');
      }
      if (config.risk.dailyLossLimit !== undefined && typeof config.risk.dailyLossLimit !== 'number') {
        errors.push('dailyLossLimit must be a number');
      }
      if (config.risk.stopLossPercent !== undefined && typeof config.risk.stopLossPercent !== 'number') {
        errors.push('stopLossPercent must be a number');
      }
    }

    // Validate strategies if present
    if (config.strategies !== undefined && !this.isRecord(config.strategies)) {
      errors.push('Strategies must be an object');
    }

    // Validate riskManagement if present
    if (this.isRecord(config.riskManagement)) {
      if (
        config.riskManagement.positionSizeUsdt !== undefined
        && typeof config.riskManagement.positionSizeUsdt !== 'number'
      ) {
        errors.push('positionSizeUsdt must be a number');
      }
      if (
        config.riskManagement.stopLossPercent !== undefined
        && typeof config.riskManagement.stopLossPercent !== 'number'
      ) {
        errors.push('stopLossPercent must be a number');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Read current configuration
   */
  async read(): Promise<BotConfigPayload> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as BotConfigPayload;
    } catch (error) {
      if (this.getErrorCode(error) === 'ENOENT') {
        throw new Error('Configuration file not found');
      }
      throw new Error(`Failed to read configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Write configuration with automatic backup
   */
  async write(
    config: BotConfigPayload
  ): Promise<ConfigWriteResult> {
    // Validate before writing
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      // Create backup of current config
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.configPath}.backup.${timestamp}.json`;

      try {
        const currentData = await fs.readFile(this.configPath, 'utf-8');
        await fs.writeFile(backupPath, currentData);
        console.log(`[Config] Backup created: ${backupPath}`);
      } catch (backupError) {
        console.warn('[Config] Failed to create backup, continuing with write...');
      }

      // Write new configuration
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log(`[Config] Configuration updated successfully`);

      return {
        success: true,
        backupPath,
        message: 'Configuration updated successfully',
      };
    } catch (error) {
      throw new Error(`Failed to write configuration: ${(error as Error).message}`);
    }
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
      console.error('[Config] Failed to get backups:', error);
      return [];
    }
  }

  async getHistory(): Promise<ConfigHistoryResponsePayload> {
    const backups = await this.getBackups();
    return {
      backups,
      count: backups.length,
    };
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
      const config = JSON.parse(backupData) as unknown;

      // Validate before restoring
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new Error(`Backup is invalid: ${validation.errors.join(', ')}`);
      }

      // Create backup of current config before restoring
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackupPath = `${this.configPath}.pre-restore.${timestamp}.json`;
      let savedPreRestoreBackupPath: string | null = null;

      try {
        const currentData = await fs.readFile(this.configPath, 'utf-8');
        await fs.writeFile(preRestoreBackupPath, currentData);
        savedPreRestoreBackupPath = preRestoreBackupPath;
      } catch (error) {
        console.warn('[Config] Failed to create pre-restore backup');
      }

      // Restore configuration
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log(`[Config] Configuration restored from backup ${backupId}`);

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
          console.warn(`[Config] Failed to delete backup: ${backup.filePath}`);
        }
      }

      console.log(`[Config] Deleted ${deleted} old backups`);
      return {
        deleted,
        remainingBackups: Math.max(totalBackups - deleted, 0),
        totalBackups,
        message: `Deleted ${deleted} old backup(s)`,
      };
    } catch (error) {
      console.error('[Config] Failed to cleanup backups:', error);
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
