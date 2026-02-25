/**
 * STRATEGY CONFIG MERGER SERVICE
 * Merges main config with strategy overrides
 *
 * Priority: Strategy Overrides > config.json > Defaults
 *
 * Example:
 * - config.json has: emaFilter.rsiThreshold = 50
 * - strategy.json has: filters.emaFilter.rsiThreshold = 55
 * - Result: emaFilter.rsiThreshold = 55 (strategy wins)
 *
 * Phase 8.9.77: ErrorHandler Integration
 * - THROW: Null/undefined config or strategy validation
 * - GRACEFUL_DEGRADE: Merge operation failures → return safe defaults
 * - SKIP: Logging failures via safeLog() wrapper
 */

import { ConfigNew } from '../types/config/config-new.types';
import { StrategyConfig } from '../types/strategy-config';
import { Config } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

export class StrategyConfigMergerService {
  private errorHandler: ErrorHandler | undefined;
  private logger: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: unknown) => void>> | undefined;

  constructor(
    logger?: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: unknown) => void>>,
    errorHandler?: ErrorHandler,
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  /**
   * Safely log messages, catching any logger errors
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: unknown): void {
    if (!this.logger) return;
    try {
      if (this.logger[level]) {
        this.logger[level](message, context);
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
  /**
   * Merge strategy overrides into main config
   * Strategy values override config values
   *
   * Supports both ConfigNew and Config types
   *
   * @param mainConfig - Main configuration from config.json
   * @param strategy - Strategy with optional overrides
   * @returns Merged configuration (same type as input)
   * @throws Error if mainConfig or strategy is null/undefined (THROW)
   */
  mergeConfigs(mainConfig: ConfigNew | Config, strategy: StrategyConfig): ConfigNew | Config {
    // THROW: Validate inputs (this validation must be OUTSIDE try-catch to propagate)
    if (!mainConfig || typeof mainConfig !== 'object') {
      throw new Error('mainConfig must be a non-null object');
    }
    if (!strategy || typeof strategy !== 'object') {
      throw new Error('strategy must be a non-null object');
    }

    try {
      const merged = { ...mainConfig };

      // 1. Merge indicator overrides
      if (strategy.indicators && merged.indicators) {
        merged.indicators = this.mergeIndicators(merged.indicators, strategy.indicators);
      }

      // 2. Merge filter overrides (only if filters exist in config)
      if (strategy.filters && (merged as any).filters) {
        (merged as any).filters = this.mergeFilters((merged as any).filters, strategy.filters);
      }

      // 3. Merge risk management overrides
      if (strategy.riskManagement) {
        merged.riskManagement = this.mergeRiskManagement(
          merged.riskManagement,
          strategy.riskManagement,
        );
      }

      // 4. Add analyzers from strategy
      if (strategy.analyzers) {
        (merged as any).analyzers = strategy.analyzers;
      }

      // 5. Merge analyzer defaults from strategy (strategy defaults override main config defaults)
      if ((strategy as any).analyzerDefaults) {
        const mainDefaults = (merged as any).analyzerDefaults || {};
        const mergedDefaults = {
          ...mainDefaults,
          ...(strategy as any).analyzerDefaults,
        };
        (merged as any).analyzerDefaults = mergedDefaults;
        this.safeLog('debug', '[MERGE] StrategyConfigMerger: Added analyzerDefaults from strategy', {
          strategyDefaultsCount: Object.keys((strategy as any).analyzerDefaults).length,
          mergedDefaultsCount: Object.keys(mergedDefaults).length,
        });
      } else {
        this.safeLog('debug', '[MERGE] StrategyConfigMerger: No analyzerDefaults in strategy');
      }

      return merged;
    } catch (error) {
      // GRACEFUL_DEGRADE: On merge failure, return a safe copy of mainConfig
      this.safeLog('warn', 'Config merge failed, returning mainConfig copy', { error: (error as Error).message });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return { ...mainConfig };
    }
  }

  /**
   * Merge indicator overrides
   */
  private mergeIndicators(original: any, overrides: any): any {
    const merged = { ...original };

    if (overrides.ema) {
      merged.ema = { ...merged.ema, ...overrides.ema };
    }
    if (overrides.rsi) {
      merged.rsi = { ...merged.rsi, ...overrides.rsi };
    }
    if (overrides.atr) {
      merged.atr = { ...merged.atr, ...overrides.atr };
    }
    if (overrides.volume) {
      merged.volume = { ...merged.volume, ...overrides.volume };
    }
    if (overrides.stochastic) {
      merged.stochastic = { ...merged.stochastic, ...overrides.stochastic };
    }
    if (overrides.bollingerBands) {
      merged.bollingerBands = { ...merged.bollingerBands, ...overrides.bollingerBands };
    }

    return merged;
  }

  /**
   * Merge filter overrides
   *
   * Example:
   * - config: { blindZone: { minSignalsForLong: 5, minSignalsForShort: 4 } }
   * - override: { blindZone: { minSignalsForLong: 2 } }
   * - result: { blindZone: { minSignalsForLong: 2, minSignalsForShort: 4 } }
   */
  private mergeFilters(original: any, overrides: any): any {
    const merged = { ...original };

    if (overrides.blindZone) {
      merged.blindZone = { ...merged.blindZone, ...overrides.blindZone };
    }
    if (overrides.btcCorrelation) {
      merged.btcCorrelation = {
        ...merged.btcCorrelation,
        ...overrides.btcCorrelation,
      };
    }
    if (overrides.nightTrading) {
      merged.nightTrading = { ...merged.nightTrading, ...overrides.nightTrading };
    }
    if (overrides.atr) {
      merged.atr = { ...merged.atr, ...overrides.atr };
    }
    if (overrides.volatilityRegime) {
      merged.volatilityRegime = {
        ...merged.volatilityRegime,
        ...overrides.volatilityRegime,
      };
    }

    return merged;
  }

  /**
   * Merge risk management overrides
   */
  private mergeRiskManagement(original: any, overrides: any): any {
    const merged = { ...original };

    if (overrides.stopLoss) {
      merged.stopLoss = { ...merged.stopLoss, ...overrides.stopLoss };
    }
    if (overrides.takeProfits) {
      // Replace entire TP array
      merged.takeProfits = overrides.takeProfits;
    }
    if (overrides.trailing) {
      merged.trailing = { ...merged.trailing, ...overrides.trailing };
    }
    if (overrides.breakeven) {
      merged.breakeven = { ...merged.breakeven, ...overrides.breakeven };
    }
    if (overrides.timeBasedExit) {
      merged.timeBasedExit = { ...merged.timeBasedExit, ...overrides.timeBasedExit };
    }

    return merged;
  }

  /**
   * Get a specific config value with strategy override support
   *
   * @param mainConfig - Main configuration
   * @param strategy - Strategy with overrides
   * @param path - Path like "filters.blindZone.minSignalsForLong"
   * @returns Value from strategy override or main config, or undefined on failure (GRACEFUL_DEGRADE)
   * @throws Error if mainConfig or strategy is null/undefined (THROW)
   */
  getConfigValue(mainConfig: ConfigNew, strategy: StrategyConfig, path: string): any {
    try {
      // THROW: Validate inputs
      if (!mainConfig || typeof mainConfig !== 'object') {
        throw new Error('mainConfig must be a non-null object');
      }
      if (!strategy || typeof strategy !== 'object') {
        throw new Error('strategy must be a non-null object');
      }
      if (!path || typeof path !== 'string') {
        throw new Error('path must be a non-empty string');
      }

      const merged = this.mergeConfigs(mainConfig, strategy);
      const keys = path.split('.');
      let value: any = merged;

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          return undefined;
        }
      }

      return value;
    } catch (error) {
      // GRACEFUL_DEGRADE: On path lookup failure, return undefined
      this.safeLog('warn', 'Config value lookup failed', { path, error: (error as Error).message });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return undefined;
    }
  }

  /**
   * Compare original and merged values (useful for debugging)
   *
   * @param mainConfig - Main configuration
   * @param strategy - Strategy with overrides
   * @returns Change report, or empty report on failure (GRACEFUL_DEGRADE)
   * @throws Error if mainConfig or strategy is null/undefined (THROW)
   */
  getChangeReport(mainConfig: ConfigNew | Config, strategy: StrategyConfig): ChangeReport {
    try {
      // THROW: Validate inputs
      if (!mainConfig || typeof mainConfig !== 'object') {
        throw new Error('mainConfig must be a non-null object');
      }
      if (!strategy || typeof strategy !== 'object') {
        throw new Error('strategy must be a non-null object');
      }
      if (!strategy.metadata || !strategy.metadata.name) {
        throw new Error('strategy.metadata.name must be defined');
      }

      const merged = this.mergeConfigs(mainConfig, strategy);
      const changes: ConfigChange[] = [];

      // Check indicators
      if (strategy.indicators) {
        this.findChanges(mainConfig.indicators, merged.indicators, 'indicators', changes);
      }

      // Check filters (only if they exist in config)
      if (strategy.filters && (mainConfig as any).filters && (merged as any).filters) {
        this.findChanges((mainConfig as any).filters, (merged as any).filters, 'filters', changes);
      }

      // Check risk management
      if (strategy.riskManagement) {
        this.findChanges(
          mainConfig.riskManagement,
          merged.riskManagement,
          'riskManagement',
          changes,
        );
      }

      return {
        strategyName: strategy.metadata.name,
        changesCount: changes.length,
        changes,
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: On change report failure, return empty report
      this.safeLog('warn', 'Change report generation failed', { error: (error as Error).message });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return {
        strategyName: strategy?.metadata?.name || 'unknown',
        changesCount: 0,
        changes: [],
      };
    }
  }

  private findChanges(original: any, merged: any, prefix: string, changes: ConfigChange[]) {
    // Skip if original or merged is undefined/null
    if (!original || !merged) return;

    // Skip arrays - we can't easily compare them
    if (Array.isArray(merged)) return;

    for (const key in merged) {
      if (typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])) {
        // Recursively check nested objects
        this.findChanges(original?.[key], merged[key], `${prefix}.${key}`, changes);
      } else {
        // Compare primitive values
        if (original?.[key] !== merged[key]) {
          changes.push({
            path: `${prefix}.${key}`,
            original: original?.[key],
            overridden: merged[key],
          });
        }
      }
    }
  }
}

export interface ChangeReport {
  strategyName: string;
  changesCount: number;
  changes: ConfigChange[];
}

export interface ConfigChange {
  path: string;
  original: any;
  overridden: any;
}

