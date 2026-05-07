/**
 * Runtime service adapters
 *
 * Maps the full service state into the narrow runtime contracts used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type {
  IBotInitializerRuntimeSource,
  IBotInitializerServices,
  IBotRuntimeSource,
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
  ITradingBotRuntimeSource,
  IWebSocketEventHandlerRuntimeSource,
  IWebSocketEventHandlerExecutionServices,
  IWebSocketEventHandlerMarketDataServices,
  IWebSocketEventHandlerServices,
} from '../interfaces';
import { createMonitoringReadServices } from './containers/monitoring-services';
import { createWebApiReadServices, selectWebApiReadServices } from './containers/web-api-read-services';

export const createTradingBotServices = (
  services: ITradingBotRuntimeSource,
): ITradingBotServices => ({
  coreServices: services.coreServices,
  monitoringServices: createMonitoringReadServices(services.monitoringServices),
  executionServices: {
    positionManager: services.executionServices.positionManager,
    positionMonitor: services.executionServices.positionMonitor,
    tradingOrchestrator: services.executionServices.tradingOrchestrator,
  },
});

export const createBotInitializerServices = (
  services: IBotInitializerRuntimeSource,
): IBotInitializerServices => {
  const exchangeRuntime = {
    current: services.bybitService,
    setCurrent(exchange: IBotInitializerServices['exchangeRuntime']['current']) {
      exchangeRuntime.current = exchange;
    },
  };

  return {
    coreServices: services.coreServices,
    monitoringServices: services.monitoringServices,
    marketDataServices: {
      candleProvider: services.marketDataServices.candleProvider,
      orderbookManager: services.marketDataServices.orderbookManager,
      publicWebSocket: services.marketDataServices.publicWebSocket,
      webSocketManager: services.marketDataServices.webSocketManager,
    },
    exchangeRuntime,
    executionServices: services.executionServices,
    journal: services.journal,
    sessionStats: services.sessionStats,
    btcMarketState: {
      btcCandles1m: services.btcCandles1m,
    },
    exchangeFactory: services.exchangeFactory,
    resilienceServices: {
      rateLimiter: services.rateLimiter,
      retryPolicy: services.retryPolicy,
      bulkhead: services.bulkhead,
    },
  };
};

export const createWebSocketEventHandlerServices = (
  services: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerServices => ({
  logger: services.coreServices.logger,
  eventHandlerServices: services.eventHandlerServices,
  executionServices: createWebSocketEventHandlerExecutionServices(services),
  marketDataServices: createWebSocketEventHandlerMarketDataServices(services),
  orderbookImbalanceService: services.orderbookImbalanceService,
  advancedOrderFlowService: services.advancedOrderFlowService,
  deltaAnalyzerService: services.deltaAnalyzerService,
  strategyOrchestrator: services.strategyOrchestrator,
});

const createWebSocketEventHandlerExecutionServices = (
  services: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerExecutionServices => ({
  positionManager: services.executionServices.positionManager,
  positionMonitor: services.executionServices.positionMonitor,
  tradingOrchestrator: services.executionServices.tradingOrchestrator,
});

const createWebSocketEventHandlerMarketDataServices = (
  services: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerMarketDataServices => ({
  candleProvider: services.marketDataServices.candleProvider,
  orderbookManager: services.marketDataServices.orderbookManager,
  publicWebSocket: services.marketDataServices.publicWebSocket,
  webSocketManager: services.marketDataServices.webSocketManager,
});

export const createTradingBotRuntimeDependencies = (
  services: IBotRuntimeSource,
): ITradingBotRuntimeDependencies => {
  return {
    tradingBotServices: createTradingBotServices(services),
    webApiServices: createWebApiReadServices(selectWebApiReadServices(services)),
    initializerServices: createBotInitializerServices(services),
    eventHandlerServices: createWebSocketEventHandlerServices(services),
  };
};
