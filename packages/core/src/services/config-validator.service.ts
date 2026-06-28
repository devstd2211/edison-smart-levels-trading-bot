import { LoggerService } from './logger.service';
import { ErrorHandler } from '../errors';
import {
  ConfigValidationError,
  ConfigDeprecationError,
  ConfigFormatError,
  ConfigAnalyzerValidationError,
  ConfigStrategyValidationError,
} from '../errors/DomainErrors';

type ConfigPathReader = (config: unknown, path: string) => unknown;

type AnalyzerSectionRule = {
  path: string;
  analyzers: string[];
};

type RangeValidatorRule = {
  path: string;
  validate: (value: number) => string[];
};

const STARTUP_ERROR_BANNER = '='.repeat(63);

const DEPRECATED_KEYS = [
  'strategy.minConfidenceThreshold',
  'entryThresholds.minConfidenceOrchestrator',
  'enhancedExit.riskRewardGate.minRatio',
  'enhancedExit.structureBasedTP.useNextLevel',
  'enhancedExit.structureBasedTP.bufferPercent',
  'entryConfig.stopLossPercent',
  'contextConfig',
  'features',
  'mode',
];

const STARTUP_REQUIRED_FIELDS = [
  'exchange.symbol',
  'riskManagement.stopLossPercent',
  'riskManagement.positionSizeUsdt',
  'trading.leverage',
];

const RUNTIME_REQUIRED_FIELDS = [
  'exchange.symbol',
  'exchange.apiKey',
  'exchange.apiSecret',
  'riskManagement.stopLossPercent',
  'riskManagement.positionSizeUsdt',
  'trading.leverage',
];

const STARTUP_CONFIDENCE_PATHS = [
  'thresholds.defaults.confidence.min',
  'strategies.levelBased.minConfidenceThreshold',
  'entryScanner.minConfidenceThreshold',
  'entryThresholds.minTotalScore',
];

const RUNTIME_CONFIDENCE_PATHS = [
  'thresholds.defaults.confidence.min',
  'thresholds.defaults.confidence.clampMin',
  'thresholds.defaults.confidence.clampMax',
  'thresholds.regimes.LOW.confidence.min',
  'thresholds.regimes.MEDIUM.confidence.min',
  'thresholds.regimes.HIGH.confidence.min',
  'strategies.levelBased.minConfidenceThreshold',
  'entryScanner.minConfidenceThreshold',
  'entryScanner.confidenceClampMin',
  'entryScanner.confidenceClampMax',
  'entryThresholds.minTotalScore',
];

const ANALYZER_SECTION_RULES: AnalyzerSectionRule[] = [
  { path: 'technicalIndicators', analyzers: ['rsi', 'ema', 'atr'] },
  { path: 'marketStructure', analyzers: ['liquidity', 'divergence', 'breakout', 'flatMarket'] },
  { path: 'smcMicrostructure', analyzers: ['footprint', 'orderBlock', 'fairValueGap'] },
  { path: 'externalData', analyzers: ['btcCorrelation', 'fundingRate', 'orderbookImbalance'] },
];

const ANALYZER_SECTION_NAMES = ANALYZER_SECTION_RULES.map((section) => section.path);

const STARTUP_RANGE_RULES: RangeValidatorRule[] = [
  {
    path: 'riskManagement.stopLossPercent',
    validate: (value) => {
      const errors: string[] = [];
      if (value <= 0) {
        errors.push(`INVALID: riskManagement.stopLossPercent = ${value} (must be > 0)`);
      }
      if (value > 20) {
        errors.push(`INVALID: riskManagement.stopLossPercent = ${value} (max 20%)`);
      }
      return errors;
    },
  },
  {
    path: 'trading.leverage',
    validate: (value) =>
      value < 1 || value > 100
        ? [`INVALID: trading.leverage = ${value} (must be 1-100)`]
        : [],
  },
];

const RUNTIME_RANGE_RULES: RangeValidatorRule[] = [
  {
    path: 'riskManagement.stopLossPercent',
    validate: (value) => {
      const errors: string[] = [];
      if (value <= 0) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${value} (must be > 0)`);
      }
      if (value > 20) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${value} (must be <= 20%)`);
      }
      return errors;
    },
  },
  {
    path: 'trading.leverage',
    validate: (value) =>
      value < 1 || value > 100
        ? [`INVALID RANGE: trading.leverage = ${value} (must be 1-100)`]
        : [],
  },
  {
    path: 'riskManagement.positionSizeUsdt',
    validate: (value) =>
      value <= 0
        ? [`INVALID RANGE: riskManagement.positionSizeUsdt = ${value} (must be > 0)`]
        : [],
  },
];

export class ConfigValidatorService {
  constructor(
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  static validateAtStartup(config: unknown): void {
    const errors: string[] = [];
    const getPath = ConfigValidatorService.getPathStatic;

    ConfigValidatorService.collectDeprecatedKeyErrors(
      config,
      errors,
      getPath,
      (key) => `DEPRECATED KEY: "${key}" - remove from config.json`,
    );
    ConfigValidatorService.collectRequiredFieldErrors(config, errors, STARTUP_REQUIRED_FIELDS, getPath);
    ConfigValidatorService.collectConfidenceFormatErrors(config, errors, STARTUP_CONFIDENCE_PATHS, getPath);
    ConfigValidatorService.collectRangeErrors(config, errors, STARTUP_RANGE_RULES, getPath);

    if (errors.length > 0) {
      throw new Error(ConfigValidatorService.formatStartupErrorMessage(errors));
    }

    console.log('Config validation passed');
  }

  validateAnalyzerConfig(config: unknown): void {
    const errors: string[] = [];
    const configObj = this.asRecord(config);

    if (!configObj.strategicWeights) {
      errors.push('Missing "strategicWeights" section in config.json');
      this.throwAnalyzerValidationError(errors, 'strategicWeights', []);
      return;
    }

    const strategicWeights = this.asRecord(configObj.strategicWeights);
    const allAnalyzers: string[] = [];

    for (const section of ANALYZER_SECTION_RULES) {
      const sectionPath = `strategicWeights.${section.path}`;
      const sectionConfig = this.asRecord(strategicWeights[section.path]);

      if (Object.keys(sectionConfig).length === 0) {
        errors.push(`Missing section: "${sectionPath}"`);
        continue;
      }

      for (const analyzer of section.analyzers) {
        allAnalyzers.push(analyzer);
        const fullPath = `${sectionPath}.${analyzer}`;
        if (sectionConfig[analyzer] === undefined) {
          errors.push(`Missing analyzer config: "${fullPath}" (add: "enabled": true/false)`);
        } else if (this.asRecord(sectionConfig[analyzer]).enabled === undefined) {
          errors.push(`Missing enabled flag: "${fullPath}.enabled" (must be true or false, no null/undefined)`);
        }
      }
    }

    if (errors.length > 0) {
      this.throwAnalyzerValidationError(errors, 'strategicWeights', allAnalyzers);
    }

    this.logInfoSafely('Analyzer configuration validated', {
      sectionsChecked: ANALYZER_SECTION_RULES.length,
      analyzersChecked: ANALYZER_SECTION_RULES.reduce((sum, section) => sum + section.analyzers.length, 0),
    });
  }

  validateStrategyConfig(config: unknown): void {
    const errors: string[] = [];
    const missingFields: string[] = [];
    const configObj = this.asRecord(config);
    const strategies = this.asRecord(configObj.strategies);

    if (Object.keys(strategies).length === 0) {
      errors.push('Missing "strategies" section in config.json');
      missingFields.push('strategies');
      this.throwStrategyValidationError(errors, 'levelBased', missingFields);
      return;
    }

    if (strategies.levelBased) {
      const levelBased = this.asRecord(strategies.levelBased);

      if (levelBased.blockLongInDowntrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockLongInDowntrend (must be true or false)');
        missingFields.push('blockLongInDowntrend');
      }

      if (levelBased.blockShortInUptrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockShortInUptrend (must be true or false)');
        missingFields.push('blockShortInUptrend');
      }

      const levelClustering = this.asRecord(levelBased.levelClustering);
      const trendFilters = this.asRecord(levelClustering.trendFilters);
      if (Object.keys(trendFilters).length === 0) {
        errors.push('Missing: strategies.levelBased.levelClustering.trendFilters');
        missingFields.push('levelClustering.trendFilters');
      } else {
        const downtrend = this.asRecord(trendFilters.downtrend);
        const uptrend = this.asRecord(trendFilters.uptrend);

        if (downtrend.rsiThreshold === undefined) {
          errors.push('Missing: strategies.levelBased.levelClustering.trendFilters.downtrend.rsiThreshold');
          missingFields.push('trendFilters.downtrend.rsiThreshold');
        }
        if (uptrend.rsiThreshold === undefined) {
          errors.push('Missing: strategies.levelBased.levelClustering.trendFilters.uptrend.rsiThreshold');
          missingFields.push('trendFilters.uptrend.rsiThreshold');
        }
      }
    }

    if (errors.length > 0) {
      this.throwStrategyValidationError(errors, 'levelBased', missingFields);
    }

    this.logInfoSafely('Strategy configuration validated', {
      strategies,
    });
  }

  printEnabledAnalyzers(config: unknown): void {
    const enabled: string[] = [];
    const disabled: string[] = [];

    const configObj = this.asRecord(config);
    const strategicWeights = this.asRecord(configObj.strategicWeights);
    if (Object.keys(strategicWeights).length === 0) {
      return;
    }

    for (const section of ANALYZER_SECTION_NAMES) {
      if (!strategicWeights[section]) {
        continue;
      }

      for (const [analyzer, settings] of Object.entries(this.asRecord(strategicWeights[section]))) {
        const fullName = `${section}.${analyzer}`;
        if (this.isEnabledAnalyzerSettings(settings)) {
          enabled.push(fullName);
        } else {
          disabled.push(fullName);
        }
      }
    }

    this.logger.info('Analyzer Configuration Summary', {
      enabledAnalyzers: enabled.length,
      disabledAnalyzers: disabled.length,
      enabledList: enabled,
      disabledList: disabled,
    });
  }

  validateAll(config: unknown): void {
    const deprecationErrors: string[] = [];
    this.checkDeprecatedKeys(config, deprecationErrors);
    if (deprecationErrors.length > 0) {
      this.throwDeprecationError(deprecationErrors);
    }

    const validationErrors: string[] = [];
    this.validateRequiredFields(config, validationErrors);
    if (validationErrors.length > 0) {
      this.throwValidationError(validationErrors);
    }

    const formatErrors: string[] = [];
    this.validateConfidenceFormat(config, formatErrors);
    if (formatErrors.length > 0) {
      this.throwFormatError(formatErrors);
    }

    const rangeErrors: string[] = [];
    this.validateRanges(config, rangeErrors);
    if (rangeErrors.length > 0) {
      this.throwFormatError(rangeErrors);
    }

    const configObj = this.asRecord(config);
    const exchange = this.asRecord(configObj.exchange);
    this.logInfoSafely('Configuration validated successfully', {
      version: configObj.version || 'unknown',
      symbol: exchange.symbol,
    });
  }

  private isEnabledAnalyzerSettings(settings: unknown): boolean {
    if (typeof settings !== 'object' || settings === null) {
      return false;
    }
    const candidate = settings as { enabled?: unknown };
    return candidate.enabled === true;
  }

  private checkDeprecatedKeys(config: unknown, errors: string[]): void {
    ConfigValidatorService.collectDeprecatedKeyErrors(
      config,
      errors,
      this.getPath.bind(this),
      (key) => `DEPRECATED KEY: "${key}" - remove from config.json (see migration guide)`,
    );
  }

  private validateRequiredFields(config: unknown, errors: string[]): void {
    ConfigValidatorService.collectRequiredFieldErrors(
      config,
      errors,
      RUNTIME_REQUIRED_FIELDS,
      this.getPath.bind(this),
    );
  }

  private validateConfidenceFormat(config: unknown, errors: string[]): void {
    ConfigValidatorService.collectConfidenceFormatErrors(
      config,
      errors,
      RUNTIME_CONFIDENCE_PATHS,
      this.getPath.bind(this),
    );
  }

  private validateRanges(config: unknown, errors: string[]): void {
    ConfigValidatorService.collectRangeErrors(
      config,
      errors,
      RUNTIME_RANGE_RULES,
      this.getPath.bind(this),
    );
  }

  private hasPath(obj: unknown, path: string): boolean {
    return this.getPath(obj, path) !== undefined;
  }

  private getPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      current = this.getChildValue(current, part);
      if (current === undefined) {
        return undefined;
      }
    }

    return current;
  }

  private getChildValue(value: unknown, key: string): unknown {
    return this.asRecordOrNull(value)?.[key];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.asRecordOrNull(value) ?? {};
  }

  private asRecordOrNull(value: unknown): Record<string, unknown> | null {
    return ConfigValidatorService.asRecordStatic(value);
  }

  private logInfoSafely(message: string, context: Record<string, unknown>): void {
    try {
      this.logger.info(message, context);
    } catch {
    }
  }

  private static getPathStatic(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      current = ConfigValidatorService.getChildValueStatic(current, part);
      if (current === undefined) {
        return undefined;
      }
    }
    return current;
  }

  private static getChildValueStatic(value: unknown, key: string): unknown {
    return ConfigValidatorService.asRecordStatic(value)?.[key];
  }

  private static asRecordStatic(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private static collectDeprecatedKeyErrors(
    config: unknown,
    errors: string[],
    getPath: ConfigPathReader,
    format: (key: string) => string,
  ): void {
    for (const key of DEPRECATED_KEYS) {
      if (getPath(config, key) !== undefined) {
        errors.push(format(key));
      }
    }
  }

  private static collectRequiredFieldErrors(
    config: unknown,
    errors: string[],
    requiredFields: string[],
    getPath: ConfigPathReader,
  ): void {
    for (const field of requiredFields) {
      const value = getPath(config, field);
      if (value === undefined || value === null || value === '') {
        errors.push(`REQUIRED FIELD MISSING: "${field}"`);
      }
    }
  }

  private static collectConfidenceFormatErrors(
    config: unknown,
    errors: string[],
    confidencePaths: string[],
    getPath: ConfigPathReader,
  ): void {
    for (const path of confidencePaths) {
      const value = getPath(config, path);
      if (typeof value === 'number' && value > 1) {
        errors.push(`INVALID FORMAT: "${path}" = ${value} (must be 0-1, not 0-100)`);
      }
    }
  }

  private static collectRangeErrors(
    config: unknown,
    errors: string[],
    rules: RangeValidatorRule[],
    getPath: ConfigPathReader,
  ): void {
    for (const rule of rules) {
      const value = getPath(config, rule.path);
      if (typeof value === 'number') {
        errors.push(...rule.validate(value));
      }
    }
  }

  private static formatStartupErrorMessage(errors: string[]): string {
    return [
      STARTUP_ERROR_BANNER,
      'CONFIGURATION ERROR - FAST FAIL AT STARTUP',
      STARTUP_ERROR_BANNER,
      '',
      ...errors.map((error, index) => `${index + 1}. ${error}`),
      '',
      STARTUP_ERROR_BANNER,
      'FIX: Update your config.json and restart.',
      STARTUP_ERROR_BANNER,
    ].join('\n');
  }

  private throwValidationError(errors: string[]): void {
    const message = `Configuration validation failed: ${errors.length} required field(s) missing`;
    const error = new ConfigValidationError(message, {
      field: 'multiple',
      reason: `Missing required fields: ${errors.join(', ')}`,
      errors,
    });

    throw error;
  }

  private throwDeprecationError(errors: string[]): void {
    const message = `Configuration deprecation error: ${errors.length} deprecated key(s) found`;
    const error = new ConfigDeprecationError(message, {
      deprecatedKey: 'multiple',
      suggestion: 'Remove deprecated keys from config.json and use new configuration structure',
      errors,
    });

    throw error;
  }

  private throwFormatError(errors: string[]): void {
    const message = `Configuration format error: ${errors.length} format/range violation(s)`;
    const error = new ConfigFormatError(message, {
      field: 'multiple',
      value: 'see errors array',
      expectedFormat: 'see reason',
      reason: `Format or range violations: ${errors.join(', ')}`,
      errors,
    });

    throw error;
  }

  private throwAnalyzerValidationError(errors: string[], section: string, analyzers: string[]): void {
    const message = `Analyzer configuration validation failed for section: ${section}`;
    const error = new ConfigAnalyzerValidationError(message, {
      section,
      analyzers,
      reason: `Missing analyzer configuration: ${errors.join(', ')}`,
      errors,
    });

    throw error;
  }

  private throwStrategyValidationError(errors: string[], strategyName: string, missingFields: string[]): void {
    const message = `Strategy configuration validation failed for: ${strategyName}`;
    const error = new ConfigStrategyValidationError(message, {
      strategyName,
      missingFields,
      reason: `Missing required fields: ${errors.join(', ')}`,
      errors,
    });

    throw error;
  }
}
