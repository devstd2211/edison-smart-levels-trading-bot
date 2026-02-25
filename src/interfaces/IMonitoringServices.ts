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
  readonly metrics: BotMetricsService;
  readonly metricsService?: IMonitoringMetricsReader;
  readonly healthCheckService?: IMonitoringHealthReader;
  readonly monitoringServer?: MonitoringServer;
  readonly dashboard: ConsoleDashboardService;
}

export interface IMonitoringServices extends IMonitoringReadServices {}
