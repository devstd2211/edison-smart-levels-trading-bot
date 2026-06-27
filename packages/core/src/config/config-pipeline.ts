/**
 * ConfigPipeline
 *
 * Centralizes strategy merge so entrypoints don't duplicate logic.
 */

import type { Config } from '../types/legacy';
import { getConfig } from '../config';
import { applyRuntimeConfigDefaults } from './runtime-config-defaults';
import { ICONS } from '../cli/cli-runtime';
import type {
  ConfigPipelineBaseConfigLoader,
  ConfigPipelineConfigValidator,
  ConfigPipelineLoader,
} from './config-loader-contracts';
import { StrategyLoaderService } from '../services/strategy-loader.service';
import { StrategyConfigMergerService } from '../services/strategy-config-merger.service';
import { ConfigValidatorService } from '../services/config-validator.service';
import type { StrategyIndicatorConfig } from './config-pipeline-summary';
import {
  buildStrategyAnalyzerSummaryLines,
  buildStrategyIndicatorSummaryLines,
  buildStrategyMergeSummaryLines,
  buildStrategyMetadataSummaryLines,
} from './config-pipeline-summary';

const loadDefaultBaseConfig: ConfigPipelineBaseConfigLoader = () => getConfig();

const validateRuntimeConfigAtStartup: ConfigPipelineConfigValidator = (config) =>
  ConfigValidatorService.validateAtStartup(config);

const skipRuntimeConfigValidation: ConfigPipelineConfigValidator = () => undefined;

const createConfigPipelineLoader = (
  loadBaseConfig: ConfigPipelineBaseConfigLoader = loadDefaultBaseConfig,
  validate: ConfigPipelineConfigValidator = skipRuntimeConfigValidation,
): ConfigPipelineLoader => ({
  validate,
  loadBaseConfig,
});

const defaultConfigPipelineLoader: ConfigPipelineLoader = createConfigPipelineLoader(
  loadDefaultBaseConfig,
  validateRuntimeConfigAtStartup,
);

const pipelineOnlyConfigLoader: ConfigPipelineLoader = createConfigPipelineLoader();

export async function applyStrategyConfig(config: Config): Promise<Config> {
  let mergedConfig = config;

  if (config.meta?.strategy) {
    try {
      const strategyLoader = new StrategyLoaderService();
      const strategyMerger = new StrategyConfigMergerService();

      const strategyFile = config.meta.strategyFile || `strategies/json/${config.meta.strategy}.strategy.json`;
      const strategy = await strategyLoader.loadStrategy(config.meta.strategy);
      buildStrategyMetadataSummaryLines(config.meta.strategy, strategyFile, strategy).forEach((line) =>
        console.log(line),
      );

      mergedConfig = strategyMerger.mergeConfigs(config, strategy) as Config;

      const changeReport = strategyMerger.getChangeReport(config, strategy);
      buildStrategyMergeSummaryLines(changeReport.changesCount).forEach((line) => console.log(line));
      buildStrategyAnalyzerSummaryLines(strategy.analyzers).forEach((line) => console.log(line));
      buildStrategyIndicatorSummaryLines(
        strategy.indicators as Record<string, StrategyIndicatorConfig> | undefined,
      ).forEach((line) => console.log(line));
    } catch (error) {
      console.error(`${ICONS.error} Failed to load strategy:`, error);
      throw error;
    }
  }

  return mergedConfig;
}

export async function loadConfigPipeline(
  loader: ConfigPipelineLoader = pipelineOnlyConfigLoader,
): Promise<Config> {
  return loadRuntimeConfig(loader);
}

export async function loadRuntimeConfig(
  loader: ConfigPipelineLoader = defaultConfigPipelineLoader,
): Promise<Config> {
  const config = applyRuntimeConfigDefaults(await applyStrategyConfig(loader.loadBaseConfig()));
  loader.validate(config);
  return config;
}

export async function loadOptionalRuntimeConfig(
  loader?: ConfigPipelineLoader,
): Promise<Config> {
  return loadRuntimeConfig(loader ?? defaultConfigPipelineLoader);
}

export async function loadValidatedConfig(): Promise<Config> {
  return loadRuntimeConfig(defaultConfigPipelineLoader);
}
