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

export interface IBotInitializerServices {
  coreServices: ICoreServices;
  monitoringServices?: IMonitoringReadServices;
  resilienceServices?: {
    rateLimiter?: ILifecycle;
    retryPolicy?: ILifecycle;
    bulkhead?: ILifecycle;
  };
  marketDataServices: Pick<IMarketDataServices, 'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager' | 'bybitService'>;
  exchangeRuntime: IBotInitializerExchangeRuntime;
  executionServices: Pick<
    IExecutionServices,
    'positionMonitor' | 'positionManager' | 'positionExitingService' | 'tradingOrchestrator' | 'orderStateMachine'
  >;
  journal: {
    start(): void;
  };
  sessionStats: {
    start(): void;
    startSession(config: Config, symbol: string): string;
    endSession(): void;
  };
  btcMarketState: IBotInitializerBtcMarketState;
  exchangeFactory?: {
    createExchange(): Promise<IExchange>;
  };
}
