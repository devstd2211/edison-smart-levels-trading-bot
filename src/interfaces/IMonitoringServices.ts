/**
 * IMonitoringServices
 *
 * Grouped monitoring/observability services.
 */

import type { BotMetricsService } from '../services/bot-metrics.service';
import type { MonitoringServer } from '../services/monitoring-server.service';
import type { IMonitoringHealthReader, IMonitoringMetricsReader } from './IMonitoringReaders';
import type { ConsoleDashboardService } from '../services/console-dashboard.service';

export interface IMonitoringReadServices {
  metrics: BotMetricsService;
  metricsService?: IMonitoringMetricsReader;
  healthCheckService?: IMonitoringHealthReader;
  monitoringServer?: MonitoringServer;
  dashboard: ConsoleDashboardService;
}

export interface IMonitoringServices extends IMonitoringReadServices {}
