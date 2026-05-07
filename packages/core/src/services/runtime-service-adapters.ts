/**
 * Runtime dependency adapters
 *
 * Maps the full runtime source into the narrow runtime contracts used by
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
  runtimeSource: ITradingBotRuntimeSource,
): ITradingBotServices => ({
  coreServices: runtimeSource.coreServices,
  monitoringServices: createMonitoringReadServices(runtimeSource.monitoringServices),
  executionServices: {
    positionManager: runtimeSource.executionServices.positionManager,
    positionMonitor: runtimeSource.executionServices.positionMonitor,
    tradingOrchestrator: runtimeSource.executionServices.tradingOrchestrator,
  },
});

export const createBotInitializerServices = (
  runtimeSource: IBotInitializerRuntimeSource,
): IBotInitializerServices => {
  const exchangeRuntime = {
    current: runtimeSource.bybitService,
    setCurrent(exchange: IBotInitializerServices['exchangeRuntime']['current']) {
      exchangeRuntime.current = exchange;
    },
  };

  return {
    coreServices: runtimeSource.coreServices,
    monitoringServices: runtimeSource.monitoringServices,
    marketDataServices: {
      candleProvider: runtimeSource.marketDataServices.candleProvider,
      orderbookManager: runtimeSource.marketDataServices.orderbookManager,
      publicWebSocket: runtimeSource.marketDataServices.publicWebSocket,
      webSocketManager: runtimeSource.marketDataServices.webSocketManager,
    },
    exchangeRuntime,
    executionServices: runtimeSource.executionServices,
    journal: runtimeSource.journal,
    sessionStats: runtimeSource.sessionStats,
    btcMarketState: {
      btcCandles1m: runtimeSource.btcCandles1m,
    },
    exchangeFactory: runtimeSource.exchangeFactory,
    resilienceServices: {
      rateLimiter: runtimeSource.rateLimiter,
      retryPolicy: runtimeSource.retryPolicy,
      bulkhead: runtimeSource.bulkhead,
    },
  };
};

export const createWebSocketEventHandlerServices = (
  runtimeSource: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerServices => ({
  logger: runtimeSource.coreServices.logger,
  eventHandlerServices: runtimeSource.eventHandlerServices,
  executionServices: createWebSocketEventHandlerExecutionServices(runtimeSource),
  marketDataServices: createWebSocketEventHandlerMarketDataServices(runtimeSource),
  orderbookImbalanceService: runtimeSource.orderbookImbalanceService,
  advancedOrderFlowService: runtimeSource.advancedOrderFlowService,
  deltaAnalyzerService: runtimeSource.deltaAnalyzerService,
  strategyOrchestrator: runtimeSource.strategyOrchestrator,
});

const createWebSocketEventHandlerExecutionServices = (
  runtimeSource: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerExecutionServices => ({
  positionManager: runtimeSource.executionServices.positionManager,
  positionMonitor: runtimeSource.executionServices.positionMonitor,
  tradingOrchestrator: runtimeSource.executionServices.tradingOrchestrator,
});

const createWebSocketEventHandlerMarketDataServices = (
  runtimeSource: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerMarketDataServices => ({
  candleProvider: runtimeSource.marketDataServices.candleProvider,
  orderbookManager: runtimeSource.marketDataServices.orderbookManager,
  publicWebSocket: runtimeSource.marketDataServices.publicWebSocket,
  webSocketManager: runtimeSource.marketDataServices.webSocketManager,
});

export const createTradingBotRuntimeDependencies = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencies => {
  return {
    tradingBotServices: createTradingBotServices(runtimeSource),
    webApiServices: createWebApiReadServices(selectWebApiReadServices(runtimeSource)),
    initializerServices: createBotInitializerServices(runtimeSource),
    eventHandlerServices: createWebSocketEventHandlerServices(runtimeSource),
  };
};
