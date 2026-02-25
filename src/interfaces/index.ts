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
  IBotServices,
} from './IServices';

export type {
  IWebApiLogger,
  IWebApiReadServices,
  IWebApiServices,
  IWebApiWallTracker,
} from './IWebApiServices';
export type { IWebSocketEventHandlerServices } from './IWebSocketEventHandlerServices';
export type { IWhaleDetectorServices } from './IWhaleDetectorServices';
export type { IBotInitializerServices } from './IBotInitializerServices';
export type { ITradingBotServices } from './ITradingBotServices';
export type { IMarketDataServices } from './IMarketDataServices';
export type { IExecutionServices } from './IExecutionServices';
export type { IMonitoringReadServices, IMonitoringServices } from './IMonitoringServices';
export type { IMonitoringHealthReader, IMonitoringMetricsReader } from './IMonitoringReaders';
export type { IMonitoringMetricsRecorder } from './IMonitoringRecorders';
export type { IRiskServices } from './IRiskServices';
export type { IWebApiServicesContainer } from './IWebApiServicesContainer';
export type { ICoreServices } from './ICoreServices';
export type { IEventHandlerServices } from './IEventHandlerServices';
