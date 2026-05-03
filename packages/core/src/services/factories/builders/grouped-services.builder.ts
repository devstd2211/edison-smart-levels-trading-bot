import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { createGroupedServices } from '../../containers/bot-services-grouped';
import { createWebApiReadServices } from '../../containers/web-api-read-services';
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
  state.webApiReadServices = createWebApiReadServices({
    logger: state.coreServices.logger,
    candleProvider: state.webApiServices.marketDataServices.candleProvider,
    orderbookManager: state.webApiServices.marketDataServices.orderbookManager,
    indicatorCache: state.webApiServices.marketDataServices.indicatorCache,
    journal: state.webApiServices.journal,
    bybitService: state.webApiServices.bybitService,
    indicatorPreferences: state.webApiServices.indicatorPreferences,
    wallTrackerService: state.wallTrackerService,
  });
  state.eventHandlerServices = groupedServices.eventHandlerServices;
};
