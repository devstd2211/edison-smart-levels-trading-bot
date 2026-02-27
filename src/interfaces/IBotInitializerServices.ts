/**
 * IBotInitializerServices
 *
 * Narrow interface for BotInitializer dependencies.
 */

import type { Config } from '../types/legacy';
import type { Position } from '../types/position';
import type { Candle } from '../types/core';
import type { IExchange } from './IExchange';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { ILifecycle } from './ILifecycle';

export interface IBotInitializerServices {
  coreServices: ICoreServices;
  monitoringServices?: Pick<IMonitoringReadServices, 'monitoringServer' | 'metricsService' | 'dashboard'>;
  resilienceServices?: {
    rateLimiter?: ILifecycle;
    retryPolicy?: ILifecycle;
  };
  publicWebSocket: {
    connect(): void;
    disconnect(): void;
    removeAllListeners(): void;
  };
  marketDataServices: Pick<IMarketDataServices, 'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager' | 'bybitService'>;
  positionManager: {
    syncWithWebSocket(position?: Position): void;
    getCurrentPosition(): Position | null;
  };
  executionServices: Pick<IExecutionServices, 'positionMonitor' | 'positionManager' | 'positionExitingService' | 'tradingOrchestrator'>;
  sessionStats: {
    startSession(config: Config, symbol: string): string;
    endSession(): void;
  };
  candleProvider: {
    initialize(): Promise<void>;
  };
  btcCandles1m: Candle[];
  exchangeFactory?: {
    createExchange(): Promise<IExchange>;
  };
}
