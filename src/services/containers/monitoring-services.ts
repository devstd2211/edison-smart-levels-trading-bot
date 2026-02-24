/**
 * MonitoringServices
 *
 * Grouped container for monitoring/observability dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { IMonitoringServices } from '../../interfaces/IMonitoringServices';

export class MonitoringServices implements IMonitoringServices {
  readonly metrics: IMonitoringServices['metrics'];
  readonly metricsService?: IMonitoringServices['metricsService'];
  readonly healthCheckService?: IMonitoringServices['healthCheckService'];
  readonly monitoringServer?: IMonitoringServices['monitoringServer'];
  readonly dashboard: IMonitoringServices['dashboard'];

  constructor(deps: IMonitoringServices) {
    this.metrics = deps.metrics;
    this.metricsService = deps.metricsService;
    this.healthCheckService = deps.healthCheckService;
    this.monitoringServer = deps.monitoringServer;
    this.dashboard = deps.dashboard;
  }
}
