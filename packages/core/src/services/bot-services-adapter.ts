/**
 * BotServicesAdapter
 *
 * Maps the full services state into the narrow bundles used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { TradingBotServiceBundle } from '../bot';
import type { IBotServicesAdapterSource } from '../interfaces/IBotServicesAdapterSource';
import { createWebApiReadServices } from './containers/web-api-read-services';
import { createMonitoringReadServices } from './containers/monitoring-services';

export const createTradingBotServiceBundle = (
  services: IBotServicesAdapterSource,
): TradingBotServiceBundle => {
  const webApiReadServices = createWebApiReadServices({
    logger: services.logger,
    candleProvider: services.webApiServices.marketDataServices.candleProvider,
    orderbookManager: services.webApiServices.marketDataServices.orderbookManager,
    indicatorCache: services.webApiServices.marketDataServices.indicatorCache,
    journal: services.webApiServices.journal,
    bybitService: services.webApiServices.bybitService,
    indicatorPreferences: services.webApiServices.indicatorPreferences,
    wallTrackerService: services.wallTrackerService,
  });
  const monitoringReadServices = createMonitoringReadServices(services.monitoringServices);

  return {
    // IWebApiReadServices
    ...webApiReadServices,
    logger: services.logger,

    // ITradingBotServices
    coreServices: services.coreServices,
    positionMonitor: services.positionMonitor,
    monitoringServices: monitoringReadServices,
    executionServices: services.executionServices,

    // IBotInitializerServices
    marketDataServices: services.marketDataServices,
    positionManager: services.positionManager,
    sessionStats: services.sessionStats,
    btcCandles1m: services.btcCandles1m,
    exchangeFactory: services.exchangeFactory,
    resilienceServices: {
      rateLimiter: services.rateLimiter,
      retryPolicy: services.retryPolicy,
      bulkhead: services.bulkhead,
    },

    // IWebSocketEventHandlerServices
    eventHandlerServices: services.eventHandlerServices,
    publicWebSocket: services.marketDataServices.publicWebSocket,
    orderbookImbalanceService: services.orderbookImbalanceService,
    advancedOrderFlowService: services.advancedOrderFlowService,
    deltaAnalyzerService: services.deltaAnalyzerService,
    tradingOrchestrator: services.tradingOrchestrator,
    strategyOrchestrator: services.strategyOrchestrator,
  };
};
