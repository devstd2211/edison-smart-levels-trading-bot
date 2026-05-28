/**
 * Runtime source contracts
 *
 * Narrow source contracts for adapting grouped runtime sources into the
 * runtime dependencies consumed by TradingBot lifecycle collaborators.
 */

import type { StrategyOrchestratorService } from '../services/multi-strategy/strategy-orchestrator.service';
import type { AdvancedOrderFlowService } from '../services/advanced-order-flow.service';
import type { DeltaAnalyzerService } from '../services/delta-analyzer.service';
import type { OrderbookImbalanceService } from '../services/orderbook-imbalance.service';
import type { BulkheadService } from '../services/resilience/bulkhead.service';
import type { RateLimiterService } from '../services/resilience/rate-limiter.service';
import type { RetryPolicyService } from '../services/resilience/retry-policy.service';
import type {
  BotInitializerExchangeService,
  IBotInitializerBtcMarketState,
  IBotInitializerExchangeFactory,
  IBotInitializerExecutionServices,
  IBotInitializerJournal,
  IBotInitializerMarketDataServices,
  IBotInitializerResilienceServices,
  IBotInitializerSessionStats,
} from './IBotInitializerServices';
import type { ICoreServices } from './ICoreServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { ITradingBotExecutionServices } from './ITradingBotServices';
import type { IWebApiWallTracker } from './IWebApiServices';
import type { IWebApiServicesContainer } from './IWebApiServicesContainer';
import type {
  IWebSocketEventHandlerExecutionServices,
  IWebSocketEventHandlerMarketDataServices,
} from './IWebSocketEventHandlerServices';

export interface ITradingBotRuntimeSource {
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: ITradingBotExecutionServices;
}

export interface IBotInitializerRuntimeSource {
  coreServices: ICoreServices;
  monitoringServices?: IMonitoringReadServices;
  marketDataServices: IBotInitializerMarketDataServices;
  bybitService: BotInitializerExchangeService;
  executionServices: IBotInitializerExecutionServices;
  journal: IBotInitializerJournal;
  sessionStats: IBotInitializerSessionStats;
  btcMarketState?: IBotInitializerBtcMarketState;
  btcCandles1m?: IBotInitializerBtcMarketState['btcCandles1m'];
  exchangeFactory?: IBotInitializerExchangeFactory;
  resilienceServices?: IBotInitializerResilienceServices;
  rateLimiter?: RateLimiterService;
  retryPolicy?: RetryPolicyService;
  bulkhead?: BulkheadService;
}

export interface IWebSocketEventHandlerRuntimeSource {
  coreServices: Pick<ICoreServices, 'logger'>;
  eventHandlerServices: IEventHandlerServices;
  executionServices: IWebSocketEventHandlerExecutionServices;
  marketDataServices: IWebSocketEventHandlerMarketDataServices;
  orderbookImbalanceService?: OrderbookImbalanceService;
  advancedOrderFlowService?: AdvancedOrderFlowService;
  deltaAnalyzerService?: DeltaAnalyzerService;
  strategyOrchestrator?: StrategyOrchestratorService;
}

export type IBotRuntimeSource =
  ITradingBotRuntimeSource &
  IBotInitializerRuntimeSource &
  IWebSocketEventHandlerRuntimeSource &
  {
    webApiServices: IWebApiServicesContainer;
    wallTrackerService?: IWebApiWallTracker;
  };

/**
 * Public factory/runtime service contract.
 *
 * Keeps external callers on the narrowed runtime dependency surface instead of
 * the broader builder state used internally while assembling services.
 */
export type IBotFactoryRuntimeSource = IBotRuntimeSource;
