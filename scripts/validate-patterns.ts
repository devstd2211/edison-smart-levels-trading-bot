#!/usr/bin/env ts-node
/**
 * Pattern Validation Orchestrator
 *
 * Orchestrates the complete pattern validation pipeline:
 * 1. Load backtest results
 * 2. Extract patterns with walk-forward split (70/30 TRAIN/TEST)
 * 3. Validate all pattern types across all timeframes
 * 4. Generate comprehensive validation report
 * 5. Generate degradation alerts (WARNING/CRITICAL patterns)
 * 6. Save validation results as JSON
 * 7. Update pattern metadata in config
 *
 * Usage:
 *   npm run validate-patterns                          # Validate with default period (90 days)
 *   npm run validate-patterns --period=180             # Validate last 180 days
 *   npm run validate-patterns --auto                   # Auto-update config with new weights
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, LoggerService, PatternOccurrence, PatternValidationResult } from '../packages/core/src/types';
import { PatternDataCollectorService } from '../packages/core/src/services/pattern-data-collector.service';
import { PatternValidationService } from '../packages/core/src/services/pattern-validation.service';
import { PatternReportGeneratorService } from '../packages/core/src/services/pattern-report-generator.service';
import { DEFAULT_PATTERN_VALIDATION_CONFIG, ANALYSIS_TIMEFRAMES, PATTERN_TYPES } from '../packages/core/src/constants/pattern-validation.constants';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

// ============================================================================
// CONSTANTS
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKTEST_DIR = path.join(DATA_DIR, 'backtest');
const CONFIG_PATH = path.join(process.cwd(), 'configs', 'config-block.json');

// ============================================================================
// TYPES
// ============================================================================

interface ValidationRunResult {
  timestamp: number;
  dateTime: string;
  period: number;
  totalOccurrences: number;
  trainOccurrences: number;
  testOccurrences: number;
  patterns: PatternValidationResult[];
  criticalPatterns: PatternValidationResult[];
  warningPatterns: PatternValidationResult[];
  validPatterns: PatternValidationResult[];
  reportFile: string;
  alertsFile: string;
  jsonFile: string;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function main(): Promise<void> {
  const logger = new LoggerService(LogLevel.INFO, './logs', true);

  try {
    // Parse command line arguments
    const period = parseArgument('--period', 90);
    const autoUpdate = hasArgument('--auto');

    logger.info(`${ICONS.target} Pattern Validation Orchestrator Started`, {
      period,
      autoUpdate,
      timestamp: new Date().toISOString(),
    });

    // 1. Load backtest results
    logger.info(`${ICONS.chart} Loading backtest results...`);
    const backtestResults = loadBacktestResults(BACKTEST_DIR);
    if (!backtestResults || backtestResults.trades.length === 0) {
      logger.error(`${ICONS.error} No backtest results found`);
      process.exit(1);
    }
    logger.info(`${ICONS.success} Backtest results loaded`, {
      totalTrades: backtestResults.trades.length,
    });

    // 2. Extract patterns with walk-forward split
    logger.info(`${ICONS.search} Extracting patterns with walk-forward split...`);
    const dataCollector = new PatternDataCollectorService(logger);
    let allOccurrences = await dataCollector.extractFromBacktest(backtestResults, 'APEXUSDT');

    // Filter by period if needed
    if (period > 0) {
      const cutoffTime = Date.now() - (period * 24 * 60 * 60 * 1000);
      allOccurrences = allOccurrences.filter(o => o.timestamp >= cutoffTime);
      logger.info(`${ICONS.calendar} Filtered to last ${period} days`, {
        occurrences: allOccurrences.length,
      });
    }

    // Split dataset
    const splitOccurrences = dataCollector.splitDataset(allOccurrences);
    const trainCount = splitOccurrences.filter(o => o.datasetSplit === 'TRAIN').length;
    const testCount = splitOccurrences.filter(o => o.datasetSplit === 'TEST').length;

    logger.info(`${ICONS.success} Walk-forward split completed`, {
      total: splitOccurrences.length,
      train: trainCount,
      test: testCount,
    });

    // 3. Validate all pattern types across all timeframes
    logger.info(`${ICONS.test} Validating patterns...`);
    const validator = new PatternValidationService(DEFAULT_PATTERN_VALIDATION_CONFIG, logger);
    const validationResults: PatternValidationResult[] = [];

    for (const patternType of PATTERN_TYPES) {
      for (const timeframe of ANALYSIS_TIMEFRAMES) {
        const patternOccurrences = splitOccurrences.filter(
          o => o.patternType === patternType && o.timeframe === timeframe
        );

        if (patternOccurrences.length >= DEFAULT_PATTERN_VALIDATION_CONFIG.minSampleSize) {
          const result = validator.validatePattern(patternType, timeframe, patternOccurrences);
          validationResults.push(result);

          const status = result.isValid ? `${ICONS.success}` : `${ICONS.warning}`;
          logger.debug(`${status} ${patternType} @ ${timeframe}`, {
            trainWR: result.trainResults?.winRate.toFixed(1),
            testWR: result.testResults?.winRate.toFixed(1),
            degradation: result.degradationLevel,
          });
        }
      }
    }

    logger.info(`${ICONS.success} Validated ${validationResults.length} pattern × timeframe combinations`);

    // Categorize results
    const criticalPatterns = validationResults.filter(r => r.degradationLevel === 'CRITICAL');
    const warningPatterns = validationResults.filter(r => r.degradationLevel === 'WARNING');
    const validPatterns = validationResults.filter(r => r.isValid);

    logger.info(`${ICONS.chart} Validation Summary`, {
      total: validationResults.length,
      valid: validPatterns.length,
      warning: warningPatterns.length,
      critical: criticalPatterns.length,
    });

    // 4. Generate reports
    logger.info(`${ICONS.note} Generating reports...`);
    const reportGenerator = new PatternReportGeneratorService(logger);
    const timestamp = Date.now();

    const reportFile = reportGenerator.generateValidationReport(validationResults, timestamp);
    const alertsFile = reportGenerator.generateDegradationAlerts(validationResults, timestamp);
    const jsonFile = reportGenerator.saveValidationResults(validationResults, timestamp);

    logger.info(`${ICONS.success} Reports generated`, {
      report: path.basename(reportFile),
      alerts: path.basename(alertsFile),
      json: path.basename(jsonFile),
    });

    // 5. Update config if auto-update enabled
    if (autoUpdate) {
      logger.info(`${ICONS.gear} Updating pattern weights in config...`);
      const updateCount = updateConfigWeights(CONFIG_PATH, validationResults, logger);
      logger.info(`${ICONS.success} Updated ${updateCount} pattern weights in config`);
    }

    // 6. Print summary
    printValidationSummary(validationResults, criticalPatterns, warningPatterns);

    const runResult: ValidationRunResult = {
      timestamp,
      dateTime: new Date(timestamp).toISOString(),
      period,
      totalOccurrences: splitOccurrences.length,
      trainOccurrences: trainCount,
      testOccurrences: testCount,
      patterns: validationResults,
      criticalPatterns,
      warningPatterns,
      validPatterns,
      reportFile,
      alertsFile,
      jsonFile,
    };

    // Save run result metadata
    const metadataFile = path.join(DATA_DIR, 'pattern-validation', `validation-run-${timestamp}.json`);
    fs.writeFileSync(metadataFile, JSON.stringify(runResult, null, 2), 'utf-8');
    logger.info(`${ICONS.save} Validation run metadata saved to ${path.basename(metadataFile)}`);

    logger.info(`${ICONS.success} Pattern Validation Orchestration Complete`, {
      timestamp: new Date().toISOString(),
      reportsGenerated: 3,
      patternsValidated: validationResults.length,
    });

    process.exit(0);
  } catch (error) {
    logger.error(`${ICONS.error} Validation failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load backtest results from directory
 */
function loadBacktestResults(backtestDir: string): any {
  if (!fs.existsSync(backtestDir)) {
    throw new Error(`Backtest directory not found: ${backtestDir}`);
  }

  // Look for the most recent backtest result file
  const files = fs.readdirSync(backtestDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No backtest result files found in ${backtestDir}`);
  }

  const latestFile = path.join(backtestDir, files[0]);
  const content = fs.readFileSync(latestFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Parse command line argument
 */
function parseArgument(argName: string, defaultValue: number): number {
  const arg = process.argv.find(a => a.startsWith(argName));
  if (!arg) return defaultValue;

  const value = parseInt(arg.split('=')[1], 10);
  return isNaN(value) ? defaultValue : value;
}

/**
 * Check if argument exists
 */
function hasArgument(argName: string): boolean {
  return process.argv.includes(argName);
}

/**
 * Update config weights based on validation results
 */
function updateConfigWeights(configPath: string, results: PatternValidationResult[], logger: LoggerService): number {
  if (!fs.existsSync(configPath)) {
    logger.warn(`Config file not found: ${configPath}`);
    return 0;
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configContent);

  let updateCount = 0;

  for (const result of results) {
    // Ensure pattern config exists
    if (!config.patternMetadata) {
      config.patternMetadata = {};
    }
    if (!config.patternMetadata[result.patternType]) {
      config.patternMetadata[result.patternType] = {};
    }

    // Update weight and last validation
    if (!config.patternMetadata[result.patternType][result.timeframe]) {
      config.patternMetadata[result.patternType][result.timeframe] = {};
    }

    const patternConfig = config.patternMetadata[result.patternType][result.timeframe];
    patternConfig.weight = result.recommendedWeight;
    patternConfig.lastValidation = {
      timestamp: Date.now(),
      trainWR: result.trainResults?.winRate,
      testWR: result.testResults?.winRate,
      degradationLevel: result.degradationLevel,
      isValid: result.isValid,
    };

    updateCount++;
  }

  // Write updated config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return updateCount;
}

/**
 * Print validation summary to console
 */
function printValidationSummary(
  results: PatternValidationResult[],
  critical: PatternValidationResult[],
  warning: PatternValidationResult[],
): void {
  console.log('\n' + '='.repeat(80));
  console.log(`${ICONS.chart} PATTERN VALIDATION SUMMARY`);
  console.log('='.repeat(80));

  console.log(`\nTotal Patterns Validated: ${results.length}`);
  console.log(`  ${ICONS.success} Valid: ${results.filter(r => r.isValid).length}`);
  console.log(`  ${ICONS.warning}  Warning: ${warning.length}`);
  console.log(`  ${ICONS.alarm} Critical: ${critical.length}`);

  if (critical.length > 0) {
    console.log(`
${ICONS.alarm} CRITICAL PATTERNS (Auto-Disabled):`);
    for (const pattern of critical.slice(0, 5)) {
      console.log(`  - ${pattern.patternType} @ ${pattern.timeframe}`);
      console.log(`    Train WR: ${pattern.trainResults?.winRate.toFixed(1)}% | Test WR: ${pattern.testResults?.winRate.toFixed(1)}%`);
      console.log(`    Reason: ${pattern.warnings[0] || 'Low performance'}`);
    }
    if (critical.length > 5) {
      console.log(`  ... and ${critical.length - 5} more`);
    }
  }

  if (warning.length > 0) {
    console.log(`
${ICONS.warning}  WARNING PATTERNS (Reduced Weight):`);
    for (const pattern of warning.slice(0, 5)) {
      console.log(`  - ${pattern.patternType} @ ${pattern.timeframe}`);
      console.log(`    Train WR: ${pattern.trainResults?.winRate.toFixed(1)}% | Test WR: ${pattern.testResults?.winRate.toFixed(1)}%`);
      console.log(`    Overfitting Gap: ${pattern.overfittingGap?.toFixed(1)}%`);
    }
    if (warning.length > 5) {
      console.log(`  ... and ${warning.length - 5} more`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// ============================================================================
// EXECUTION
// ============================================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

