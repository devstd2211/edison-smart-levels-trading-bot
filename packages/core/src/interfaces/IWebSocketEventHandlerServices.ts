/**
 * IWebSocketEventHandlerServices
 *
 * Narrow interface for WebSocketEventHandlerManager dependencies.
 */

import type { Candle } from '../types/core';
import type { TimeframeRole } from '../types/enums';
import type { ImbalanceAnalysis } from '../types/legacy';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type { LoggerService } from '../services/logger.service';

export type IWebSocketEventHandlerExecutionServices = Pick<
  IExecutionServices,
  'positionManager' | 'positionMonitor' | 'tradingOrchestrator'
>;

export type IWebSocketEventHandlerMarketDataServices = Pick<
  IMarketDataServices,
  'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
>;

export interface IWebSocketEventHandlerServices {
  logger: LoggerService;
  eventHandlerServices: IEventHandlerServices;
  executionServices: IWebSocketEventHandlerExecutionServices;
  marketDataServices: IWebSocketEventHandlerMarketDataServices;
  orderbookImbalanceService?: {
    analyze(input: { bids: [number, number][]; asks: [number, number][] }): ImbalanceAnalysis;
  };
  advancedOrderFlowService?: {
    processOrderbook(input: { bids: [number, number][]; asks: [number, number][] }): void;
    addTick(input: { timestamp: number; price: number; size: number; side: 'BUY' | 'SELL' }): void;
  };
  deltaAnalyzerService?: {
    addTick(input: { timestamp: number; price: number; quantity: number; side: 'BUY' | 'SELL' }): void;
  };
  strategyOrchestrator?: {
    onCandleClosed(role: TimeframeRole, candle: Candle): Promise<void>;
  };
}
