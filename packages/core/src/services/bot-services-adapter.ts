/**
 * BotServicesAdapter
 *
 * Maps the full services state into the narrow runtime contracts used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { IBotServicesAdapterSource } from '../interfaces/IBotServicesAdapterSource';
import type {
  IBotInitializerServices,
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
  IWebSocketEventHandlerServices,
} from '../interfaces';
import { createWebApiReadServices } from './containers/web-api-read-services';

const createTradingBotServices = (
  services: IBotServicesAdapterSource,
): ITradingBotServices => ({
  ...createWebApiReadServices({
    logger: services.coreServices.logger,
    candleProvider: services.webApiServices.marketDataServices.candleProvider,
    orderbookManager: services.webApiServices.marketDataServices.orderbookManager,
    indicatorCache: services.webApiServices.marketDataServices.indicatorCache,
    journal: services.webApiServices.journal,
    bybitService: services.webApiServices.bybitService,
    indicatorPreferences: services.webApiServices.indicatorPreferences,
    wallTrackerService: services.wallTrackerService,
  }),
  coreServices: services.coreServices,
  monitoringServices: services.monitoringServices,
  executionServices: {
    positionManager: services.executionServices.positionManager,
    positionMonitor: services.executionServices.positionMonitor,
    tradingOrchestrator: services.executionServices.tradingOrchestrator,
  },
});

const createBotInitializerServices = (
  services: IBotServicesAdapterSource,
): IBotInitializerServices => ({
  coreServices: services.coreServices,
  marketDataServices: services.marketDataServices,
  executionServices: services.executionServices,
  sessionStats: services.sessionStats,
  btcCandles1m: services.btcCandles1m,
  exchangeFactory: services.exchangeFactory,
  resilienceServices: {
    rateLimiter: services.rateLimiter,
    retryPolicy: services.retryPolicy,
    bulkhead: services.bulkhead,
  },
});

const createWebSocketEventHandlerServices = (
  services: IBotServicesAdapterSource,
): IWebSocketEventHandlerServices => ({
  logger: services.logger,
  eventHandlerServices: services.eventHandlerServices,
  executionServices: services.executionServices,
  marketDataServices: services.marketDataServices,
  orderbookImbalanceService: services.orderbookImbalanceService,
  advancedOrderFlowService: services.advancedOrderFlowService,
  deltaAnalyzerService: services.deltaAnalyzerService,
  strategyOrchestrator: services.strategyOrchestrator,
});

export const createTradingBotRuntimeDependencies = (
  services: IBotServicesAdapterSource,
): ITradingBotRuntimeDependencies => {
  return {
    tradingBotServices: createTradingBotServices(services),
    initializerServices: createBotInitializerServices(services),
    eventHandlerServices: createWebSocketEventHandlerServices(services),
  };
};
