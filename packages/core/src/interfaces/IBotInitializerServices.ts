/**
 * IBotInitializerServices
 *
 * Narrow interface for BotInitializer dependencies.
 */

import type { Config } from '../types/legacy';
import type { Candle } from '../types/core';
import type { IExchange } from './IExchange';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { ILifecycle } from './ILifecycle';

export type BotInitializerExchangeService = Pick<
  IMarketDataServices['bybitService'],
  'initialize' | 'resyncTime' | 'cancelAllConditionalOrders' | 'getOpenPositions' | 'getCandles'
> & IExchange;

export interface IBotInitializerExchangeRuntime {
  current: BotInitializerExchangeService;
  setCurrent(exchange: BotInitializerExchangeService): void;
}

export interface IBotInitializerBtcMarketState {
  btcCandles1m: Candle[];
}

export type IBotInitializerMarketDataServices = Pick<
  IMarketDataServices,
  'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
>;

export type IBotInitializerExecutionServices = Pick<
  IExecutionServices,
  'positionMonitor' | 'positionManager' | 'positionExitingService' | 'tradingOrchestrator' | 'orderStateMachine'
>;

export interface IBotInitializerJournal {
  start(): void;
}

export interface IBotInitializerSessionStats {
  start(): void;
  startSession(config: Config, symbol: string): string;
  endSession(): void;
}

export interface IBotInitializerExchangeFactory {
  createExchange(): Promise<IExchange>;
}

export interface IBotInitializerResilienceServices {
  rateLimiter?: ILifecycle;
  retryPolicy?: ILifecycle;
  bulkhead?: ILifecycle;
}

export interface IBotInitializerServices {
  coreServices: ICoreServices;
  monitoringServices?: IMonitoringReadServices;
  resilienceServices?: IBotInitializerResilienceServices;
  marketDataServices: IBotInitializerMarketDataServices;
  exchangeRuntime: IBotInitializerExchangeRuntime;
  executionServices: IBotInitializerExecutionServices;
  journal: IBotInitializerJournal;
  sessionStats: IBotInitializerSessionStats;
  btcMarketState: IBotInitializerBtcMarketState;
  exchangeFactory?: IBotInitializerExchangeFactory;
}
