/**
 * STRATEGY LOADER SERVICE
 * Loads, validates, and parses strategy JSON configuration files
 * Integrated with ErrorHandler for resilient loading (Phase 8.9.6)
 *
 * Responsibilities:
 * 1. Load strategy JSON from file system with error recovery
 * 2. Validate against schema
 * 3. Validate analyzer references exist
 * 4. Validate weight distribution
 * 5. Return parsed StrategyConfig
 * 6. Handle file/parse/validation errors with appropriate recovery strategies
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import {
  StrategyConfigV2 as StrategyConfig,
  AvailableAnalyzer,
  StrategyValidationError,
  StrategyAnalyzerConfigV2 as StrategyAnalyzerConfig,
  StrategyMetadataV2 as StrategyMetadata,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy, RetryConfig } from '../errors/ErrorHandler';
import { StrategyLoadError, StrategyParseError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';

const AVAILABLE_ANALYZERS: Set<AvailableAnalyzer> = new Set([
  // Technical Indicators
  'EMA_ANALYZER_NEW',
  'RSI_ANALYZER_NEW',
  'ATR_ANALYZER_NEW',
  'VOLUME_ANALYZER_NEW',
  'STOCHASTIC_ANALYZER_NEW',
  'BOLLINGER_BANDS_ANALYZER_NEW',
  // Advanced Analysis
  'DIVERGENCE_ANALYZER_NEW',
  'BREAKOUT_ANALYZER_NEW',
  'WICK_ANALYZER_NEW',
  'PRICE_MOMENTUM_ANALYZER_NEW',
  // Structure Analysis
  'TREND_DETECTOR_ANALYZER_NEW',
  'SWING_ANALYZER_NEW',
  'LEVEL_ANALYZER_NEW',
  'CHOCH_BOS_ANALYZER_NEW',
  // Liquidity & Smart Money
  'LIQUIDITY_SWEEP_ANALYZER_NEW',
  'LIQUIDITY_ZONE_ANALYZER_NEW',
  'ORDER_BLOCK_ANALYZER_NEW',
  'FAIR_VALUE_GAP_ANALYZER_NEW',
  'VOLUME_PROFILE_ANALYZER_NEW',
  'ORDER_FLOW_ANALYZER_NEW',
  'FOOTPRINT_ANALYZER_NEW',
  'WHALE_ANALYZER_NEW',
  // Micro-Level Analysis
  'MICRO_WALL_ANALYZER_NEW',
  'DELTA_ANALYZER_NEW',
  'TICK_DELTA_ANALYZER_NEW',
  'PRICE_ACTION_ANALYZER_NEW',
  // Additional
  'TREND_CONFLICT_ANALYZER_NEW',
  'WHALE_HUNTER_ANALYZER_NEW',
  'VOLATILITY_SPIKE_ANALYZER_NEW',
]);

function resolveDefaultStrategiesDir(): string {
  return resolve(__dirname, '../../../../strategies/json');
}

export class StrategyLoaderService {
  private strategiesDir: string;
  private readonly errorHandler?: ErrorHandler;

  // Retry configuration for transient file read errors
  private readonly LOAD_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 2,
    initialDelayMs: 100,
    backoffMultiplier: 2,
    maxDelayMs: 500,
  };

  constructor(
    strategiesDir: string = resolveDefaultStrategiesDir(),
    errorHandler?: ErrorHandler,
  ) {
    this.strategiesDir = strategiesDir;
    this.errorHandler = errorHandler;
  }

  /**
   * Load strategy from JSON file
   * (Error handling delegated to caller via loadAllStrategies or direct ErrorHandler use)
   * @param strategyName - Strategy file name (without .json extension)
   * @returns Parsed and validated StrategyConfig
   * @throws StrategyLoadError/StrategyParseError on failure
   */
  async loadStrategy(strategyName: string): Promise<StrategyConfig> {
    const filePath = join(this.strategiesDir, `${strategyName}.strategy.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate the loaded strategy
      this.validateStrategy(parsed);

      return parsed as StrategyConfig;
    } catch (error) {
      // Classify and throw the error (caller handles recovery)
      const classifiedError = this.classifyLoadError(error, strategyName, filePath);
      throw classifiedError;
    }
  }

  /**
   * Classify load error into appropriate domain error
   */
  private classifyLoadError(
    error: unknown,
    strategyName: string,
    filePath: string,
  ): Error {
    // Handle validation errors
    if (error instanceof StrategyValidationError) {
      return error;
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return new StrategyParseError(`Invalid JSON in strategy file: ${error.message}`, {
        strategyName,
        parseError: error.message,
      });
    }

    // Handle file system errors
    const errorMessage = getErrorMessage(error);

    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      return new StrategyLoadError(
        `Strategy file not found: ${strategyName}`,
        {
          strategyName,
          reason: 'file_not_found',
          filePath,
        },
        error instanceof Error ? error : undefined,
      );
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
      return new StrategyLoadError(
        `Permission denied reading strategy file: ${strategyName}`,
        {
          strategyName,
          reason: 'permission_denied',
          filePath,
        },
        error instanceof Error ? error : undefined,
      );
    }

    // Default: unknown error
    return new StrategyLoadError(
      `Failed to load strategy '${strategyName}': ${errorMessage}`,
      {
        strategyName,
        reason: 'unknown',
        filePath,
      },
      error instanceof Error ? error : undefined,
    );
  }

  /**
   * Validate strategy configuration structure and content
   * @throws StrategyValidationError if validation fails
   */
  private validateStrategy(strategy: unknown): void {
    const config = this.asRecord(strategy);
    if (!config) {
      throw new StrategyValidationError('Strategy must be an object');
    }

    // Validate required fields
    if (typeof config.version !== 'number') {
      throw new StrategyValidationError('version must be a number', 'version');
    }

    const metadata = this.asRecord(config.metadata);
    if (!metadata) {
      throw new StrategyValidationError('metadata is required and must be an object', 'metadata');
    }

    if (!Array.isArray(config.analyzers) || config.analyzers.length === 0) {
      throw new StrategyValidationError(
        'analyzers must be a non-empty array',
        'analyzers',
      );
    }

    // Validate metadata
    this.validateMetadata(metadata);

    // Validate analyzers
    this.validateAnalyzers(config.analyzers as StrategyAnalyzerConfig[]);

    // Validate overrides if present
    const indicators = this.asRecord(config.indicators);
    if (indicators) {
      this.validateIndicatorOverrides(indicators);
    }

    const filters = this.asRecord(config.filters);
    if (filters) {
      this.validateFilterOverrides(filters);
    }

    const riskManagement = this.asRecord(config.riskManagement);
    if (riskManagement) {
      this.validateRiskManagementOverrides(riskManagement);
    }
  }

  /**
   * Validate metadata section
   */
  private validateMetadata(metadata: unknown): void {
    const meta = this.asRecord(metadata);
    if (!meta) {
      throw new StrategyValidationError('metadata must be an object', 'metadata');
    }

    const requiredFields = ['name', 'version', 'description', 'createdAt', 'lastModified', 'tags'];
    for (const field of requiredFields) {
      if (!meta[field]) {
        throw new StrategyValidationError(
          `metadata.${field} is required`,
          `metadata.${field}`,
        );
      }
    }

    if (typeof meta.name !== 'string') {
      throw new StrategyValidationError('metadata.name must be a string', 'metadata.name');
    }

    if (typeof meta.version !== 'string') {
      throw new StrategyValidationError('metadata.version must be a string', 'metadata.version');
    }

    if (!Array.isArray(meta.tags)) {
      throw new StrategyValidationError('metadata.tags must be an array', 'metadata.tags');
    }

    // Validate backtest results if present
    if (meta.backtest) {
      if (typeof meta.backtest !== 'object') {
        throw new StrategyValidationError(
          'metadata.backtest must be an object',
          'metadata.backtest',
        );
      }
      const backtest = this.asRecord(meta.backtest);
      if (!backtest) {
        throw new StrategyValidationError(
          'metadata.backtest must be an object',
          'metadata.backtest',
        );
      }
      if (
        typeof backtest.winRate !== 'number' ||
        backtest.winRate < 0 ||
        backtest.winRate > 1
      ) {
        throw new StrategyValidationError(
          'metadata.backtest.winRate must be a number between 0 and 1',
          'metadata.backtest.winRate',
        );
      }
    }
  }

  /**
   * Validate analyzers configuration
   */
  private validateAnalyzers(analyzers: unknown[]): void {
    if (!Array.isArray(analyzers)) {
      throw new StrategyValidationError('analyzers must be an array', 'analyzers');
    }

    const names = new Set<string>();

    for (let i = 0; i < analyzers.length; i++) {
      const analyzer = analyzers[i];

      if (!analyzer || typeof analyzer !== 'object') {
        throw new StrategyValidationError(
          `analyzers[${i}] must be an object`,
          `analyzers[${i}]`,
        );
      }

      const a = this.asRecord(analyzer);
      if (!a) {
        throw new StrategyValidationError(
          `analyzers[${i}] must be an object`,
          `analyzers[${i}]`,
        );
      }

      // Validate required fields
      if (typeof a.name !== 'string') {
        throw new StrategyValidationError(
          `analyzers[${i}].name must be a string`,
          `analyzers[${i}].name`,
        );
      }

      if (typeof a.enabled !== 'boolean') {
        throw new StrategyValidationError(
          `analyzers[${i}].enabled must be a boolean`,
          `analyzers[${i}].enabled`,
        );
      }

      if (typeof a.weight !== 'number' || a.weight < 0 || a.weight > 1) {
        throw new StrategyValidationError(
          `analyzers[${i}].weight must be a number between 0 and 1`,
          `analyzers[${i}].weight`,
          a.weight,
        );
      }

      if (typeof a.priority !== 'number' || a.priority < 1 || a.priority > 10) {
        throw new StrategyValidationError(
          `analyzers[${i}].priority must be a number between 1 and 10`,
          `analyzers[${i}].priority`,
          a.priority,
        );
      }

      // Validate analyzer exists
      if (!AVAILABLE_ANALYZERS.has(a.name as AvailableAnalyzer)) {
        throw new StrategyValidationError(
          `Unknown analyzer: ${a.name}. Available analyzers: ${Array.from(AVAILABLE_ANALYZERS).join(', ')}`,
          `analyzers[${i}].name`,
          a.name,
        );
      }

      // Check for duplicates
      if (names.has(a.name as string)) {
        throw new StrategyValidationError(
          `Duplicate analyzer: ${a.name}`,
          `analyzers[${i}].name`,
          a.name,
        );
      }
      names.add(a.name as string);

      // Validate confidence thresholds if present
      if (a.minConfidence !== undefined) {
        if (typeof a.minConfidence !== 'number' || a.minConfidence < 0 || a.minConfidence > 100) {
          throw new StrategyValidationError(
            `analyzers[${i}].minConfidence must be a number between 0 and 100`,
            `analyzers[${i}].minConfidence`,
            a.minConfidence,
          );
        }
      }

      if (a.maxConfidence !== undefined) {
        if (typeof a.maxConfidence !== 'number' || a.maxConfidence < 0 || a.maxConfidence > 100) {
          throw new StrategyValidationError(
            `analyzers[${i}].maxConfidence must be a number between 0 and 100`,
            `analyzers[${i}].maxConfidence`,
            a.maxConfidence,
          );
        }
      }
    }
  }

  /**
   * Validate indicator overrides
   */
  private validateIndicatorOverrides(overrides: Record<string, unknown>): void {
    const validIndicators = ['ema', 'rsi', 'atr', 'volume', 'stochastic', 'bollingerBands'];

    for (const [key, value] of Object.entries(overrides)) {
      if (!validIndicators.includes(key)) {
        throw new StrategyValidationError(
          `Unknown indicator override: ${key}`,
          `indicators.${key}`,
        );
      }

      if (typeof value !== 'object') {
        throw new StrategyValidationError(
          `indicators.${key} must be an object`,
          `indicators.${key}`,
        );
      }
    }
  }

  /**
   * Validate filter overrides
   */
  private validateFilterOverrides(overrides: Record<string, unknown>): void {
    const validFilters = [
      'blindZone',
      'flatMarket',
      'fundingRate',
      'btcCorrelation',
      'trendAlignment',
      'postTpFilter',
      'timeBasedFilter',
      'volatilityRegime',
      'neutralTrendStrength',
      // Legacy filters
      'nightTrading',
      'atr',
      'emaFilter',
    ];

    for (const [key, value] of Object.entries(overrides)) {
      if (!validFilters.includes(key)) {
        throw new StrategyValidationError(
          `Unknown filter override: ${key}`,
          `filters.${key}`,
        );
      }

      if (typeof value !== 'object') {
        throw new StrategyValidationError(
          `filters.${key} must be an object`,
          `filters.${key}`,
        );
      }
    }
  }

  /**
   * Validate risk management overrides
   */
  private validateRiskManagementOverrides(overrides: Record<string, unknown>): void {
    const validFields = ['stopLoss', 'takeProfits', 'trailing', 'breakeven', 'timeBasedExit'];

    for (const [key, value] of Object.entries(overrides)) {
      if (!validFields.includes(key)) {
        throw new StrategyValidationError(
          `Unknown risk management override: ${key}`,
          `riskManagement.${key}`,
        );
      }

      if (key === 'takeProfits') {
        if (!Array.isArray(value)) {
          throw new StrategyValidationError(
            'riskManagement.takeProfits must be an array',
            'riskManagement.takeProfits',
          );
        }
      } else if (typeof value !== 'object') {
        throw new StrategyValidationError(
          `riskManagement.${key} must be an object`,
          `riskManagement.${key}`,
        );
      }
    }
  }

  /**
   * Get list of available analyzer names
   */
  getAvailableAnalyzers(): string[] {
    return Array.from(AVAILABLE_ANALYZERS).sort();
  }

  /**
   * Load all strategies from directory with error recovery
   * Strategy: SKIP for individual strategy failures, GRACEFUL_DEGRADE for directory read
   */
  async loadAllStrategies(): Promise<Map<string, StrategyConfig>> {
    const strategies = new Map<string, StrategyConfig>();

    try {
      const files = await fs.readdir(this.strategiesDir);
      const strategyFiles = files.filter((f) => f.endsWith('.strategy.json'));

      for (const file of strategyFiles) {
        const name = file.replace('.strategy.json', '');
        try {
          const strategy = await this.loadStrategy(name);
          strategies.set(name, strategy);
        } catch (error) {
          // Individual strategy failures: SKIP and continue loading other strategies
          if (this.errorHandler) {
            const classifiedError = this.classifyLoadError(
              error,
              name,
              join(this.strategiesDir, file),
            );

            await this.errorHandler.handle(classifiedError, {
              strategy: RecoveryStrategy.SKIP,
              context: `StrategyLoaderService.loadAllStrategies[individual_failure]`,
            });
          }
          // Continue loading other strategies despite this failure
        }
      }
    } catch (error) {
      // Directory read failure: GRACEFUL_DEGRADE and return empty map
      if (this.errorHandler) {
        const loadError = new StrategyLoadError(
          `Could not read strategies directory: ${getErrorMessage(error)}`,
          {
            strategyName: 'directory',
            reason: 'unknown',
          },
          error instanceof Error ? error : undefined,
        );

        await this.errorHandler.handle(loadError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: `StrategyLoaderService.loadAllStrategies[directory_read]`,
        });
      }
    }

    return strategies;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}

