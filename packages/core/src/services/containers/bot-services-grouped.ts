/**
 * Grouped service factory for services state.
 *
 * Keeps grouped container wiring out of the services builder.
 */

import { createMarketDataServices } from './market-data-services';
import { createExecutionServices } from './execution-services';
import { createMonitoringServices } from './monitoring-services';
import { createRiskServices } from './risk-services';
import { createWebApiServices, type WebApiServices } from './web-api-services';
import { createCoreServices } from './core-services';
import { createEventHandlerServices } from './event-handler-services';
import type { ICoreServices } from '../../interfaces/ICoreServices';
import type { IEventHandlerServices } from '../../interfaces/IEventHandlerServices';
import type { IExecutionServices } from '../../interfaces/IExecutionServices';
import type { IMarketDataServices } from '../../interfaces/IMarketDataServices';
import type { IMonitoringServices } from '../../interfaces/IMonitoringServices';
import type { IRiskServices } from '../../interfaces/IRiskServices';
import type { IWebApiServicesContainer } from '../../interfaces/IWebApiServicesContainer';

export type GroupedServiceDeps = {
  marketDataServices: IMarketDataServices;
  executionServices: IExecutionServices;
  monitoringServices: IMonitoringServices;
  riskServices: IRiskServices;
  webApiServices: IWebApiServicesContainer;
  coreServices: ICoreServices;
  eventHandlerServices: IEventHandlerServices;
};

export type GroupedServices = {
  marketDataServices: IMarketDataServices;
  executionServices: IExecutionServices;
  monitoringServices: IMonitoringServices;
  riskServices: IRiskServices;
  webApiServices: IWebApiServicesContainer;
  coreServices: ICoreServices;
  eventHandlerServices: IEventHandlerServices;
};

export const createGroupedServices = (deps: GroupedServiceDeps): GroupedServices => ({
  marketDataServices: createMarketDataServices(deps.marketDataServices),
  executionServices: createExecutionServices(deps.executionServices),
  monitoringServices: createMonitoringServices(deps.monitoringServices),
  riskServices: createRiskServices(deps.riskServices),
  webApiServices: createWebApiServices(deps.webApiServices),
  coreServices: createCoreServices(deps.coreServices),
  eventHandlerServices: createEventHandlerServices(deps.eventHandlerServices),
});
