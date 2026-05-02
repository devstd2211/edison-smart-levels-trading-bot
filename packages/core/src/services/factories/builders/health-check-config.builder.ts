import type {
  MonitoringConfig,
  MonitoringHealthCheckBuilderConfig,
  MonitoringThresholdsConfig,
} from './bot-services.types';

const DEFAULT_MONITORING_THRESHOLDS: MonitoringThresholdsConfig = {
  memoryUsagePercent: 90,
  cpuUsagePercent: 80,
  diskUsagePercent: 90,
};

export const createHealthCheckConfig = (
  monitoring?: MonitoringConfig,
): MonitoringHealthCheckBuilderConfig => ({
  enabled: true,
  thresholds: {
    ...DEFAULT_MONITORING_THRESHOLDS,
    ...monitoring?.thresholds,
  },
});
