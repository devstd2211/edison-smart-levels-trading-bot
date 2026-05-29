import type { Config } from '../../types/legacy';
import type { IBotFactoryRuntimeSource } from '../../interfaces';
import { buildBotServiceState as buildRawBotServiceState, type BotServiceState } from '../bot-services.builder';
import { applyBotServiceOverrides } from './bot-services.overrides';
import type { BotFactoryOptions } from './bot-factory-options';

export const buildBotFactoryServiceState = (
  config: Config,
): BotServiceState => {
  return buildRawBotServiceState(config);
};

export const createBotFactoryRuntimeSourceFromState = (
  services: BotServiceState,
): IBotFactoryRuntimeSource => ({
  coreServices: services.coreServices,
  monitoringServices: services.monitoringServices,
  executionServices: services.executionServices,
  marketDataServices: services.marketDataServices,
  bybitService: services.bybitService,
  journal: services.journal,
  sessionStats: services.sessionStats,
  btcCandles1m: services.btcCandles1m,
  exchangeFactory: services.exchangeFactory,
  rateLimiter: services.rateLimiter,
  retryPolicy: services.retryPolicy,
  bulkhead: services.bulkhead,
  eventHandlerServices: services.eventHandlerServices,
  orderbookImbalanceService: services.orderbookImbalanceService,
  advancedOrderFlowService: services.advancedOrderFlowService,
  deltaAnalyzerService: services.deltaAnalyzerService,
  strategyOrchestrator: services.strategyOrchestrator,
  webApiServices: services.webApiServices,
  wallTrackerService: services.wallTrackerService,
});

export const finalizeBotFactoryServiceState = (
  services: BotServiceState,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource => {
  applyBotServiceOverrides(services, options);
  return createBotFactoryRuntimeSourceFromState(services);
};

export const createBotFactoryRuntimeSource = (
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource => {
  return finalizeBotFactoryServiceState(buildBotFactoryServiceState(config), options);
};
