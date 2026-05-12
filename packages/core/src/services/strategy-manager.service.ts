/**
 * STRATEGY MANAGER SERVICE (Phase 8.9.75)
 * Central service for strategy management with ErrorHandler integration
 *
 * Responsibilities:
 * 1. Load strategy from JSON at startup
 * 2. Merge strategy overrides with main config
 * 3. Provide strategy to services (weights, analyzer selection)
 *
 * Error Handling:
 * - THROW: Input validation (null/empty strategyName, null mainConfig)
 * - GRACEFUL_DEGRADE: Loader/merger failures (propagate errors, allow fallback)
 * - SKIP: Console logging failures (non-blocking)
 *
 * Bot integration point:
 * - Load strategy once at startup
 * - Pass to services
 * - Everything else transparent
 */

import { StrategyLoaderService } from './strategy-loader.service';
import { StrategyConfigMergerService } from './strategy-config-merger.service';
import { StrategyConfigV2 as StrategyConfig, ConfigNew, Config } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

export class StrategyManagerService {
  private strategy: StrategyConfig | null = null;
  private mergedConfig: ConfigNew | null = null;
  private mergedConfigGeneric: ConfigNew | Config | null = null;

  constructor(
    private loader: StrategyLoaderService,
    private merger: StrategyConfigMergerService,
    private errorHandler?: ErrorHandler,
  ) {}

  /**
   * Initialize strategy manager
   * Called once at bot startup
   *
   * @param strategyName - Name of strategy to load (e.g., "level-trading")
   * @param mainConfig - Main config from config.json
   *
   * Error Handling:
   * - THROW: Input validation (null/empty strategyName, null mainConfig)
   * - GRACEFUL_DEGRADE: Loader/merger failures (propagate to caller)
   * - SKIP: Console logging failures (non-blocking)
   */
  async initialize(strategyName: string, mainConfig: null): Promise<void>;
  async initialize(strategyName: string, mainConfig: ConfigNew | Config): Promise<void>;
  async initialize(strategyName: string, mainConfig: unknown): Promise<void> {
    // THROW: Input validation
    if (strategyName === null || strategyName === undefined) {
      throw new Error('StrategyName is required');
    }

    if (typeof strategyName !== 'string' || strategyName.trim() === '') {
      throw new Error('StrategyName cannot be empty');
    }

    if (mainConfig === null || mainConfig === undefined) {
      throw new Error('Main config is required');
    }

    const typedMainConfig = this.asConfig(mainConfig);
    if (!typedMainConfig) {
      throw new Error('Main config must be an object');
    }

    // Safe console.log with SKIP strategy
    this.safeLog(`[StrategyManager] Loading strategy: ${strategyName}`);

    // Load strategy from JSON (GRACEFUL_DEGRADE: propagate errors)
    this.strategy = await this.loader.loadStrategy(strategyName);

    // Validate loaded strategy
    if (!this.strategy) {
      throw new Error('Strategy loaded but is null/undefined');
    }

    // Merge with main config (supports both Config and ConfigNew types)
    this.mergedConfigGeneric = this.merger.mergeConfigs(typedMainConfig, this.strategy);

    // Log what changed
    const changeReport = this.merger.getChangeReport(typedMainConfig, this.strategy);
    this.safeLog(
      `[StrategyManager] Applied ${changeReport.changesCount} config overrides from strategy`,
    );

    if (changeReport.changesCount > 0) {
      changeReport.changes.forEach((change) => {
        this.safeLog(this.formatOverrideChange(change.path, change.original, change.overridden));
      });
    }

    this.safeLog(
      `[StrategyManager] Strategy ready: ${this.strategy.metadata.name} v${this.strategy.metadata.version}`
    );
  }

  /**
   * Get loaded strategy
   * Used by AnalyzerRegistry to know which analyzers to load
   */
  getStrategy(): StrategyConfig {
    if (!this.strategy) {
      throw new Error(
        '[StrategyManager] Strategy not initialized. Call initialize() first.',
      );
    }
    return this.strategy;
  }

  /**
   * Get merged config (strategy overrides applied)
   * Used by services that need the final config
   * Returns either Config or ConfigNew depending on what was passed
   */
  getMergedConfig(): ConfigNew | Config {
    if (!this.mergedConfigGeneric) {
      throw new Error(
        '[StrategyManager] Config not merged. Call initialize() first.',
      );
    }
    return this.mergedConfigGeneric;
  }

  /**
   * Get strategy metadata
   */
  getStrategyName(): string {
    return this.getStrategy().metadata.name;
  }

  /**
   * Get list of enabled analyzers in strategy
   */
  getEnabledAnalyzers(): string[] {
    return this.getStrategy().analyzers
      .filter((a) => a.enabled)
      .map((a) => a.name);
  }

  /**
   * Get weight for a specific analyzer
   * Used by StrategyCoordinator
   */
  getAnalyzerWeight(analyzerName: string): number {
    const analyzer = this.getStrategy().analyzers.find((a) => a.name === analyzerName);
    return analyzer?.weight ?? 0;
  }

  /**
   * Get all analyzer weights
   * Used by StrategyCoordinator
   */
  getAllWeights(): Map<string, number> {
    const weights = new Map<string, number>();
    this.getStrategy().analyzers.forEach((a) => {
      if (a.enabled) {
        weights.set(a.name, a.weight);
      }
    });
    return weights;
  }

  /**
   * Check if strategy is ready
   */
  isReady(): boolean {
    return this.strategy !== null && this.mergedConfigGeneric !== null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Safe console.log with SKIP strategy for logger failures (non-blocking)
   */
  private safeLog(message: string): void {
    try {
      console.log(message);
    } catch (error: unknown) {
      // SKIP strategy: non-blocking console failure (never throw)
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
      // Silent failure - continue regardless
    }
  }

  private asConfig(value: unknown): ConfigNew | Config | null {
    return value && typeof value === 'object' ? value as ConfigNew | Config : null;
  }

  private formatOverrideChange(path: string, original: unknown, overridden: unknown): string {
    return `  - ${path}: ${this.stringifyValue(original)} -> ${this.stringifyValue(overridden)}`;
  }

  private stringifyValue(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

