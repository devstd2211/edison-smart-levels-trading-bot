/**
 * BotServicesAdapter
 *
 * Maps the full BotServices container into the narrow bundles used by
 * TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { TradingBotServiceBundle } from '../bot';
import type { BotServices } from './bot-services';

export const createTradingBotServiceBundle = (
  services: BotServices,
): TradingBotServiceBundle => ({
  // IWebApiReadServices
  logger: services.logger,
  webApiServices: services.webApiServices,
  wallTrackerService: services.wallTrackerService,

  // ITradingBotServices
  coreServices: services.coreServices,
  positionMonitor: services.positionMonitor,
  monitoringServices: services.monitoringServices,
  executionServices: services.executionServices,

  // IBotInitializerServices
  publicWebSocket: services.publicWebSocket,
  marketDataServices: services.marketDataServices,
  positionManager: services.positionManager,
  sessionStats: services.sessionStats,
  candleProvider: services.candleProvider,
  btcCandles1m: services.btcCandles1m,
  exchangeFactory: services.exchangeFactory,

  // IWebSocketEventHandlerServices
  eventHandlerServices: services.eventHandlerServices,
  orderbookImbalanceService: services.orderbookImbalanceService,
  advancedOrderFlowService: services.advancedOrderFlowService,
  deltaAnalyzerService: services.deltaAnalyzerService,
  tradingOrchestrator: services.tradingOrchestrator,
  strategyOrchestrator: services.strategyOrchestrator,
});
