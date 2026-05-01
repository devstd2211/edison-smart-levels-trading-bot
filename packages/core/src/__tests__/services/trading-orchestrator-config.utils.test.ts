import {
  asRecord,
  buildAnalyzerExecutionConfig,
  buildAnalyzerRegistryConfig,
  getAnalyzerDefaultsFromRuntimeConfig,
  getConfiguredAnalyzersFromRuntimeConfig,
  getIndicatorsConfigFromRuntimeConfig,
  isEnabledAnalyzerConfig,
} from '../../services/trading-orchestrator/trading-orchestrator-config.utils';

describe('trading-orchestrator-config.utils', () => {
  it('normalizes runtime config sections', () => {
    const runtimeConfig = {
      indicators: { ema: { enabled: true } },
      analyzerDefaults: { EMA_ANALYZER_NEW: { period: 21 } },
      analyzers: [{ name: 'EMA_ANALYZER_NEW', enabled: true }],
    };

    expect(getIndicatorsConfigFromRuntimeConfig(runtimeConfig)).toEqual(
      runtimeConfig.indicators,
    );
    expect(getAnalyzerDefaultsFromRuntimeConfig(runtimeConfig)).toEqual(
      runtimeConfig.analyzerDefaults,
    );
    expect(getConfiguredAnalyzersFromRuntimeConfig(runtimeConfig)).toHaveLength(1);
    expect(isEnabledAnalyzerConfig({ enabled: true })).toBe(true);
    expect(asRecord(null)).toEqual({});
  });

  it('builds analyzer registry and execution configs', () => {
    const indicators = { ema: { source: 'indicator', fast: 9 } };
    const defaults = { EMA_ANALYZER_NEW: { period: 21 } };
    const analyzer = {
      name: 'EMA_ANALYZER_NEW',
      enabled: true,
      params: { threshold: 0.7 },
    };

    expect(buildAnalyzerRegistryConfig(indicators, defaults)).toEqual({
      indicators,
      analyzerDefaults: defaults,
    });

    expect(
      buildAnalyzerExecutionConfig(analyzer, indicators, defaults),
    ).toMatchObject({
      enabled: true,
      period: 21,
      source: 'indicator',
      fast: 9,
      threshold: 0.7,
    });
  });
});
