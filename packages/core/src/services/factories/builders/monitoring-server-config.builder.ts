import type {
  MonitoringConfig,
  MonitoringServerBuilderConfig,
} from './bot-services.types';

export const createMonitoringServerConfig = (
  monitoring?: MonitoringConfig,
): MonitoringServerBuilderConfig => ({
  enabled: true,
  port: monitoring?.port ?? 9090,
  metricsPath: monitoring?.metricsPath ?? '/metrics',
  healthPath: monitoring?.healthPath ?? '/health',
  cors: monitoring?.cors ?? true,
});
