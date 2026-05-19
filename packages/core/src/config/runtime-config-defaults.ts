import type { Config } from '../types/legacy';
import { normalizeWebApiConfig } from './web-api-config';

type DataSubscriptionsConfig = Config['dataSubscriptions'];

const createDefaultDataSubscriptions = (config: Config): DataSubscriptionsConfig => ({
  candles: {
    enabled: true,
    calculateIndicators: true,
  },
  orderbook: {
    enabled: config.orderBook?.enabled ?? false,
    updateIntervalMs: 5000,
  },
  ticks: {
    enabled: false,
    calculateDelta: config.delta?.enabled ?? false,
  },
});

export const applyRuntimeConfigDefaults = (config: Config): Config => {
  if (!config.dataSubscriptions) {
    config.dataSubscriptions = createDefaultDataSubscriptions(config);
  }

  config.webApi = normalizeWebApiConfig(config.webApi);
  return config;
};
