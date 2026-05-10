import type { BotServiceState } from '../../bot-services.builder';
import { PrometheusMetricsService } from '../../prometheus-metrics.service';
import type { MonitoringConfig } from './bot-services.types';
import { createPrometheusMetricsConfig } from './prometheus-metrics-config.builder';
import { ICONS } from '../../../cli/cli-runtime';

export const initializePrometheusMetricsService = (
  state: BotServiceState,
  monitoring?: MonitoringConfig,
): void => {
  if (!monitoring?.metricsEnabled) {
    return;
  }

  const metricsConfig = createPrometheusMetricsConfig(monitoring);

  state.metricsService = new PrometheusMetricsService(
    metricsConfig,
    state.logger,
    state.errorHandler,
  );
  state.logger.info(`${ICONS.success} Prometheus Metrics initialized (Phase 14.1.1)`, {
    prefix: metricsConfig.prefix,
    collectInterval: metricsConfig.collectInterval,
  });
};
