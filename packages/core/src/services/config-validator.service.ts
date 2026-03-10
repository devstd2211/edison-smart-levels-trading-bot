/**
 * Config Validator Service
 *
 * Validates that all required configuration sections exist before bot starts.
 * Fails fast with clear error messages instead of silent fallbacks.
 *
 * Principle: EXPLICIT over IMPLICIT - require all config values in strategicWeights
 * No ?? true fallbacks allowed!
 *
 * Phase 3 additions:
 * - Required fields validation
 * - Confidence format validation (0-1 range)
 * - Deprecated keys rejection
 * - Range validation
 *
 * Phase 8.9.31: ErrorHandler Integration
 * - THROW strategy for all validation errors (critical, no recovery)
 * - SKIP strategy for logger failures (non-blocking)
 * - Backward compatible (works with or without ErrorHandler)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  ConfigValidationError,
  ConfigDeprecationError,
  ConfigFormatError,
  ConfigAnalyzerValidationError,
  ConfigStrategyValidationError,
} from '../errors/DomainErrors';

// Deprecated config paths that should trigger errors
const DEPRECATED_KEYS = [
  'strategy.minConfidenceThreshold', // Use thresholds.defaults.confidence.min
  'entryThresholds.minConfidenceOrchestrator', // Use thresholds.defaults.confidence.min
  'enhancedExit.riskRewardGate.minRatio', // Use minRR
  'enhancedExit.structureBasedTP.useNextLevel', // Use useNextLevelAsTP1
  'enhancedExit.structureBasedTP.bufferPercent', // Use offsetPercent
  'entryConfig.stopLossPercent', // Use riskManagement.stopLossPercent
  'contextConfig', // REMOVED - superseded by thresholds
  'features', // REMOVED - never accessed
  'mode', // REMOVED - unused
];

/**
 * Phase 8.9.31: ErrorHandler integration
 * - THROW strategy for validation errors (all configuration errors are critical)
 * - SKIP strategy for logger failures (non-blocking logging)
 * - Backward compatible (works without ErrorHandler)
 */
export class ConfigValidatorService {
  constructor(
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.31
  ) {}

  /**
   * Static validation for use at startup (before logger is available)
   * Throws on failure with detailed error message
   */
  static validateAtStartup(config: unknown): void {
    const errors: string[] = [];

    // 1. Check for deprecated keys
    for (const key of DEPRECATED_KEYS) {
      if (ConfigValidatorService.getPathStatic(config, key) !== undefined) {
        errors.push(`DEPRECATED KEY: "${key}" - remove from config.json`);
      }
    }

    // 2. Validate required fields
    const requiredFields = [
      'exchange.symbol',
      'riskManagement.stopLossPercent',
      'riskManagement.positionSizeUsdt',
      'trading.leverage',
    ];

    for (const field of requiredFields) {
      const value = ConfigValidatorService.getPathStatic(config, field);
      if (value === undefined || value === null || value === '') {
        errors.push(`REQUIRED FIELD MISSING: "${field}"`);
      }
    }

    // 3. Validate confidence format (0-1 range)
    const confidencePaths = [
      'thresholds.defaults.confidence.min',
      'strategies.levelBased.minConfidenceThreshold',
      'entryScanner.minConfidenceThreshold',
      'entryThresholds.minTotalScore',
    ];

    for (const path of confidencePaths) {
      const value = ConfigValidatorService.getPathStatic(config, path);
      if (value !== undefined && typeof value === 'number' && value > 1) {
        errors.push(`INVALID FORMAT: "${path}" = ${value} (must be 0-1, not 0-100)`);
      }
    }

    // 4. Validate ranges
    const slPercent = ConfigValidatorService.getPathStatic(config, 'riskManagement.stopLossPercent');
    if (typeof slPercent === 'number') {
      if (slPercent <= 0) errors.push(`INVALID: riskManagement.stopLossPercent = ${slPercent} (must be > 0)`);
      if (slPercent > 20) errors.push(`INVALID: riskManagement.stopLossPercent = ${slPercent} (max 20%)`);
    }

    const leverage = ConfigValidatorService.getPathStatic(config, 'trading.leverage');
    if (typeof leverage === 'number' && (leverage < 1 || leverage > 100)) {
      errors.push(`INVALID: trading.leverage = ${leverage} (must be 1-100)`);
    }

    if (errors.length > 0) {
      const errorMessage = `
═══════════════════════════════════════════════════════════════
❌ CONFIGURATION ERROR - FAST FAIL AT STARTUP
═══════════════════════════════════════════════════════════════

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

═══════════════════════════════════════════════════════════════
FIX: Update your config.json and restart.
═══════════════════════════════════════════════════════════════
      `;
      throw new Error(errorMessage);
    }

    console.log('✅ Config validation passed');
  }

  private static getPathStatic(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      current = ConfigValidatorService.getChildValueStatic(current, part);
      if (current === undefined) return undefined;
    }
    return current;
  }

  private static getChildValueStatic(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }

  /**
   * Validate analyzer configuration
   * Ensures all required analyzer enable/disable flags are present
   * Phase 8.9.31: Uses ConfigAnalyzerValidationError with ErrorHandler support
   */
  validateAnalyzerConfig(config: unknown): void {
    const errors: string[] = [];
    const configObj = this.asRecord(config);

    // Check strategicWeights exists
    if (!configObj.strategicWeights) {
      errors.push('Missing "strategicWeights" section in config.json');
      this.throwAnalyzerValidationError(errors, 'strategicWeights', []);
      return;
    }

    const sw = this.asRecord(configObj.strategicWeights);

    // Check each section
    const requiredSections = [
      { path: 'technicalIndicators', analyzers: ['rsi', 'ema', 'atr'] },
      { path: 'marketStructure', analyzers: ['liquidity', 'divergence', 'breakout', 'flatMarket'] },
      { path: 'smcMicrostructure', analyzers: ['footprint', 'orderBlock', 'fairValueGap'] },
      { path: 'externalData', analyzers: ['btcCorrelation', 'fundingRate', 'orderbookImbalance'] },
    ];

    const allAnalyzers: string[] = [];

    for (const section of requiredSections) {
      const sectionPath = `strategicWeights.${section.path}`;

      const sectionConfig = this.asRecord(sw[section.path]);
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

    // Log success (non-blocking, errors are skipped)
    try {
      this.logger.info('✅ Analyzer configuration validated', {
        sectionsChecked: requiredSections.length,
        analyzersChecked: requiredSections.reduce((sum, s) => sum + s.analyzers.length, 0),
      });
    } catch (logError) {
      // SKIP strategy for logger failures - continue despite log errors
      // (this is non-critical operation)
    }
  }

  /**
   * Validate strategy configuration
   * Phase 8.9.31: Uses ConfigStrategyValidationError with ErrorHandler support
   */
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

    // Check LevelBased has required flags
    if (strategies.levelBased) {
      const lb = this.asRecord(strategies.levelBased);

      // Check blockLongInDowntrend
      if (lb.blockLongInDowntrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockLongInDowntrend (must be true or false)');
        missingFields.push('blockLongInDowntrend');
      }

      // Check blockShortInUptrend
      if (lb.blockShortInUptrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockShortInUptrend (must be true or false)');
        missingFields.push('blockShortInUptrend');
      }

      // Check trend filters
      const levelClustering = this.asRecord(lb.levelClustering);
      const trendFilters = this.asRecord(levelClustering.trendFilters);
      if (Object.keys(trendFilters).length === 0) {
        errors.push('Missing: strategies.levelBased.levelClustering.trendFilters');
        missingFields.push('levelClustering.trendFilters');
      } else {
        const tf = trendFilters;
        const downtrend = this.asRecord(tf.downtrend);
        const uptrend = this.asRecord(tf.uptrend);
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

    // Log success (non-blocking, errors are skipped)
    try {
      this.logger.info('✅ Strategy configuration validated', {
        strategies,
      });
    } catch (logError) {
      // SKIP strategy for logger failures - continue despite log errors
      // (this is non-critical operation)
    }
  }

  /**
   * Print all enabled analyzers for debugging
   */
  printEnabledAnalyzers(config: unknown): void {
    const enabled: string[] = [];
    const disabled: string[] = [];

    const configObj = this.asRecord(config);
    const sw = this.asRecord(configObj.strategicWeights);
    if (Object.keys(sw).length === 0) return;

    const sections = ['technicalIndicators', 'marketStructure', 'smcMicrostructure', 'externalData'];

    for (const section of sections) {
      if (!sw[section]) continue;

      for (const [analyzer, settings] of Object.entries(this.asRecord(sw[section]))) {
        const isEnabled = this.isEnabledAnalyzerSettings(settings);
        const fullName = `${section}.${analyzer}`;

        if (isEnabled) {
          enabled.push(fullName);
        } else {
          disabled.push(fullName);
        }
      }
    }

    this.logger.info('📊 Analyzer Configuration Summary', {
      enabledAnalyzers: enabled.length,
      disabledAnalyzers: disabled.length,
      enabledList: enabled,
      disabledList: disabled,
    });
  }

  private isEnabledAnalyzerSettings(settings: unknown): boolean {
    if (typeof settings !== 'object' || settings === null) {
      return false;
    }
    const candidate = settings as { enabled?: unknown };
    return candidate.enabled === true;
  }

  /**
   * Validate all required configuration (Phase 3)
   * Call this at startup for fast-fail validation
   * Phase 8.9.31: Uses typed domain errors with ErrorHandler support
   */
  validateAll(config: unknown): void {
    const errors: string[] = [];
    let errorType: 'deprecation' | 'validation' | 'format' = 'validation';

    // 1. Check for deprecated keys
    const deprecationErrors: string[] = [];
    this.checkDeprecatedKeys(config, deprecationErrors);
    if (deprecationErrors.length > 0) {
      errorType = 'deprecation';
      this.throwDeprecationError(deprecationErrors);
    }

    // 2. Validate required fields
    const validationErrors: string[] = [];
    this.validateRequiredFields(config, validationErrors);
    if (validationErrors.length > 0) {
      errorType = 'validation';
      this.throwValidationError(validationErrors);
    }

    // 3. Validate confidence format (0-1 range)
    const formatErrors: string[] = [];
    this.validateConfidenceFormat(config, formatErrors);
    if (formatErrors.length > 0) {
      errorType = 'format';
      this.throwFormatError(formatErrors);
    }

    // 4. Validate ranges
    const rangeErrors: string[] = [];
    this.validateRanges(config, rangeErrors);
    if (rangeErrors.length > 0) {
      errorType = 'format';
      this.throwFormatError(rangeErrors);
    }

    // Log success (non-blocking, errors are skipped)
    try {
      const configObj = this.asRecord(config);
      const exchange = this.asRecord(configObj.exchange);
      this.logger.info('✅ Configuration validated successfully', {
        version: configObj.version || 'unknown',
        symbol: exchange.symbol,
      });
    } catch (logError) {
      // SKIP strategy for logger failures - continue despite log errors
      // (this is non-critical operation)
    }
  }

  /**
   * Check for deprecated config keys that should no longer be used
   */
  private checkDeprecatedKeys(config: unknown, errors: string[]): void {
    for (const key of DEPRECATED_KEYS) {
      if (this.hasPath(config, key)) {
        errors.push(`DEPRECATED KEY: "${key}" - remove from config.json (see migration guide)`);
      }
    }
  }

  /**
   * Validate required fields exist
   */
  private validateRequiredFields(config: unknown, errors: string[]): void {
    const requiredFields = [
      'exchange.symbol',
      'exchange.apiKey',
      'exchange.apiSecret',
      'riskManagement.stopLossPercent',
      'riskManagement.positionSizeUsdt',
      'trading.leverage',
    ];

    for (const field of requiredFields) {
      const value = this.getPath(config, field);
      if (value === undefined || value === null || value === '') {
        errors.push(`REQUIRED FIELD MISSING: "${field}"`);
      }
    }
  }

  /**
   * Validate confidence values are in 0-1 range (not 0-100)
   */
  private validateConfidenceFormat(config: unknown, errors: string[]): void {
    const confidencePaths = [
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

    for (const path of confidencePaths) {
      const value = this.getPath(config, path);
      if (value !== undefined && value !== null) {
        if (typeof value === 'number' && value > 1) {
          errors.push(`INVALID FORMAT: "${path}" = ${value} (must be 0-1, not 0-100)`);
        }
      }
    }
  }

  /**
   * Validate numeric ranges
   */
  private validateRanges(config: unknown, errors: string[]): void {
    // Stop loss must be positive and reasonable
    const slPercent = this.getPath(config, 'riskManagement.stopLossPercent');
    if (typeof slPercent === 'number') {
      if (slPercent <= 0) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${slPercent} (must be > 0)`);
      }
      if (slPercent > 20) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${slPercent} (must be <= 20%)`);
      }
    }

    // Leverage must be 1-100
    const leverage = this.getPath(config, 'trading.leverage');
    if (typeof leverage === 'number') {
      if (leverage < 1 || leverage > 100) {
        errors.push(`INVALID RANGE: trading.leverage = ${leverage} (must be 1-100)`);
      }
    }

    // Position size must be positive
    const posSize = this.getPath(config, 'riskManagement.positionSizeUsdt');
    if (typeof posSize === 'number' && posSize <= 0) {
      errors.push(`INVALID RANGE: riskManagement.positionSizeUsdt = ${posSize} (must be > 0)`);
    }
  }

  /**
   * Check if a nested path exists in object
   */
  private hasPath(obj: unknown, path: string): boolean {
    return this.getPath(obj, path) !== undefined;
  }

  /**
   * Get value at nested path
   */
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
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Throw validation error with ErrorHandler support (Phase 8.9.31)
   * Uses THROW strategy - no recovery possible for config errors
   */
  private throwValidationError(errors: string[]): void {
    const message = `Configuration validation failed: ${errors.length} required field(s) missing`;
    const error = new ConfigValidationError(message, {
      field: 'multiple',
      reason: `Missing required fields: ${errors.join(', ')}`,
      errors,
    });

    // Always throw - ErrorHandler is for logging only, config errors cannot be recovered
    throw error;
  }

  /**
   * Throw deprecation error with ErrorHandler support (Phase 8.9.31)
   * Uses THROW strategy - no recovery possible for config errors
   */
  private throwDeprecationError(errors: string[]): void {
    const message = `Configuration deprecation error: ${errors.length} deprecated key(s) found`;
    const error = new ConfigDeprecationError(message, {
      deprecatedKey: 'multiple',
      suggestion: 'Remove deprecated keys from config.json and use new configuration structure',
      errors,
    });

    // Always throw - ErrorHandler is for logging only, config errors cannot be recovered
    throw error;
  }

  /**
   * Throw format error with ErrorHandler support (Phase 8.9.31)
   * Uses THROW strategy - no recovery possible for config errors
   */
  private throwFormatError(errors: string[]): void {
    const message = `Configuration format error: ${errors.length} format/range violation(s)`;
    const error = new ConfigFormatError(message, {
      field: 'multiple',
      value: 'see errors array',
      expectedFormat: 'see reason',
      reason: `Format or range violations: ${errors.join(', ')}`,
      errors,
    });

    // Always throw - ErrorHandler is for logging only, config errors cannot be recovered
    throw error;
  }

  /**
   * Throw analyzer validation error with ErrorHandler support (Phase 8.9.31)
   * Uses THROW strategy - no recovery possible for config errors
   */
  private throwAnalyzerValidationError(errors: string[], section: string, analyzers: string[]): void {
    const message = `Analyzer configuration validation failed for section: ${section}`;
    const error = new ConfigAnalyzerValidationError(message, {
      section,
      analyzers,
      reason: `Missing analyzer configuration: ${errors.join(', ')}`,
      errors,
    });

    // Always throw - ErrorHandler is for logging only, config errors cannot be recovered
    throw error;
  }

  /**
   * Throw strategy validation error with ErrorHandler support (Phase 8.9.31)
   * Uses THROW strategy - no recovery possible for config errors
   */
  private throwStrategyValidationError(errors: string[], strategyName: string, missingFields: string[]): void {
    const message = `Strategy configuration validation failed for: ${strategyName}`;
    const error = new ConfigStrategyValidationError(message, {
      strategyName,
      missingFields,
      reason: `Missing required fields: ${errors.join(', ')}`,
      errors,
    });

    // Always throw - ErrorHandler is for logging only, config errors cannot be recovered
    throw error;
  }
}
