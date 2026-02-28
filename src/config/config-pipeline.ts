/**
 * ConfigPipeline
 *
 * Centralizes strategy merge so entrypoints don't duplicate logic.
 */

import type { Config } from '../types/legacy';
import { getConfig } from '../config';
import { StrategyLoaderService } from '../services/strategy-loader.service';
import { StrategyConfigMergerService } from '../services/strategy-config-merger.service';
import { ConfigValidatorService } from '../services/config-validator.service';

export async function applyStrategyConfig(config: Config): Promise<Config> {
  let mergedConfig = config;

  if (config.meta?.strategy) {
    try {
      const strategyLoader = new StrategyLoaderService();
      const strategyMerger = new StrategyConfigMergerService();

      const strategyFile = config.meta?.strategyFile || `strategies/json/${config.meta.strategy}.strategy.json`;
      console.log(`📋 Loading strategy: ${config.meta.strategy}`);
      console.log(`   📄 File: ${strategyFile}`);
      const strategy = await strategyLoader.loadStrategy(config.meta.strategy);

      // Log strategy metadata for clarity
      if (strategy.metadata) {
        console.log(`   ℹ️  Name: ${strategy.metadata.name} v${strategy.metadata.version}`);
        if (strategy.metadata.description) {
          console.log(`   📝 Description: ${strategy.metadata.description}`);
        }
      }
      mergedConfig = strategyMerger.mergeConfigs(config, strategy) as Config;

      const changeReport = strategyMerger.getChangeReport(
        config,
        strategy,
      );
      console.log(
        `✅ Strategy merged | ${changeReport.changesCount} config overrides applied`,
      );

      // Log loaded analyzers with visual separators
      if (strategy.analyzers && strategy.analyzers.length > 0) {
        console.log('\n' + '═'.repeat(80));
        console.log(`📊 STRATEGY ANALYZERS (${strategy.analyzers.length} total):`);
        console.log('═'.repeat(80));
        const enabledAnalyzers = strategy.analyzers.filter((a) => a.enabled);
        console.log(
          `   ✅ Enabled: ${enabledAnalyzers.length} | ❌ Disabled: ${strategy.analyzers.length - enabledAnalyzers.length}`,
        );

        // Group by weight
        const byWeight = enabledAnalyzers.reduce(
          (acc, a) => {
            const key = `${(a.weight * 100).toFixed(1)}%`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(a.name);
            return acc;
          },
          {} as Record<string, string[]>,
        );

        console.log('\n   Weight Distribution:');
        Object.entries(byWeight)
          .sort(([w1], [w2]) => parseFloat(w2) - parseFloat(w1))
          .forEach(([weight, names]) => {
            console.log(`     ${weight}: ${names.length} analyzers`);
          });

        // Log top 5 by weight
        const topAnalyzers = [...enabledAnalyzers]
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, 5);
        if (topAnalyzers.length > 0) {
          console.log('\n   Top 5 Analyzers by Weight:');
          topAnalyzers.forEach((a) => {
            console.log(
              `     🔹 ${a.name}: ${(a.weight * 100).toFixed(2)}% weight (priority=${a.priority})`,
            );
          });
        }
        console.log('═'.repeat(80) + '\n');
      }

      // Log indicator overrides with visual separator
      if (strategy.indicators) {
        console.log('═'.repeat(80));
        console.log(
          `📈 INDICATORS CONFIGURED (${Object.keys(strategy.indicators).length} total):`,
        );
        console.log('═'.repeat(80));
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
          if (cfg.period) details.push(`period=${cfg.period}`);
          if (cfg.fastPeriod)
            details.push(`fast=${cfg.fastPeriod}, slow=${cfg.slowPeriod}`);
          if (cfg.kPeriod) details.push(`k=${cfg.kPeriod}, d=${cfg.dPeriod}`);
          if (cfg.stdDev) details.push(`stdDev=${cfg.stdDev}`);
          const detailsStr = details.length > 0 ? ` → ${details.join(', ')}` : '';
          console.log(`   🔹 ${name}${detailsStr}`);
        });
        console.log('═'.repeat(80) + '\n');
      }
    } catch (error) {
      console.error('❌ Failed to load strategy:', error);
      throw error;
    }
  }

  return mergedConfig;
}

export async function loadConfigPipeline(): Promise<Config> {
  const config = getConfig();
  return applyStrategyConfig(config);
}

export async function loadValidatedConfig(): Promise<Config> {
  const config = await loadConfigPipeline();
  ConfigValidatorService.validateAtStartup(config);
  return config;
}
