import type { HealthCheckResult } from '../services/health-check.service';

export interface IMonitoringMetricsReader {
  getMetrics(): Promise<string>;
  getContentType(): string;
}

export interface IMonitoringHealthReader {
  checkHealth(): Promise<HealthCheckResult>;
  isAlive(): Promise<boolean>;
  isReady(): Promise<boolean>;
}
