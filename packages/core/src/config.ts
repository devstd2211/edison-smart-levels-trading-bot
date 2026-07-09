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

// Strategy merging is handled by ConfigPipeline.
export function getConfig(): Config {
  loadConfigEnvironment();
  const configPath = resolveRootConfigPath();
  const rawConfig = readBaseConfigFile(configPath, fs);
  const hadMissingDataSubscriptions = !rawConfig.dataSubscriptions;
  logConfigLoadDebug(console, configPath, rawConfig, hadMissingDataSubscriptions);
  const config = applyRuntimeConfigDefaults(rawConfig);
  logConfigDefaultsApplied(console, config, hadMissingDataSubscriptions);
  applyConfigEnvironmentOverrides(config);

  validateRiskManagementConfig(config.riskManagement);

  return config;
}
