import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { createGroupedServices } from '../../containers/bot-services-grouped';
import { createCoreServicesDeps, createEventHandlerServicesDeps, createExecutionServicesDeps, createMarketDataServicesDeps, createMonitoringServicesDeps, createRiskServicesDeps, createWebApiServicesDeps } from './grouped-service-inputs.builder';

export const initializeGroupedServices = (
  state: BotServicesState,
  config: Config,
): void => {
  const groupedServices = createGroupedServices({
    marketDataServices: createMarketDataServicesDeps(state),
    executionServices: createExecutionServicesDeps(state),
    monitoringServices: createMonitoringServicesDeps(state),
    riskServices: createRiskServicesDeps(state),
    webApiServices: createWebApiServicesDeps(state, config),
    coreServices: createCoreServicesDeps(state),
    eventHandlerServices: createEventHandlerServicesDeps(state),
  });

  state.marketDataServices = groupedServices.marketDataServices;
  state.executionServices = groupedServices.executionServices;
  state.monitoringServices = groupedServices.monitoringServices;
  state.riskServices = groupedServices.riskServices;
  state.webApiServices = groupedServices.webApiServices;
  state.coreServices = groupedServices.coreServices;
  state.eventHandlerServices = groupedServices.eventHandlerServices;
};
