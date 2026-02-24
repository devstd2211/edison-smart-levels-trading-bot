/**
 * IMonitoringServices
 *
 * Grouped monitoring/observability services.
 */

import type { BotMetricsService } from '../services/bot-metrics.service';
import type { PrometheusMetricsService } from '../services/prometheus-metrics.service';
import type { HealthCheckService } from '../services/health-check.service';
import type { MonitoringServer } from '../services/monitoring-server.service';
import type { ConsoleDashboardService } from '../services/console-dashboard.service';

export interface IMonitoringServices {
  metrics: BotMetricsService;
  metricsService?: PrometheusMetricsService;
  healthCheckService?: HealthCheckService;
  monitoringServer?: MonitoringServer;
  dashboard: ConsoleDashboardService;
}
