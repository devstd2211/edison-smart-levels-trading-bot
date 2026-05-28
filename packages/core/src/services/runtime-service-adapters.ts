/**
 * Runtime dependency adapters
 *
 * Maps the full runtime source into the narrow runtime contracts used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type {
  BotInitializerExchangeService,
  IBotInitializerRuntimeSource,
  IBotInitializerMarketDataServices,
  IBotInitializerServices,
  IBotInitializerExchangeRuntime,
  IBotInitializerBtcMarketState,
  IBotInitializerResilienceServices,
  IBotRuntimeSource,
  ITradingBotExecutionServices,
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
  ITradingBotRuntimeSource,
  IWebSocketEventHandlerRuntimeSource,
  IWebSocketEventHandlerExecutionServices,
  IWebSocketEventHandlerMarketDataServices,
  IWebSocketEventHandlerServices,
} from '../interfaces';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type { IWebApiReadServices } from '../interfaces/IWebApiServices';
import { createWebApiAdapter } from '../api/create-web-api-adapter';
import { createMonitoringReadServices } from './containers/monitoring-services';
import { createWebApiReadServices, selectWebApiReadServices } from './containers/web-api-read-services';

export interface ITradingBotRuntimeDependencyParts {
  tradingBotServices: ITradingBotServices;
  balanceReader: ITradingBotRuntimeDependencies['balanceReader'];
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
  webApiReadServices: IWebApiReadServices;
}

const createTradingExecutionServices = (
  executionServices: ITradingBotExecutionServices,
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
  marketDataServices: IBotInitializerMarketDataServices,
): IWebSocketEventHandlerMarketDataServices => ({
  candleProvider: marketDataServices.candleProvider,
  orderbookManager: marketDataServices.orderbookManager,
  publicWebSocket: marketDataServices.publicWebSocket,
  webSocketManager: marketDataServices.webSocketManager,
});

const createExchangeRuntime = (
  exchange: BotInitializerExchangeService,
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
  runtimeSource: IBotInitializerRuntimeSource,
): IBotInitializerBtcMarketState => ({
  btcCandles1m: runtimeSource.btcMarketState?.btcCandles1m ?? runtimeSource.btcCandles1m ?? [],
});

const createInitializerMonitoringServices = (
  monitoringServices: IBotInitializerRuntimeSource['monitoringServices'],
): IBotInitializerServices['monitoringServices'] =>
  monitoringServices ? createMonitoringReadServices(monitoringServices) : undefined;

const createResilienceServices = (
  runtimeSource: IBotInitializerRuntimeSource,
): IBotInitializerServices['resilienceServices'] => {
  const resilienceServices: IBotInitializerResilienceServices | undefined =
    runtimeSource.resilienceServices
    ?? (
      runtimeSource.rateLimiter || runtimeSource.retryPolicy || runtimeSource.bulkhead
        ? {
            rateLimiter: runtimeSource.rateLimiter,
            retryPolicy: runtimeSource.retryPolicy,
            bulkhead: runtimeSource.bulkhead,
          }
        : undefined
    );

  if (!resilienceServices) {
    return undefined;
  }

  return resilienceServices;
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
  btcMarketState: createBtcMarketState(runtimeSource),
  exchangeFactory: runtimeSource.exchangeFactory,
  resilienceServices: createResilienceServices(runtimeSource),
});

export const createWebSocketEventHandlerServices = (
  runtimeSource: IWebSocketEventHandlerRuntimeSource,
): IWebSocketEventHandlerServices => ({
  coreServices: {
    logger: runtimeSource.coreServices.logger,
  },
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

export const createTradingBotRuntimeDependencyParts = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencyParts => ({
    tradingBotServices: createTradingBotServices(runtimeSource),
    balanceReader: runtimeSource.bybitService,
    initializerServices: createBotInitializerServices(runtimeSource),
    eventHandlerServices: createWebSocketEventHandlerServices(runtimeSource),
    webApiReadServices: createWebApiReadServices(selectWebApiReadServices(runtimeSource)),
});

export const createTradingBotRuntimeDependenciesFromParts = (
  parts: ITradingBotRuntimeDependencyParts,
): ITradingBotRuntimeDependencies => {
  const webApiAdapter: IWebApiAdapter = createWebApiAdapter(parts.webApiReadServices);

  return {
    tradingBotServices: parts.tradingBotServices,
    balanceReader: parts.balanceReader,
    initializerServices: parts.initializerServices,
    eventHandlerServices: parts.eventHandlerServices,
    webApiAdapter,
  };
};

export const createTradingBotRuntimeDependencies = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencies =>
  createTradingBotRuntimeDependenciesFromParts(
    createTradingBotRuntimeDependencyParts(runtimeSource),
  );
