/**
 * IBotRuntimeDependencySources
 *
 * Narrow source contracts for adapting grouped service state into the
 * runtime dependencies consumed by TradingBot lifecycle collaborators.
 */

import type { IBotServicesAdapterSource } from './IBotServicesAdapterSource';

export type ITradingBotAdapterSource = Pick<
  IBotServicesAdapterSource,
  'coreServices' | 'monitoringServices' | 'executionServices' | 'webApiReadServices'
>;

export type IBotInitializerAdapterSource = Pick<
  IBotServicesAdapterSource,
  | 'coreServices'
  | 'monitoringServices'
  | 'marketDataServices'
  | 'executionServices'
  | 'journal'
  | 'sessionStats'
  | 'btcCandles1m'
  | 'exchangeFactory'
  | 'rateLimiter'
  | 'retryPolicy'
  | 'bulkhead'
>;

export type IWebSocketEventHandlerAdapterSource = Pick<
  IBotServicesAdapterSource,
  | 'logger'
  | 'eventHandlerServices'
  | 'executionServices'
  | 'marketDataServices'
  | 'orderbookImbalanceService'
  | 'advancedOrderFlowService'
  | 'deltaAnalyzerService'
  | 'strategyOrchestrator'
>;

export type ITradingBotRuntimeDependencySource =
  ITradingBotAdapterSource &
  IBotInitializerAdapterSource &
  IWebSocketEventHandlerAdapterSource &
  Pick<IBotServicesAdapterSource, 'wallTrackerService' | 'webApiServices'>;

/**
 * Public factory/runtime service contract.
 *
 * Keeps external callers on the narrowed runtime dependency surface instead of
 * the broader adapter-source state used internally while building services.
 */
export type IBotFactoryServiceSource = ITradingBotRuntimeDependencySource;
