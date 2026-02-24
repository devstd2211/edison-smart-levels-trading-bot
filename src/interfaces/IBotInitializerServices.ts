/**
 * IBotInitializerServices
 *
 * Narrow interface for BotInitializer dependencies.
 */

import type { LoggerService, Config, Position, Candle } from '../types';
import type { IExchange } from './IExchange';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';

export interface IBotInitializerServices {
  coreServices: ICoreServices;
  publicWebSocket: {
    connect(): void;
    disconnect(): void;
    removeAllListeners(): void;
  };
  marketDataServices: Pick<IMarketDataServices, 'candleProvider' | 'publicWebSocket' | 'webSocketManager' | 'bybitService'>;
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
