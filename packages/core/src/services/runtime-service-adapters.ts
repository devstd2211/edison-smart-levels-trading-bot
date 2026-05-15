/**
 * Runtime dependency adapters
 *
 * Maps the full runtime source into the narrow runtime contracts used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type {
  IBotInitializerRuntimeSource,
  IBotInitializerServices,
  IBotInitializerExchangeRuntime,
  IBotInitializerBtcMarketState,
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

const createTradingExecutionServices = (
  executionServices: ITradingBotRuntimeSource['executionServices'],
): ITradingBotServices['executionServices'] => ({
  positionManager: executionServices.positionManager,
  positionMonitor: executionServices.positionMonitor,
  tradingOrchestrator: executionServices.tradingOrchestrator,
});

const createInitializerExecutionServices = (
  executionServices: IBotInitializerRuntimeSource['executionServices'],
): IBotInitializerServices['executionServices'] => ({
  positionMonitor: executionServices.positionMonitor,
  positionManager: executionServices.positionManager,
  positionExitingService: executionServices.positionExitingService,
  tradingOrchestrator: executionServices.tradingOrchestrator,
  orderStateMachine: executionServices.orderStateMachine,
});

const createRuntimeMarketDataServices = (
  marketDataServices: Pick<
    IBotInitializerRuntimeSource['marketDataServices'],
    'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
  >,
): IWebSocketEventHandlerMarketDataServices => ({
  candleProvider: marketDataServices.candleProvider,
  orderbookManager: marketDataServices.orderbookManager,
  publicWebSocket: marketDataServices.publicWebSocket,
  webSocketManager: marketDataServices.webSocketManager,
});

const createExchangeRuntime = (
  exchange: IBotInitializerRuntimeSource['bybitService'],
): IBotInitializerExchangeRuntime => {
  const exchangeRuntime: IBotInitializerExchangeRuntime = {
    current: exchange,
    setCurrent(nextExchange: IBotInitializerExchangeRuntime['current']) {
      exchangeRuntime.current = nextExchange;
    },
  };

  return exchangeRuntime;
};

const createBtcMarketState = (
  btcCandles1m: IBotInitializerRuntimeSource['btcCandles1m'],
): IBotInitializerBtcMarketState => ({
  btcCandles1m,
});

const createInitializerMonitoringServices = (
  monitoringServices: IBotInitializerRuntimeSource['monitoringServices'],
): IBotInitializerServices['monitoringServices'] =>
  monitoringServices ? createMonitoringReadServices(monitoringServices) : undefined;

const createResilienceServices = (
  runtimeSource: IBotInitializerRuntimeSource,
): IBotInitializerServices['resilienceServices'] => {
  if (!runtimeSource.rateLimiter && !runtimeSource.retryPolicy && !runtimeSource.bulkhead) {
    return undefined;
  }

  return {
    rateLimiter: runtimeSource.rateLimiter,
    retryPolicy: runtimeSource.retryPolicy,
    bulkhead: runtimeSource.bulkhead,
  };
};

export const createTradingBotServices = (
  runtimeSource: ITradingBotRuntimeSource,
): ITradingBotServices => ({
  coreServices: runtimeSource.coreServices,
  monitoringServices: createMonitoringReadServices(runtimeSource.monitoringServices),
  executionServices: createTradingExecutionServices(runtimeSource.executionServices),
});

export const createBotInitializerServices = (
  runtimeSource: IBotInitializerRuntimeSource,
): IBotInitializerServices => ({
  coreServices: runtimeSource.coreServices,
  monitoringServices: createInitializerMonitoringServices(runtimeSource.monitoringServices),
  marketDataServices: createRuntimeMarketDataServices(runtimeSource.marketDataServices),
  exchangeRuntime: createExchangeRuntime(runtimeSource.bybitService),
  executionServices: createInitializerExecutionServices(runtimeSource.executionServices),
  journal: runtimeSource.journal,
  sessionStats: runtimeSource.sessionStats,
  btcMarketState: createBtcMarketState(runtimeSource.btcCandles1m),
  exchangeFactory: runtimeSource.exchangeFactory,
  resilienceServices: createResilienceServices(runtimeSource),
});

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
  ...createTradingExecutionServices(runtimeSource.executionServices),
});

const createWebSocketEventHandlerMarketDataServices = (
  runtimeSource: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerMarketDataServices =>
  createRuntimeMarketDataServices(runtimeSource.marketDataServices);

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
