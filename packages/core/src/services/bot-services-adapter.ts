/**
 * BotServicesAdapter
 *
 * Maps the full services state into the narrow runtime contracts used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type {
  IBotInitializerAdapterSource,
  IBotInitializerServices,
  ITradingBotAdapterSource,
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
  ITradingBotRuntimeDependencySource,
  IWebSocketEventHandlerAdapterSource,
  IWebSocketEventHandlerServices,
} from '../interfaces';
import { createWebApiReadServices } from './containers/web-api-read-services';

export const createTradingBotServices = (
  services: ITradingBotAdapterSource,
): ITradingBotServices => ({
  coreServices: services.coreServices,
  monitoringServices: services.monitoringServices,
  executionServices: {
    positionManager: services.executionServices.positionManager,
    positionMonitor: services.executionServices.positionMonitor,
    tradingOrchestrator: services.executionServices.tradingOrchestrator,
  },
  bybitService: services.webApiServices.bybitService,
});

export const createBotInitializerServices = (
  services: IBotInitializerAdapterSource,
): IBotInitializerServices => ({
  coreServices: services.coreServices,
  monitoringServices: services.monitoringServices,
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

export const createWebSocketEventHandlerServices = (
  services: IWebSocketEventHandlerAdapterSource,
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
  services: ITradingBotRuntimeDependencySource,
): ITradingBotRuntimeDependencies => {
  return {
    tradingBotServices: createTradingBotServices(services),
    webApiServices: createWebApiReadServices({
      logger: services.coreServices.logger,
      candleProvider: services.webApiServices.marketDataServices.candleProvider,
      orderbookManager: services.webApiServices.marketDataServices.orderbookManager,
      indicatorCache: services.webApiServices.marketDataServices.indicatorCache,
      journal: services.webApiServices.journal,
      bybitService: services.webApiServices.bybitService,
      indicatorPreferences: services.webApiServices.indicatorPreferences,
      wallTrackerService: services.wallTrackerService,
    }),
    initializerServices: createBotInitializerServices(services),
    eventHandlerServices: createWebSocketEventHandlerServices(services),
  };
};
