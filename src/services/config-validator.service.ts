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
 */

import { LoggerService } from '../types';

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

export class ConfigValidatorService {
  constructor(private logger: LoggerService) {}

  /**
   * Static validation for use at startup (before logger is available)
   * Throws on failure with detailed error message
   */
  static validateAtStartup(config: any): void {
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
    if (slPercent !== undefined) {
      if (slPercent <= 0) errors.push(`INVALID: riskManagement.stopLossPercent = ${slPercent} (must be > 0)`);
      if (slPercent > 20) errors.push(`INVALID: riskManagement.stopLossPercent = ${slPercent} (max 20%)`);
    }

    const leverage = ConfigValidatorService.getPathStatic(config, 'trading.leverage');
    if (leverage !== undefined && (leverage < 1 || leverage > 100)) {
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

  private static getPathStatic(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Validate analyzer configuration
   * Ensures all required analyzer enable/disable flags are present
   */
  validateAnalyzerConfig(config: any): void {
    const errors: string[] = [];

    // Check strategicWeights exists
    if (!config?.strategicWeights) {
      errors.push('Missing "strategicWeights" section in config.json');
      this.throwConfigError(errors);
      return;
    }

    const sw = config.strategicWeights;

    // Check each section
    const requiredSections = [
      { path: 'technicalIndicators', analyzers: ['rsi', 'ema', 'atr'] },
      { path: 'marketStructure', analyzers: ['liquidity', 'divergence', 'breakout', 'flatMarket'] },
      { path: 'smcMicrostructure', analyzers: ['footprint', 'orderBlock', 'fairValueGap'] },
      { path: 'externalData', analyzers: ['btcCorrelation', 'fundingRate', 'orderbookImbalance'] },
    ];

    for (const section of requiredSections) {
      const sectionPath = `strategicWeights.${section.path}`;

      if (!sw[section.path]) {
        errors.push(`Missing section: "${sectionPath}"`);
        continue;
      }

      for (const analyzer of section.analyzers) {
        const fullPath = `${sectionPath}.${analyzer}`;
        if (sw[section.path][analyzer] === undefined) {
          errors.push(`Missing analyzer config: "${fullPath}" (add: "enabled": true/false)`);
        } else if (sw[section.path][analyzer].enabled === undefined) {
          errors.push(`Missing enabled flag: "${fullPath}.enabled" (must be true or false, no null/undefined)`);
        }
      }
    }

    if (errors.length > 0) {
      this.throwConfigError(errors);
    }

    this.logger.info('✅ Analyzer configuration validated', {
      sectionsChecked: requiredSections.length,
      analyzersChecked: requiredSections.reduce((sum, s) => sum + s.analyzers.length, 0),
    });
  }

  /**
   * Validate strategy configuration
   */
  validateStrategyConfig(config: any): void {
    const errors: string[] = [];

    if (!config?.strategies) {
      errors.push('Missing "strategies" section in config.json');
      this.throwConfigError(errors);
      return;
    }

    // Check LevelBased has required flags
    if (config.strategies.levelBased) {
      const lb = config.strategies.levelBased;

      // Check blockLongInDowntrend
      if (lb.blockLongInDowntrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockLongInDowntrend (must be true or false)');
      }

      // Check blockShortInUptrend
      if (lb.blockShortInUptrend === undefined) {
        errors.push('Missing: strategies.levelBased.blockShortInUptrend (must be true or false)');
      }

      // Check trend filters
      if (!lb.levelClustering?.trendFilters) {
        errors.push('Missing: strategies.levelBased.levelClustering.trendFilters');
      } else {
        const tf = lb.levelClustering.trendFilters;
        if (tf.downtrend?.rsiThreshold === undefined) {
          errors.push('Missing: strategies.levelBased.levelClustering.trendFilters.downtrend.rsiThreshold');
        }
        if (tf.uptrend?.rsiThreshold === undefined) {
          errors.push('Missing: strategies.levelBased.levelClustering.trendFilters.uptrend.rsiThreshold');
        }
      }
    }

    if (errors.length > 0) {
      this.throwConfigError(errors);
    }

    this.logger.info('✅ Strategy configuration validated', {
      strategies: config.strategies,
    });
  }

  /**
   * Print all enabled analyzers for debugging
   */
  printEnabledAnalyzers(config: any): void {
    const enabled: string[] = [];
    const disabled: string[] = [];

    const sw = config?.strategicWeights;
    if (!sw) return;

    const sections = ['technicalIndicators', 'marketStructure', 'smcMicrostructure', 'externalData'];

    for (const section of sections) {
      if (!sw[section]) continue;

      for (const [analyzer, settings] of Object.entries(sw[section])) {
        const isEnabled = (settings as any)?.enabled === true;
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

  /**
   * Validate all required configuration (Phase 3)
   * Call this at startup for fast-fail validation
   */
  validateAll(config: any): void {
    const errors: string[] = [];

    // 1. Check for deprecated keys
    this.checkDeprecatedKeys(config, errors);

    // 2. Validate required fields
    this.validateRequiredFields(config, errors);

    // 3. Validate confidence format (0-1 range)
    this.validateConfidenceFormat(config, errors);

    // 4. Validate ranges
    this.validateRanges(config, errors);

    if (errors.length > 0) {
      this.throwConfigError(errors);
    }

    this.logger.info('✅ Configuration validated successfully', {
      version: config.version || 'unknown',
      symbol: config.exchange?.symbol,
    });
  }

  /**
   * Check for deprecated config keys that should no longer be used
   */
  private checkDeprecatedKeys(config: any, errors: string[]): void {
    for (const key of DEPRECATED_KEYS) {
      if (this.hasPath(config, key)) {
        errors.push(`DEPRECATED KEY: "${key}" - remove from config.json (see migration guide)`);
      }
    }
  }

  /**
   * Validate required fields exist
   */
  private validateRequiredFields(config: any, errors: string[]): void {
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
  private validateConfidenceFormat(config: any, errors: string[]): void {
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
  private validateRanges(config: any, errors: string[]): void {
    // Stop loss must be positive and reasonable
    const slPercent = this.getPath(config, 'riskManagement.stopLossPercent');
    if (slPercent !== undefined) {
      if (slPercent <= 0) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${slPercent} (must be > 0)`);
      }
      if (slPercent > 20) {
        errors.push(`INVALID RANGE: riskManagement.stopLossPercent = ${slPercent} (must be <= 20%)`);
      }
    }

    // Leverage must be 1-100
    const leverage = this.getPath(config, 'trading.leverage');
    if (leverage !== undefined) {
      if (leverage < 1 || leverage > 100) {
        errors.push(`INVALID RANGE: trading.leverage = ${leverage} (must be 1-100)`);
      }
    }

    // Position size must be positive
    const posSize = this.getPath(config, 'riskManagement.positionSizeUsdt');
    if (posSize !== undefined && posSize <= 0) {
      errors.push(`INVALID RANGE: riskManagement.positionSizeUsdt = ${posSize} (must be > 0)`);
    }
  }

  /**
   * Check if a nested path exists in object
   */
  private hasPath(obj: any, path: string): boolean {
    return this.getPath(obj, path) !== undefined;
  }

  /**
   * Get value at nested path
   */
  private getPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Throw error with formatted message
   */
  private throwConfigError(errors: string[]): void {
    const errorMessage = `
═══════════════════════════════════════════════════════════════
❌ CONFIGURATION ERROR - MISSING REQUIRED SETTINGS
═══════════════════════════════════════════════════════════════

The following configuration values are REQUIRED and cannot be missing:

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

═══════════════════════════════════════════════════════════════

FIX: Update your config.json to include all required sections.

Example for strategicWeights:
{
  "strategicWeights": {
    "technicalIndicators": {
      "rsi": { "enabled": true },
      "ema": { "enabled": true },
      "atr": { "enabled": true }
    },
    "marketStructure": {
      "liquidity": { "enabled": false },
      "divergence": { "enabled": false },
      "breakout": { "enabled": false }
    },
    "smcMicrostructure": {
      "footprint": { "enabled": true },
      "orderBlock": { "enabled": true }
    },
    "externalData": {
      "btcCorrelation": { "enabled": false },
      "fundingRate": { "enabled": false }
    }
  }
}

═══════════════════════════════════════════════════════════════
    `;

    throw new Error(errorMessage);
  }
}
