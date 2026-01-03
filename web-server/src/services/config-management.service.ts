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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ConfigBackup {
  id: string;
  timestamp: number;
  filePath: string;
  size: number;
}

export class ConfigManagementService {
  constructor(private configPath: string) {}

  /**
   * Validate configuration object
   */
  validate(config: any): ValidationResult {
    const errors: string[] = [];

    if (!config || typeof config !== 'object') {
      errors.push('Config must be a valid object');
      return { valid: false, errors };
    }

    // Validate required fields
    if (!config.trading && !config.strategies) {
      errors.push('Config must have trading or strategies section');
    }

    // Validate risk parameters if present
    if (config.risk) {
      if (config.risk.maxLeverage && typeof config.risk.maxLeverage !== 'number') {
        errors.push('maxLeverage must be a number');
      }
      if (config.risk.maxPositionSize && typeof config.risk.maxPositionSize !== 'number') {
        errors.push('maxPositionSize must be a number');
      }
      if (config.risk.dailyLossLimit && typeof config.risk.dailyLossLimit !== 'number') {
        errors.push('dailyLossLimit must be a number');
      }
      if (config.risk.stopLossPercent && typeof config.risk.stopLossPercent !== 'number') {
        errors.push('stopLossPercent must be a number');
      }
    }

    // Validate strategies if present
    if (config.strategies && typeof config.strategies !== 'object') {
      errors.push('Strategies must be an object');
    }

    // Validate riskManagement if present
    if (config.riskManagement) {
      if (config.riskManagement.positionSizeUsdt && typeof config.riskManagement.positionSizeUsdt !== 'number') {
        errors.push('positionSizeUsdt must be a number');
      }
      if (config.riskManagement.stopLossPercent && typeof config.riskManagement.stopLossPercent !== 'number') {
        errors.push('stopLossPercent must be a number');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Read current configuration
   */
  async read(): Promise<any> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error('Configuration file not found');
      }
      throw new Error(`Failed to read configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Write configuration with automatic backup
   */
  async write(config: any): Promise<{ success: boolean; backupPath: string; message: string }> {
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

  /**
   * Get configuration backups
   */
  async getBackups(): Promise<ConfigBackup[]> {
    try {
      const dir = path.dirname(this.configPath);
      const filename = path.basename(this.configPath);
      const backupPattern = `${filename}.backup.`;

      const files = await fs.readdir(dir);
      const backups: ConfigBackup[] = [];

      for (const file of files) {
        if (file.startsWith(backupPattern)) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          const timestampStr = file.replace(backupPattern, '').replace('.json', '');

          backups.push({
            id: timestampStr,
            timestamp: stats.mtimeMs,
            filePath,
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

  /**
   * Restore configuration from backup
   */
  async restore(backupId: string): Promise<{ success: boolean; message: string }> {
    try {
      const backups = await this.getBackups();
      const backup = backups.find((b) => b.id === backupId);

      if (!backup) {
        throw new Error(`Backup with ID ${backupId} not found`);
      }

      // Read backup file
      const backupData = await fs.readFile(backup.filePath, 'utf-8');
      const config = JSON.parse(backupData);

      // Validate before restoring
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new Error(`Backup is invalid: ${validation.errors.join(', ')}`);
      }

      // Create backup of current config before restoring
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackupPath = `${this.configPath}.pre-restore.${timestamp}.json`;

      try {
        const currentData = await fs.readFile(this.configPath, 'utf-8');
        await fs.writeFile(preRestoreBackupPath, currentData);
      } catch (error) {
        console.warn('[Config] Failed to create pre-restore backup');
      }

      // Restore configuration
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log(`[Config] Configuration restored from backup ${backupId}`);

      return {
        success: true,
        message: `Configuration restored from ${new Date(backup.timestamp).toISOString()}`,
      };
    } catch (error) {
      throw new Error(`Failed to restore configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Delete old backups (keep only N most recent)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<{ deleted: number; message: string }> {
    try {
      const backups = await this.getBackups();

      if (backups.length <= keepCount) {
        return {
          deleted: 0,
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
        message: `Deleted ${deleted} old backup(s)`,
      };
    } catch (error) {
      console.error('[Config] Failed to cleanup backups:', error);
      return {
        deleted: 0,
        message: 'Failed to cleanup backups',
      };
    }
  }

  /**
   * Get configuration schema for UI hints
   */
  getSchema() {
    return {
      sections: {
        trading: {
          name: 'Trading Parameters',
          fields: [
            { name: 'symbol', type: 'string', label: 'Trading Pair' },
            { name: 'timeframe', type: 'string', label: 'Candle Timeframe' },
            { name: 'enabled', type: 'boolean', label: 'Enable Trading' },
          ],
        },
        risk: {
          name: 'Risk Management',
          fields: [
            { name: 'maxLeverage', type: 'number', label: 'Max Leverage' },
            { name: 'maxPositionSize', type: 'number', label: 'Max Position Size' },
            { name: 'dailyLossLimit', type: 'number', label: 'Daily Loss Limit' },
            { name: 'stopLossPercent', type: 'number', label: 'Stop Loss %' },
          ],
        },
        strategies: {
          name: 'Strategies',
          fields: [
            { name: 'enabled', type: 'boolean', label: 'Enabled' },
            { name: 'confidence', type: 'number', label: 'Min Confidence' },
            { name: 'maxTrades', type: 'number', label: 'Max Concurrent Trades' },
          ],
        },
      },
    };
  }
}
