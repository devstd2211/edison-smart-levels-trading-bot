import { ICONS } from '../cli/cli-runtime';
import {
  CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT,
  CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION,
  CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION,
  CONFIG_PIPELINE_SEPARATOR_LENGTH,
} from './config-pipeline.constants';
import type {
  StrategyAnalyzerConfigV2,
  StrategyConfigV2,
} from '../types/legacy';

const DEFAULT_SEPARATOR = '='.repeat(CONFIG_PIPELINE_SEPARATOR_LENGTH);

type StrategyIndicatorConfig = Partial<{
  period: number;
  fastPeriod: number;
  slowPeriod: number;
  kPeriod: number;
  dPeriod: number;
  stdDev: number;
}>;

type StrategyIndicatorSummarySource =
  | StrategyConfigV2['indicators']
  | Record<string, StrategyIndicatorConfig>;

export const buildStrategyMetadataSummaryLines = (
  strategyName: string,
  strategyFile: string,
  strategy: Pick<StrategyConfigV2, 'metadata'>,
): string[] => {
  const lines = [
    `${ICONS.note} Loading strategy: ${strategyName}`,
    `   ${ICONS.note} File: ${strategyFile}`,
  ];

  if (strategy.metadata) {
    lines.push(`   ${ICONS.note} Name: ${strategy.metadata.name} v${strategy.metadata.version}`);
    if (strategy.metadata.description) {
      lines.push(`   ${ICONS.note} Description: ${strategy.metadata.description}`);
    }
  }

  return lines;
};

export const buildStrategyMergeSummaryLines = (changesCount: number): string[] => [
  `${ICONS.success} Strategy merged | ${changesCount} config overrides applied`,
];

export const buildStrategyAnalyzerSummaryLines = (
  analyzers: StrategyAnalyzerConfigV2[] = [],
): string[] => {
  if (analyzers.length === 0) {
    return [];
  }

  const enabledAnalyzers = analyzers.filter((analyzer) => analyzer.enabled);
  const byWeight = enabledAnalyzers.reduce<Record<string, string[]>>((accumulator, analyzer) => {
    const key = `${(analyzer.weight * 100).toFixed(CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION)}%`;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(analyzer.name);
    return accumulator;
  }, {});

  const lines = [
    '',
    DEFAULT_SEPARATOR,
    `${ICONS.chart} STRATEGY ANALYZERS (${analyzers.length} total):`,
    DEFAULT_SEPARATOR,
    `   ${ICONS.success} Enabled: ${enabledAnalyzers.length} | ${ICONS.error} Disabled: ${analyzers.length - enabledAnalyzers.length}`,
    '',
    '   Weight Distribution:',
  ];

  Object.entries(byWeight)
    .sort(([left], [right]) => parseFloat(right) - parseFloat(left))
    .forEach(([weight, names]) => {
      lines.push(`     ${weight}: ${names.length} analyzers`);
    });

  const topAnalyzers = [...enabledAnalyzers]
    .sort((left, right) => (right.weight || 0) - (left.weight || 0))
    .slice(0, CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT);
  if (topAnalyzers.length > 0) {
    lines.push('');
    lines.push(`   Top ${CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT} Analyzers by Weight:`);
    topAnalyzers.forEach((analyzer) => {
      lines.push(
        `     - ${analyzer.name}: ${(analyzer.weight * 100).toFixed(CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION)}% weight (priority=${analyzer.priority})`,
      );
    });
  }

  lines.push(`${DEFAULT_SEPARATOR}\n`);
  return lines;
};

export const buildStrategyIndicatorSummaryLines = (
  indicators?: StrategyIndicatorSummarySource,
): string[] => {
  if (!indicators || Object.keys(indicators).length === 0) {
    return [];
  }

  const lines = [
    DEFAULT_SEPARATOR,
    `${ICONS.chart} INDICATORS CONFIGURED (${Object.keys(indicators).length} total):`,
    DEFAULT_SEPARATOR,
  ];

  Object.entries(indicators).forEach(([name, configEntry]) => {
    const detailsConfig = configEntry as StrategyIndicatorConfig;
    const details: string[] = [];
    if (detailsConfig.period) {
      details.push(`period=${detailsConfig.period}`);
    }
    if (detailsConfig.fastPeriod) {
      details.push(`fast=${detailsConfig.fastPeriod}, slow=${detailsConfig.slowPeriod}`);
    }
    if (detailsConfig.kPeriod) {
      details.push(`k=${detailsConfig.kPeriod}, d=${detailsConfig.dPeriod}`);
    }
    if (detailsConfig.stdDev) {
      details.push(`stdDev=${detailsConfig.stdDev}`);
    }

    const detailsSuffix = details.length > 0 ? `: ${details.join(', ')}` : '';
    lines.push(`   - ${name}${detailsSuffix}`);
  });

  lines.push(`${DEFAULT_SEPARATOR}\n`);
  return lines;
};
