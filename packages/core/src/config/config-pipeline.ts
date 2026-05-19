/**
 * ConfigPipeline
 *
 * Centralizes strategy merge so entrypoints don't duplicate logic.
 */

import type { Config } from '../types/legacy';
import { getConfig } from '../config';
import { applyRuntimeConfigDefaults } from './runtime-config-defaults';
import { ICONS } from '../cli/cli-runtime';
import {
  CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT,
  CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION,
  CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION,
  CONFIG_PIPELINE_SEPARATOR_LENGTH,
} from './config-pipeline.constants';
import { StrategyLoaderService } from '../services/strategy-loader.service';
import { StrategyConfigMergerService } from '../services/strategy-config-merger.service';
import { ConfigValidatorService } from '../services/config-validator.service';

type ConfigPipelineLoader = {
  loadBaseConfig(): Config;
  validate(config: Config): void;
};

const DEFAULT_SEPARATOR = '='.repeat(CONFIG_PIPELINE_SEPARATOR_LENGTH);

const createConfigPipelineLoader = (
  validate: ConfigPipelineLoader['validate'],
): ConfigPipelineLoader => ({
  loadBaseConfig: () => getConfig(),
  validate,
});

const defaultConfigPipelineLoader: ConfigPipelineLoader = createConfigPipelineLoader(
  (config) => ConfigValidatorService.validateAtStartup(config),
);

const pipelineOnlyConfigLoader: ConfigPipelineLoader = createConfigPipelineLoader(
  () => undefined,
);

export async function applyStrategyConfig(config: Config): Promise<Config> {
  let mergedConfig = config;

  if (config.meta?.strategy) {
    try {
      const strategyLoader = new StrategyLoaderService();
      const strategyMerger = new StrategyConfigMergerService();

      const strategyFile = config.meta.strategyFile || `strategies/json/${config.meta.strategy}.strategy.json`;
      console.log(`${ICONS.note} Loading strategy: ${config.meta.strategy}`);
      console.log(`   ${ICONS.note} File: ${strategyFile}`);
      const strategy = await strategyLoader.loadStrategy(config.meta.strategy);

      if (strategy.metadata) {
        console.log(`   ${ICONS.note} Name: ${strategy.metadata.name} v${strategy.metadata.version}`);
        if (strategy.metadata.description) {
          console.log(`   ${ICONS.note} Description: ${strategy.metadata.description}`);
        }
      }

      mergedConfig = strategyMerger.mergeConfigs(config, strategy) as Config;

      const changeReport = strategyMerger.getChangeReport(config, strategy);
      console.log(`${ICONS.success} Strategy merged | ${changeReport.changesCount} config overrides applied`);

      if (strategy.analyzers && strategy.analyzers.length > 0) {
        console.log(`\n${DEFAULT_SEPARATOR}`);
        console.log(`${ICONS.chart} STRATEGY ANALYZERS (${strategy.analyzers.length} total):`);
        console.log(DEFAULT_SEPARATOR);

        const enabledAnalyzers = strategy.analyzers.filter((analyzer) => analyzer.enabled);
        console.log(
          `   ${ICONS.success} Enabled: ${enabledAnalyzers.length} | ${ICONS.error} Disabled: ${strategy.analyzers.length - enabledAnalyzers.length}`,
        );

        const byWeight = enabledAnalyzers.reduce(
          (acc, analyzer) => {
            const key = `${(analyzer.weight * 100).toFixed(CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION)}%`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(analyzer.name);
            return acc;
          },
          {} as Record<string, string[]>,
        );

        console.log('\n   Weight Distribution:');
        Object.entries(byWeight)
          .sort(([left], [right]) => parseFloat(right) - parseFloat(left))
          .forEach(([weight, names]) => {
            console.log(`     ${weight}: ${names.length} analyzers`);
          });

        const topAnalyzers = [...enabledAnalyzers]
          .sort((left, right) => (right.weight || 0) - (left.weight || 0))
          .slice(0, CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT);
        if (topAnalyzers.length > 0) {
          console.log(`\n   Top ${CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT} Analyzers by Weight:`);
          topAnalyzers.forEach((analyzer) => {
            console.log(
              `     - ${analyzer.name}: ${(analyzer.weight * 100).toFixed(CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION)}% weight (priority=${analyzer.priority})`,
            );
          });
        }
        console.log(`${DEFAULT_SEPARATOR}\n`);
      }

      if (strategy.indicators) {
        console.log(DEFAULT_SEPARATOR);
        console.log(`${ICONS.chart} INDICATORS CONFIGURED (${Object.keys(strategy.indicators).length} total):`);
        console.log(DEFAULT_SEPARATOR);

        Object.entries(strategy.indicators).forEach(([name, configEntry]) => {
          const cfg = configEntry as Partial<{
            period: number;
            fastPeriod: number;
            slowPeriod: number;
            kPeriod: number;
            dPeriod: number;
            stdDev: number;
          }>;
          const details: string[] = [];
          if (cfg.period) {
            details.push(`period=${cfg.period}`);
          }
          if (cfg.fastPeriod) {
            details.push(`fast=${cfg.fastPeriod}, slow=${cfg.slowPeriod}`);
          }
          if (cfg.kPeriod) {
            details.push(`k=${cfg.kPeriod}, d=${cfg.dPeriod}`);
          }
          if (cfg.stdDev) {
            details.push(`stdDev=${cfg.stdDev}`);
          }

          const detailsStr = details.length > 0 ? `: ${details.join(', ')}` : '';
          console.log(`   - ${name}${detailsStr}`);
        });
        console.log(`${DEFAULT_SEPARATOR}\n`);
      }
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

export async function loadValidatedConfig(): Promise<Config> {
  return loadRuntimeConfig();
}

export type { ConfigPipelineLoader };
