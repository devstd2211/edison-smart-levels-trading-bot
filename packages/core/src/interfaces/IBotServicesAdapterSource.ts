/**
 * IBotServicesAdapterSource
 *
 * Narrow input contract for BotServicesAdapter.
 * Avoids coupling to the concrete services class.
 */

import type { Candle, Config } from '../types/legacy';
import type { ICoreServices } from './ICoreServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type { IExchange } from './IExchange';
import type { StrategyOrchestratorService } from '../services/multi-strategy/strategy-orchestrator.service';
import type { OrderbookImbalanceService } from '../services/orderbook-imbalance.service';
import type { AdvancedOrderFlowService } from '../services/advanced-order-flow.service';
import type { DeltaAnalyzerService } from '../services/delta-analyzer.service';
import type { LoggerService } from '../services/logger.service';
import type { IWebApiReadServices } from './IWebApiServices';
import type { IWebApiServicesContainer } from './IWebApiServicesContainer';
import type { IWebApiWallTracker } from './IWebApiServices';
import type { RateLimiterService } from '../services/resilience/rate-limiter.service';
import type { RetryPolicyService } from '../services/resilience/retry-policy.service';
import type { BulkheadService } from '../services/resilience/bulkhead.service';

export interface IBotServicesAdapterSource {
  logger: LoggerService;
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<
    IExecutionServices,
    'positionManager' | 'tradingOrchestrator' | 'positionMonitor' | 'positionExitingService' | 'orderStateMachine'
  >;
  marketDataServices: Pick<
    IMarketDataServices,
    'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager' | 'bybitService'
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
  webApiReadServices: IWebApiReadServices;
  webApiServices: IWebApiServicesContainer;
  wallTrackerService?: IWebApiWallTracker;
  eventHandlerServices: IEventHandlerServices;
  orderbookImbalanceService?: OrderbookImbalanceService;
  advancedOrderFlowService?: AdvancedOrderFlowService;
  deltaAnalyzerService?: DeltaAnalyzerService;
  strategyOrchestrator?: StrategyOrchestratorService;
  rateLimiter?: RateLimiterService;
  retryPolicy?: RetryPolicyService;
  bulkhead?: BulkheadService;
}
