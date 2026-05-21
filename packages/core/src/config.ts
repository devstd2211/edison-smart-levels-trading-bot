/**
 * Configuration Loader
 * Loads config from config.json and applies environment variables
 */

import * as fs from 'fs';
import { Config } from './types/legacy';
import { applyRuntimeConfigDefaults } from './config/runtime-config-defaults';
import { validateRiskManagementConfig } from './config/risk-management.validate';
import {
  applyConfigEnvironmentOverrides,
  loadConfigEnvironment,
  logConfigDefaultsApplied,
  logConfigLoadDebug,
  readBaseConfigFile,
  resolveRootConfigPath,
} from './config-loader';

/**
 * Load configuration from config.json and apply environment variables.
 *
 * Strategy merging is handled by ConfigPipeline.
 */
export function getConfig(): Config {
  loadConfigEnvironment();
  const configPath = resolveRootConfigPath();
  const config = readBaseConfigFile(configPath, fs);
  const hadMissingDataSubscriptions = !config.dataSubscriptions;
  logConfigLoadDebug(console, configPath, config, hadMissingDataSubscriptions);
  applyRuntimeConfigDefaults(config);
  logConfigDefaultsApplied(console, config, hadMissingDataSubscriptions);
  applyConfigEnvironmentOverrides(config);

  // =========================================================================
  // VALIDATE RISKMANAGEMENT CONFIG (NEW - Session 29.4c)
  // =========================================================================
  validateRiskManagementConfig(config);

  return config;
}
