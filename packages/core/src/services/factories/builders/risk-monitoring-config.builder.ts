import type { Config, LiveTradingConfig, RiskMonitoringConfig } from '../../../types/legacy';

export const createRiskMonitoringConfig = (config: Config): RiskMonitoringConfig => {
  const liveTradingConfig = (config as Partial<{ liveTrading: LiveTradingConfig }>).liveTrading;

  return {
    enabled: true,
    checkIntervalCandles: 5,
    healthScoreThreshold: 30,
    emergencyCloseOnCritical: true,
    ...(liveTradingConfig?.riskMonitoring ?? {}),
  };
};
