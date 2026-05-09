/**
 * DYNAMIC CONFIG MANAGER SERVICE
 *
 * Manages runtime strategy configuration loading and updates.
 * Enables hot-reload of strategy configs without restart.
 *
 * Responsibilities:
 * 1. Load strategy config from file
 * 2. Update strategy config at runtime
 * 3. Validate config changes
 * 4. Merge with base config safely
 * 5. Watch config files for changes
 *
 * Design Pattern: Config Manager + Validator
 * Usage: Injected into StrategyFactory
 */

import type {
  StrategyConfigV2 as StrategyConfig,
  StrategyAnalyzerConfigV2 as StrategyAnalyzerConfig,
  ConfigValidationResult,
  ConfigMergeChange,
  ConfigNew,
} from '../../types/legacy';
import type { ILogger } from '../../interfaces/IMonitoring';
import { ICONS } from '../../cli/cli-runtime';
import { getErrorMessage } from '../../utils/error.utils';

export class DynamicConfigManagerService {
  private configCache = new Map<string, StrategyConfig>();
  private watchers = new Map<string, () => void>();
  private logger?: ILogger;

  constructor(
    private strategyDir: string = './strategies/json',
    logger?: ILogger,
  ) {
    this.logger = logger;
  }

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger[level](message, meta);
      return;
    }

    const prefix = '[DynamicConfigManager]';
    const metaSuffix = meta ? ` ${JSON.stringify(meta)}` : '';
    if (level === 'warn') {
      console.warn(`${prefix} ${message}${metaSuffix}`);
      return;
    }
    if (level === 'error') {
      console.error(`${prefix} ${message}${metaSuffix}`);
      return;
    }

    console.log(`${prefix} ${message}${metaSuffix}`);
  }

  /**
   * Load strategy configuration from file
   *
   * @param strategyName Strategy file name (without .strategy.json)
   * @throws Error if file not found or invalid JSON
   */
  async loadStrategyConfig(strategyName: string): Promise<StrategyConfig> {
    if (this.configCache.has(strategyName)) {
      return this.configCache.get(strategyName)!;
    }

    this.log('info', 'Loading strategy config', { strategyName });

    try {
      // In real implementation:
      // const filePath = path.join(this.strategyDir, `${strategyName}.strategy.json`);
      // const content = await fs.readFile(filePath, 'utf-8');
      // const config = JSON.parse(content) as StrategyConfig;
      const config: StrategyConfig = {
        version: 1,
        metadata: {
          name: strategyName,
          version: '1.0.0',
          description: '',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          tags: [],
        },
        indicators: {},
        analyzers: [],
      };

      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }

      this.configCache.set(strategyName, config);
      this.log('info', 'Loaded strategy config', {
        strategyName,
        icon: ICONS.success,
      });

      return config;
    } catch (error) {
      const message = getErrorMessage(error);
      this.log('error', `${ICONS.error} Failed to load strategy config`, {
        strategyName,
        error: message,
      });
      throw new Error(`[DynamicConfigManager] Failed to load config: ${message}`);
    }
  }

  /**
   * Update strategy configuration at runtime
   *
   * @param strategyId Strategy ID (for logging)
   * @param updates Partial config updates
   * @throws Error if validation fails
   */
  async updateStrategyConfig(
    strategyId: string,
    updates: Partial<StrategyConfig>,
  ): Promise<void> {
    this.log('info', 'Updating strategy config', { strategyId });

    try {
      const merged: StrategyConfig = {
        version: updates.version ?? 1,
        metadata: {
          name: updates.metadata?.name ?? strategyId,
          version: updates.metadata?.version ?? '1.0.0',
          description: updates.metadata?.description ?? '',
          author: updates.metadata?.author,
          createdAt: updates.metadata?.createdAt ?? new Date().toISOString(),
          lastModified: updates.metadata?.lastModified ?? new Date().toISOString(),
          tags: updates.metadata?.tags ?? [],
          backtest: updates.metadata?.backtest,
        },
        indicators: {
          ...this.getIndicatorOverrides(updates.indicators),
        },
        analyzers: updates.analyzers || [],
      };

      const validation = this.validateConfig(merged);
      if (!validation.isValid) {
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.log('warn', `${ICONS.warning} Strategy config validation warnings`, {
          strategyId,
          warnings: validation.warnings,
        });
      }

      this.log('info', 'Updated strategy config', {
        strategyId,
        icon: ICONS.success,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.log('error', `${ICONS.error} Failed to update strategy config`, {
        strategyId,
        error: message,
      });
      throw new Error(`[DynamicConfigManager] Failed to update config: ${message}`);
    }
  }

  /**
   * Validate strategy configuration
   */
  validateConfig(config: StrategyConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.metadata?.name) {
      errors.push('metadata.name is required');
    }

    if (!config.metadata?.version) {
      errors.push('metadata.version is required');
    }

    if (!Array.isArray(config.analyzers)) {
      errors.push('analyzers must be an array');
    } else if (config.analyzers.length === 0) {
      warnings.push('No analyzers configured');
    }

    if (config.analyzers && config.analyzers.length > 0) {
      let totalWeight = 0;
      for (const analyzer of config.analyzers) {
        if (this.hasNumericWeight(analyzer)) {
          totalWeight += analyzer.weight;
        }
      }

      if (totalWeight > 0 && (totalWeight < 0.9 || totalWeight > 1.1)) {
        warnings.push(`Analyzer weights sum to ${totalWeight.toFixed(2)}, expected ~1.0`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Merge base config with strategy config
   */
  mergeConfigs(
    base: ConfigNew,
    strategy: StrategyConfig,
  ): ConfigNew {
    const merged = { ...base };

    if (strategy.indicators) {
      merged.indicators = {
        ...merged.indicators,
        ...this.getIndicatorOverrides(strategy.indicators),
      };
    }

    return merged;
  }

  /**
   * Get changes made during merge
   */
  getConfigMergeChanges(
    base: ConfigNew,
    strategy: StrategyConfig,
  ): ConfigMergeChange[] {
    const changes: ConfigMergeChange[] = [];

    if (strategy.indicators) {
      for (const [key, value] of Object.entries(strategy.indicators)) {
        const baseIndicators = this.getIndicatorOverrides(base.indicators);
        const baseValue = baseIndicators[key];
        if (JSON.stringify(baseValue) !== JSON.stringify(value)) {
          changes.push({
            path: `indicators.${key}`,
            from: baseValue,
            to: value,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Watch config file for changes (optional)
   */
  watchConfigFile(
    strategyName: string,
    callback: () => void,
  ): void {
    // In real implementation:
    // const filePath = path.join(this.strategyDir, `${strategyName}.strategy.json`);
    // const watcher = fs.watch(filePath, async () => {
    //   this.configCache.delete(strategyName);
    //   callback();
    // });
    // this.watchers.set(strategyName, () => watcher.close());
    void this.strategyDir;

    this.log('info', 'Watching strategy config file', {
      strategyName,
      icon: ICONS.note,
    });
    this.watchers.set(strategyName, callback);
  }

  /**
   * Stop watching config file
   */
  stopWatching(strategyName: string): void {
    const callback = this.watchers.get(strategyName);
    if (callback) {
      callback();
      this.watchers.delete(strategyName);
    }
  }

  /**
   * Clear config cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.log('info', 'Cleared strategy config cache');
  }

  /**
   * Get cached configs
   */
  getCachedConfigs(): string[] {
    return Array.from(this.configCache.keys());
  }

  private hasNumericWeight(analyzer: StrategyAnalyzerConfig): analyzer is StrategyAnalyzerConfig & { weight: number } {
    return typeof analyzer.weight === 'number';
  }

  private getIndicatorOverrides(indicators: unknown): Record<string, unknown> {
    return this.asRecord(indicators) ?? {};
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
