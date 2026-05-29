/**
 * Interfaces Index
 * Re-exports all interfaces for easier importing
 */

// Exchange & Market Data
export type {
  IExchange,
  IExchangeMarketData,
  IExchangePositions,
  IExchangeOrders,
  IExchangeAccount,
  CandleParams,
  OpenPositionParams,
  PositionUpdateResult,
  UpdateStopLossParams,
  ActivateTrailingParams,
  ClosePositionParams,
  OrderParams,
  OrderResult,
  AccountBalance,
} from './IExchange';

export type { ICandleProvider } from './ICandleProvider';

export type { ITrendAnalyzer } from './ITrendAnalyzer';

// Persistence
export type {
  IRepository,
  TradeRecord,
  SessionRecord,
} from './IRepository';

// Analyzers & Signals
export type {
  ISignalGenerator,
  IAnalyzer,
} from './ISignalGenerator';

// Monitoring & Logging
export type {
  ILogger,
  IMonitoring,
  INotification,
} from './IMonitoring';

// Phase 5: Service Interfaces for DI Enhancement
export type {
  IPositionLifecycleService,
  IPositionExitingService,
  IPositionMonitorService,
  IWebSocketManagerService,
  IPublicWebSocketService,
  IOrderbookManagerService,
  IJournalService,
  ITelegramService,
  ITimeService,
  ITradingOrchestratorService,
} from './IServices';

export type {
  IBotWebApiRuntimeServices,
  IWebApiLogger,
  IWebApiReadServices,
  IWebApiWallTracker,
} from './IWebApiServices';
export type {
  IWebSocketEventHandlerExecutionServices,
  IWebSocketEventHandlerMarketDataServices,
  IWebSocketEventHandlerServices,
} from './IWebSocketEventHandlerServices';
export type { IWhaleDetectorServices } from './IWhaleDetectorServices';
export type {
  BotInitializerExchangeService,
  IBotInitializerBtcMarketState,
  IBotInitializerExchangeFactory,
  IBotInitializerExchangeRuntime,
  IBotInitializerExecutionServices,
  IBotInitializerJournal,
  IBotInitializerMarketDataServices,
  IBotInitializerResilienceServices,
  IBotInitializerSessionStats,
  IBotInitializerServices,
} from './IBotInitializerServices';
export type { ITradingBotExecutionServices, ITradingBotServices } from './ITradingBotServices';
export type {
  ITradingBotLifecycleDependencies,
  ITradingBotReadAdapters,
  ITradingBotRuntimeDependencies,
} from './ITradingBotRuntimeDependencies';
export type {
  IBotFactoryRuntimeSource,
  IBotInitializerRuntimeSource,
  IBotRuntimeSource,
  ITradingBotRuntimeSource,
  IWebSocketEventHandlerRuntimeSource,
} from './IRuntimeSources';
export type { ILifecycle } from './ILifecycle';
export type { IMarketDataServiceContainerDeps, IMarketDataServices } from './IMarketDataServices';
export type { IExecutionServiceContainerDeps, IExecutionServices } from './IExecutionServices';
export type {
  IMonitoringReadServices,
  IMonitoringServiceContainerDeps,
  IMonitoringServices,
} from './IMonitoringServices';
export type { IMonitoringHealthReader, IMonitoringMetricsReader } from './IMonitoringReaders';
export type { IMonitoringMetricsRecorder } from './IMonitoringRecorders';
export type { IRiskServiceContainerDeps, IRiskServices } from './IRiskServices';
export type { IWebApiServicesContainer } from './IWebApiServicesContainer';
export type { ICoreServices } from './ICoreServices';
export type { IEventHandlerServices } from './IEventHandlerServices';
