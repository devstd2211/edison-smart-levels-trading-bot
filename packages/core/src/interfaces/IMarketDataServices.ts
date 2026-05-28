/**
 * IMarketDataServices
 *
 * Grouped market data services.
 */

import type { CandleParams, IExchange } from './IExchange';
import type { Position } from '../types/position';
import type { Candle } from '../types/core';
import type { TimeframeProvider } from '../providers/timeframe.provider';
import type { CandleProvider } from '../providers/candle.provider';
import type { OrderbookManagerService } from '../services/orderbook-manager.service';
import type { PublicWebSocketService } from '../services/public-websocket.service';
import type { WebSocketManagerService } from '../services/websocket-manager.service';
import type { IndicatorCacheService } from '../services/indicator-cache.service';
import type { IndicatorPreCalculationService } from '../services/indicator-precalculation.service';

export interface IMarketDataServices {
  readonly bybitService: IExchange & {
    initialize?: () => Promise<void>;
    resyncTime?: () => Promise<void>;
    cancelAllConditionalOrders?: () => Promise<void>;
    getOpenPositions?: () => Promise<Position[]>;
    getCandles?: (params: CandleParams) => Promise<Candle[]>;
  };
  readonly timeframeProvider: TimeframeProvider;
  readonly candleProvider: CandleProvider;
  readonly orderbookManager: OrderbookManagerService;
  readonly publicWebSocket: PublicWebSocketService;
  readonly webSocketManager: WebSocketManagerService;
  readonly indicatorCache: IndicatorCacheService;
  readonly indicatorPreCalc: IndicatorPreCalculationService;
}

export type IMarketDataServiceContainerDeps = IMarketDataServices;
