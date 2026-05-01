export interface AnalyzerConfigInput {
  name: string;
  enabled?: boolean;
  weight?: number;
  priority?: number;
  minConfidence?: number;
  maxConfidence?: number;
  params?: Record<string, unknown>;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getIndicatorsConfigFromRuntimeConfig(
  runtimeConfig: { indicators?: unknown },
): Record<string, unknown> {
  return asRecord(runtimeConfig.indicators);
}

export function getAnalyzerDefaultsFromRuntimeConfig(
  runtimeConfig: { analyzerDefaults?: unknown },
): Record<string, Record<string, unknown>> {
  const defaults = runtimeConfig.analyzerDefaults;
  return defaults && typeof defaults === 'object'
    ? (defaults as Record<string, Record<string, unknown>>)
    : {};
}

export function getConfiguredAnalyzersFromRuntimeConfig(
  runtimeConfig: { analyzers?: unknown },
): AnalyzerConfigInput[] {
  const analyzers = runtimeConfig.analyzers;
  if (Array.isArray(analyzers)) {
    return analyzers as AnalyzerConfigInput[];
  }
  if (analyzers && typeof analyzers === 'object') {
    return Object.values(analyzers) as AnalyzerConfigInput[];
  }
  return [];
}

export function isEnabledAnalyzerConfig(value: unknown): boolean {
  return asRecord(value).enabled === true;
}

export function buildAnalyzerRegistryConfig(
  indicators: Record<string, unknown>,
  analyzerDefaults: Record<string, Record<string, unknown>>,
): {
  indicators: Record<string, unknown>;
  analyzerDefaults: Record<string, Record<string, unknown>>;
} {
  return {
    indicators,
    analyzerDefaults,
  };
}

export function buildAnalyzerExecutionConfig(
  analyzerCfg: AnalyzerConfigInput,
  indicators: Record<string, unknown>,
  analyzerDefaults: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enabled: analyzerCfg.enabled,
    weight: analyzerCfg.weight,
    priority: analyzerCfg.priority,
    minConfidence: analyzerCfg.minConfidence ?? 0.5,
    maxConfidence: analyzerCfg.maxConfidence ?? 1.0,
  };

  if (analyzerDefaults[analyzerCfg.name]) {
    Object.assign(config, analyzerDefaults[analyzerCfg.name]);
  }

  const analyzerToIndicator: Record<string, string> = {
    EMA_ANALYZER_NEW: 'ema',
    RSI_ANALYZER_NEW: 'rsi',
    ATR_ANALYZER_NEW: 'atr',
    VOLUME_ANALYZER_NEW: 'volume',
    STOCHASTIC_ANALYZER_NEW: 'stochastic',
    BOLLINGER_BANDS_ANALYZER_NEW: 'bollingerBands',
  };

  const indicatorKey = analyzerToIndicator[analyzerCfg.name];
  if (indicatorKey && indicators[indicatorKey]) {
    Object.assign(config, indicators[indicatorKey] as Record<string, unknown>);
  }

  if (analyzerCfg.params) {
    Object.assign(config, analyzerCfg.params);
  }

  return config;
}
