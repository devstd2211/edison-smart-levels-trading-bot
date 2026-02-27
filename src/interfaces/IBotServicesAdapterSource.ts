/**
 * IBotServicesAdapterSource
 *
 * Narrow input contract for BotServicesAdapter.
 * Avoids coupling to the concrete services class.
 */

import type { Candle, Config } from '../types/legacy';
import type { Position } from '../types/position';
import type { ICoreServices } from './ICoreServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type { IExchange } from './IExchange';
import type { TradingOrchestrator } from '../services/trading-orchestrator.service';
import type { StrategyOrchestratorService } from '../services/multi-strategy/strategy-orchestrator.service';
import type { OrderbookImbalanceService } from '../services/orderbook-imbalance.service';
import type { AdvancedOrderFlowService } from '../services/advanced-order-flow.service';
import type { DeltaAnalyzerService } from '../services/delta-analyzer.service';
import type { LoggerService } from '../services/logger.service';
import type { IWebApiServicesContainer } from './IWebApiServicesContainer';
import type { IWebApiWallTracker } from './IWebApiServices';

export interface IBotServicesAdapterSource {
  logger: LoggerService;
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<
    IExecutionServices,
    'positionManager' | 'tradingOrchestrator' | 'positionMonitor' | 'positionExitingService'
  >;
  marketDataServices: Pick<
    IMarketDataServices,
    'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager' | 'bybitService'
  >;
  publicWebSocket: {
    connect(): void;
    disconnect(): void;
    removeAllListeners(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener?: (...args: unknown[]) => void): void;
    setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void;
  };
  positionMonitor: {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  positionManager: {
    syncWithWebSocket(position?: Position): void;
    getCurrentPosition(): Position | null;
  };
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
  webApiServices: IWebApiServicesContainer;
  wallTrackerService?: IWebApiWallTracker;
  eventHandlerServices: IEventHandlerServices;
  orderbookImbalanceService?: OrderbookImbalanceService;
  advancedOrderFlowService?: AdvancedOrderFlowService;
  deltaAnalyzerService?: DeltaAnalyzerService;
  tradingOrchestrator: TradingOrchestrator;
  strategyOrchestrator?: StrategyOrchestratorService;
}
