import { ConfigNew, StrategyConfigV2 as StrategyConfig } from '../types/legacy';
import { Config } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

type MergeObject = Record<string, unknown>;
type StrategyAnalyzerDefaults = Record<string, Record<string, unknown>>;
type MergeableConfig = (ConfigNew | Config) & {
  filters?: unknown;
  analyzers?: unknown;
  analyzerDefaults?: unknown;
};

export class StrategyConfigMergerService {
  private errorHandler: ErrorHandler | undefined;
  private logger: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>> | undefined;

  constructor(
    logger?: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>>,
    errorHandler?: ErrorHandler,
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
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
  mergeConfigs(mainConfig: ConfigNew | Config, strategy: StrategyConfig): ConfigNew | Config {
    if (!mainConfig || typeof mainConfig !== 'object') {
      throw new Error('mainConfig must be a non-null object');
    }
    if (!strategy || typeof strategy !== 'object') {
      throw new Error('strategy must be a non-null object');
    }

    try {
      const merged = { ...mainConfig } as MergeableConfig;

      if (strategy.indicators && merged.indicators) {
        merged.indicators = this.mergeIndicators(
          merged.indicators,
          strategy.indicators,
        ) as unknown as MergeableConfig['indicators'];
      }

      if (strategy.filters && merged.filters) {
        merged.filters = this.mergeFilters(merged.filters, strategy.filters);
      }

      if (strategy.riskManagement) {
        merged.riskManagement = this.mergeRiskManagement(
          merged.riskManagement,
          strategy.riskManagement,
        ) as unknown as MergeableConfig['riskManagement'];
      }

      if (strategy.analyzers) {
        merged.analyzers = strategy.analyzers;
      }

      const strategyAnalyzerDefaults = this.getAnalyzerDefaults(strategy);
      if (strategyAnalyzerDefaults) {
        const mainDefaults = this.asMergeObject(merged.analyzerDefaults);
        const mergedDefaults = {
          ...mainDefaults,
          ...strategyAnalyzerDefaults,
        };
        merged.analyzerDefaults = mergedDefaults;
        this.safeLog('debug', '[MERGE] StrategyConfigMerger: Added analyzerDefaults from strategy', {
          strategyDefaultsCount: Object.keys(strategyAnalyzerDefaults).length,
          mergedDefaultsCount: Object.keys(mergedDefaults).length,
        });
      } else {
        this.safeLog('debug', '[MERGE] StrategyConfigMerger: No analyzerDefaults in strategy');
      }

      return merged;
    } catch (error) {
      this.safeLog('warn', 'Config merge failed, returning mainConfig copy', { error: (error as Error).message });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return { ...mainConfig };
    }
  }

  private mergeIndicators(original: unknown, overrides: unknown): MergeObject {
    const merged = { ...this.asMergeObject(original) };
    const overrideValues = this.asMergeObject(overrides);

    if (overrideValues.ema) {
      merged.ema = { ...this.asMergeObject(merged.ema), ...this.asMergeObject(overrideValues.ema) };
    }
    if (overrideValues.rsi) {
      merged.rsi = { ...this.asMergeObject(merged.rsi), ...this.asMergeObject(overrideValues.rsi) };
    }
    if (overrideValues.atr) {
      merged.atr = { ...this.asMergeObject(merged.atr), ...this.asMergeObject(overrideValues.atr) };
    }
    if (overrideValues.volume) {
      merged.volume = { ...this.asMergeObject(merged.volume), ...this.asMergeObject(overrideValues.volume) };
    }
    if (overrideValues.stochastic) {
      merged.stochastic = { ...this.asMergeObject(merged.stochastic), ...this.asMergeObject(overrideValues.stochastic) };
    }
    if (overrideValues.bollingerBands) {
      merged.bollingerBands = { ...this.asMergeObject(merged.bollingerBands), ...this.asMergeObject(overrideValues.bollingerBands) };
    }

    return merged;
  }

  private mergeFilters(original: unknown, overrides: unknown): MergeObject {
    const merged = { ...this.asMergeObject(original) };
    const overrideValues = this.asMergeObject(overrides);

    if (overrideValues.blindZone) {
      merged.blindZone = { ...this.asMergeObject(merged.blindZone), ...this.asMergeObject(overrideValues.blindZone) };
    }
    if (overrideValues.btcCorrelation) {
      merged.btcCorrelation = {
        ...this.asMergeObject(merged.btcCorrelation),
        ...this.asMergeObject(overrideValues.btcCorrelation),
      };
    }
    if (overrideValues.nightTrading) {
      merged.nightTrading = { ...this.asMergeObject(merged.nightTrading), ...this.asMergeObject(overrideValues.nightTrading) };
    }
    if (overrideValues.atr) {
      merged.atr = { ...this.asMergeObject(merged.atr), ...this.asMergeObject(overrideValues.atr) };
    }
    if (overrideValues.volatilityRegime) {
      merged.volatilityRegime = {
        ...this.asMergeObject(merged.volatilityRegime),
        ...this.asMergeObject(overrideValues.volatilityRegime),
      };
    }

    return merged;
  }

  private mergeRiskManagement(original: unknown, overrides: unknown): MergeObject {
    const merged = { ...this.asMergeObject(original) };
    const overrideValues = this.asMergeObject(overrides);

    if (overrideValues.stopLoss) {
      merged.stopLoss = { ...this.asMergeObject(merged.stopLoss), ...this.asMergeObject(overrideValues.stopLoss) };
    }
    if (overrideValues.takeProfits) {
      // Replace entire TP array
      merged.takeProfits = overrideValues.takeProfits;
    }
    if (overrideValues.trailing) {
      merged.trailing = { ...this.asMergeObject(merged.trailing), ...this.asMergeObject(overrideValues.trailing) };
    }
    if (overrideValues.breakeven) {
      merged.breakeven = { ...this.asMergeObject(merged.breakeven), ...this.asMergeObject(overrideValues.breakeven) };
    }
    if (overrideValues.timeBasedExit) {
      merged.timeBasedExit = { ...this.asMergeObject(merged.timeBasedExit), ...this.asMergeObject(overrideValues.timeBasedExit) };
    }

    return merged;
  }

  getConfigValue(mainConfig: ConfigNew, strategy: StrategyConfig, path: string): unknown {
    try {
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
      let value: unknown = merged;

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = this.asMergeObject(value)[key];
        } else {
          return undefined;
        }
      }

      return value;
    } catch (error) {
      this.safeLog('warn', 'Config value lookup failed', { path, error: (error as Error).message });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return undefined;
    }
  }

  getChangeReport(mainConfig: ConfigNew | Config, strategy: StrategyConfig): ChangeReport {
    try {
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

      if (strategy.indicators) {
        this.findChanges(mainConfig.indicators, merged.indicators, 'indicators', changes);
      }

      const mainConfigWithFilters = mainConfig as MergeableConfig;
      const mergedWithFilters = merged as MergeableConfig;
      if (strategy.filters && mainConfigWithFilters.filters && mergedWithFilters.filters) {
        this.findChanges(mainConfigWithFilters.filters, mergedWithFilters.filters, 'filters', changes);
      }

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

  private findChanges(original: unknown, merged: unknown, prefix: string, changes: ConfigChange[]): void {
    if (!original || !merged) return;

    // Skip arrays - we can't easily compare them
    if (Array.isArray(merged)) return;

    const originalValues = this.asMergeObject(original);
    const mergedValues = this.asMergeObject(merged);
    for (const key in mergedValues) {
      if (typeof mergedValues[key] === 'object' && mergedValues[key] !== null && !Array.isArray(mergedValues[key])) {
        this.findChanges(originalValues[key], mergedValues[key], `${prefix}.${key}`, changes);
      } else {
        if (originalValues[key] !== mergedValues[key]) {
          changes.push({
            path: `${prefix}.${key}`,
            original: originalValues[key],
            overridden: mergedValues[key],
          });
        }
      }
    }
  }

  private asMergeObject(value: unknown): MergeObject {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as MergeObject;
    }
    return {};
  }

  private getAnalyzerDefaults(strategy: StrategyConfig): StrategyAnalyzerDefaults | undefined {
    const value = strategy.analyzerDefaults;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return undefined;
  }
}

export interface ChangeReport {
  strategyName: string;
  changesCount: number;
  changes: ConfigChange[];
}

export interface ConfigChange {
  path: string;
  original: unknown;
  overridden: unknown;
}

