/**
 * Grouped service factory for services state.
 *
 * Keeps grouped container wiring out of the services builder.
 */

import { MarketDataServices } from './market-data-services';
import { ExecutionServices } from './execution-services';
import { createMonitoringServices, type MonitoringServices } from './monitoring-services';
import { RiskServices } from './risk-services';
import { createWebApiServices, type WebApiServices } from './web-api-services';
import { CoreServices } from './core-services';
import { EventHandlerServices } from './event-handler-services';
import type { ICoreServices } from '../../interfaces/ICoreServices';
import type { IEventHandlerServices } from '../../interfaces/IEventHandlerServices';
import type { IExecutionServices } from '../../interfaces/IExecutionServices';
import type { IMarketDataServices } from '../../interfaces/IMarketDataServices';
import type { IMonitoringServices } from '../../interfaces/IMonitoringServices';
import type { IRiskServices } from '../../interfaces/IRiskServices';
import type { IWebApiServicesContainer } from '../../interfaces/IWebApiServicesContainer';

type GroupedServiceDeps = {
  marketDataServices: IMarketDataServices;
  executionServices: IExecutionServices;
  monitoringServices: IMonitoringServices;
  riskServices: IRiskServices;
  webApiServices: IWebApiServicesContainer;
  coreServices: ICoreServices;
  eventHandlerServices: IEventHandlerServices;
};

export const createGroupedServices = (deps: GroupedServiceDeps) => ({
  marketDataServices: new MarketDataServices(deps.marketDataServices),
  executionServices: new ExecutionServices(deps.executionServices),
  monitoringServices: createMonitoringServices(deps.monitoringServices),
  riskServices: new RiskServices(deps.riskServices),
  webApiServices: createWebApiServices(deps.webApiServices),
  coreServices: new CoreServices(deps.coreServices),
  eventHandlerServices: new EventHandlerServices(deps.eventHandlerServices),
});
