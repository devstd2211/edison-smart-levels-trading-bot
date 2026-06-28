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
  'EMA_ANALYZER_NEW',
  'RSI_ANALYZER_NEW',
  'ATR_ANALYZER_NEW',
  'VOLUME_ANALYZER_NEW',
  'STOCHASTIC_ANALYZER_NEW',
  'BOLLINGER_BANDS_ANALYZER_NEW',
  'DIVERGENCE_ANALYZER_NEW',
  'BREAKOUT_ANALYZER_NEW',
  'WICK_ANALYZER_NEW',
  'PRICE_MOMENTUM_ANALYZER_NEW',
  'TREND_DETECTOR_ANALYZER_NEW',
  'SWING_ANALYZER_NEW',
  'LEVEL_ANALYZER_NEW',
  'CHOCH_BOS_ANALYZER_NEW',
  'LIQUIDITY_SWEEP_ANALYZER_NEW',
  'LIQUIDITY_ZONE_ANALYZER_NEW',
  'ORDER_BLOCK_ANALYZER_NEW',
  'FAIR_VALUE_GAP_ANALYZER_NEW',
  'VOLUME_PROFILE_ANALYZER_NEW',
  'ORDER_FLOW_ANALYZER_NEW',
  'FOOTPRINT_ANALYZER_NEW',
  'WHALE_ANALYZER_NEW',
  'MICRO_WALL_ANALYZER_NEW',
  'DELTA_ANALYZER_NEW',
  'TICK_DELTA_ANALYZER_NEW',
  'PRICE_ACTION_ANALYZER_NEW',
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

  async loadStrategy(strategyName: string): Promise<StrategyConfig> {
    const filePath = join(this.strategiesDir, `${strategyName}.strategy.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      this.validateStrategy(parsed);

      return parsed as StrategyConfig;
    } catch (error) {
      const classifiedError = this.classifyLoadError(error, strategyName, filePath);
      throw classifiedError;
    }
  }

  private classifyLoadError(
    error: unknown,
    strategyName: string,
    filePath: string,
  ): Error {
    if (error instanceof StrategyValidationError) {
      return error;
    }

    if (error instanceof SyntaxError) {
      return new StrategyParseError(`Invalid JSON in strategy file: ${error.message}`, {
        strategyName,
        parseError: error.message,
      });
    }

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

  private validateStrategy(strategy: unknown): void {
    const config = this.asRecord(strategy);
    if (!config) {
      throw new StrategyValidationError('Strategy must be an object');
    }

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

    this.validateMetadata(metadata);

    this.validateAnalyzers(config.analyzers as StrategyAnalyzerConfig[]);

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

      if (!AVAILABLE_ANALYZERS.has(a.name as AvailableAnalyzer)) {
        throw new StrategyValidationError(
          `Unknown analyzer: ${a.name}. Available analyzers: ${Array.from(AVAILABLE_ANALYZERS).join(', ')}`,
          `analyzers[${i}].name`,
          a.name,
        );
      }

      if (names.has(a.name as string)) {
        throw new StrategyValidationError(
          `Duplicate analyzer: ${a.name}`,
          `analyzers[${i}].name`,
          a.name,
        );
      }
      names.add(a.name as string);

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

  private validateRiskManagementOverrides(overrides: Record<string, unknown>): void {
    const validFields = ['stopLoss', 'takeProfits', 'trailing', 'trailingStop', 'breakeven', 'timeBasedExit', 'positionSizing'];

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

  getAvailableAnalyzers(): string[] {
    return Array.from(AVAILABLE_ANALYZERS).sort();
  }

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
        }
      }
    } catch (error) {
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

