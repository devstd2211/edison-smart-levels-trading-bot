/**
 * IBotRuntimeDependencySources
 *
 * Narrow source contracts for adapting grouped service state into the
 * runtime dependencies consumed by TradingBot lifecycle collaborators.
 */

import type { Candle, Config } from '../types/legacy';
import type { StrategyOrchestratorService } from '../services/multi-strategy/strategy-orchestrator.service';
import type { AdvancedOrderFlowService } from '../services/advanced-order-flow.service';
import type { DeltaAnalyzerService } from '../services/delta-analyzer.service';
import type { OrderbookImbalanceService } from '../services/orderbook-imbalance.service';
import type { BulkheadService } from '../services/resilience/bulkhead.service';
import type { RateLimiterService } from '../services/resilience/rate-limiter.service';
import type { RetryPolicyService } from '../services/resilience/retry-policy.service';
import type { ICoreServices } from './ICoreServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type { IExchange } from './IExchange';
import type { IExecutionServices } from './IExecutionServices';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IWebApiWallTracker } from './IWebApiServices';
import type { IWebApiServicesContainer } from './IWebApiServicesContainer';

export interface ITradingBotAdapterSource {
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<
    IExecutionServices,
    'positionManager' | 'positionMonitor' | 'tradingOrchestrator'
  >;
}

export interface IBotInitializerAdapterSource {
  coreServices: ICoreServices;
  monitoringServices?: IMonitoringReadServices;
  marketDataServices: Pick<
    IMarketDataServices,
    'bybitService' | 'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
  >;
  bybitService: Pick<
    IMarketDataServices['bybitService'],
    'initialize' | 'resyncTime' | 'cancelAllConditionalOrders' | 'getOpenPositions' | 'getCandles'
  > & IExchange;
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
  btcCandles1m: Candle[];
  exchangeFactory?: {
    createExchange(): Promise<IExchange>;
  };
  rateLimiter?: RateLimiterService;
  retryPolicy?: RetryPolicyService;
  bulkhead?: BulkheadService;
}

export interface IWebSocketEventHandlerAdapterSource {
  coreServices: Pick<ICoreServices, 'logger'>;
  eventHandlerServices: IEventHandlerServices;
  executionServices: Pick<
    IExecutionServices,
    'positionManager' | 'positionMonitor' | 'tradingOrchestrator'
  >;
  marketDataServices: Pick<
    IMarketDataServices,
    'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
  >;
  orderbookImbalanceService?: OrderbookImbalanceService;
  advancedOrderFlowService?: AdvancedOrderFlowService;
  deltaAnalyzerService?: DeltaAnalyzerService;
  strategyOrchestrator?: StrategyOrchestratorService;
}

export type ITradingBotRuntimeDependencySource =
  ITradingBotAdapterSource &
  IBotInitializerAdapterSource &
  IWebSocketEventHandlerAdapterSource &
  {
    webApiServices: IWebApiServicesContainer;
    wallTrackerService?: IWebApiWallTracker;
  };

/**
 * Public factory/runtime service contract.
 *
 * Keeps external callers on the narrowed runtime dependency surface instead of
 * the broader adapter-source state used internally while building services.
 */
export type IBotFactoryServiceSource = ITradingBotRuntimeDependencySource;
