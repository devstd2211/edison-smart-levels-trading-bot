import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import {
  createGroupedServices,
  type GroupedServices,
} from '../../containers/bot-services-grouped';
import {
  createGroupedServicesConfig,
  createGroupedServicesDeps,
  type GroupedServicesBuilderState,
} from './grouped-service-inputs.builder';

type GroupedServicesState = Pick<
  BotServiceState,
  | 'marketDataServices'
  | 'executionServices'
  | 'monitoringServices'
  | 'riskServices'
  | 'webApiServices'
  | 'coreServices'
  | 'eventHandlerServices'
>;

const assignGroupedServices = (
  state: GroupedServicesState,
  groupedServices: GroupedServices,
): void => {
  state.marketDataServices = groupedServices.marketDataServices;
  state.executionServices = groupedServices.executionServices;
  state.monitoringServices = groupedServices.monitoringServices;
  state.riskServices = groupedServices.riskServices;
  state.webApiServices = groupedServices.webApiServices;
  state.coreServices = groupedServices.coreServices;
  state.eventHandlerServices = groupedServices.eventHandlerServices;
};

export const initializeGroupedServices = (
  state: GroupedServicesBuilderState,
  config: Config,
): void => {
  const groupedServices = createGroupedServices(
    createGroupedServicesDeps(state, createGroupedServicesConfig(config)),
  );
  assignGroupedServices(state, groupedServices);
};
