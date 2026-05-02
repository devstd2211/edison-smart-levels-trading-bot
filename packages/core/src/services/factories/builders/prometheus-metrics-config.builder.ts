import type { MetricsConfig } from '../../prometheus-metrics.service';
import type { MonitoringConfig } from './bot-services.types';

const DEFAULT_METRICS_PREFIX = 'trading_bot_';
const DEFAULT_COLLECT_INTERVAL = 10000;

export const createPrometheusMetricsConfig = (
  monitoring?: MonitoringConfig,
): Required<Pick<MetricsConfig, 'enabled' | 'prefix' | 'collectInterval'>> &
  Pick<MetricsConfig, 'defaultLabels'> => ({
  enabled: true,
  prefix: monitoring?.metricsPrefix ?? DEFAULT_METRICS_PREFIX,
  collectInterval: monitoring?.collectInterval ?? DEFAULT_COLLECT_INTERVAL,
  defaultLabels: monitoring?.defaultLabels,
});
