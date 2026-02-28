/**
 * MonitoringServices
 *
 * Grouped container for monitoring/observability dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { IMonitoringReadServices, IMonitoringServices } from '../../interfaces/IMonitoringServices';

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

export const createMonitoringServices = (
  deps: IMonitoringServices,
): MonitoringServices => new MonitoringServices(deps);

export const createMonitoringReadServices = (
  deps: IMonitoringReadServices,
): IMonitoringReadServices => ({
  metrics: deps.metrics,
  metricsService: deps.metricsService,
  healthCheckService: deps.healthCheckService,
  monitoringServer: deps.monitoringServer,
  dashboard: deps.dashboard,
});
