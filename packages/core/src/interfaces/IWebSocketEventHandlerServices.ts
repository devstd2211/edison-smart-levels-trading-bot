/**
 * IWebSocketEventHandlerServices
 *
 * Narrow interface for WebSocketEventHandlerManager dependencies.
 */

import type { Candle } from '../types/core';
import type { TimeframeRole } from '../types/enums';
import type { OrderBook } from '../types/orderbook';
import type { ImbalanceAnalysis } from '../types/legacy';
import type { IMarketDataServices } from './IMarketDataServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IEventHandlerServices } from './IEventHandlerServices';
import type {
  StopLossHitEvent,
  TakeProfitHitEvent,
  TimeBasedExitEvent,
  OrderFilledEvent,
  TakeProfitFilledEvent,
  StopLossFilledEvent,
  TradeTickEvent,
} from '../types/events';
import type { Position } from '../types/position';
import type { LoggerService } from '../services/logger.service';

export interface IWebSocketEventHandlerServices {
  logger: LoggerService;
  eventHandlerServices: IEventHandlerServices;
  executionServices: Pick<
    IExecutionServices,
    'positionExitingService' | 'positionManager' | 'positionMonitor' | 'tradingOrchestrator' | 'orderStateMachine'
  >;
  marketDataServices: Pick<
    IMarketDataServices,
    'bybitService' | 'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'
  >;
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
