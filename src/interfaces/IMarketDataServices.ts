/**
 * IMarketDataServices
 *
 * Grouped market data services.
 */

import type { CandleParams, IExchange } from './IExchange';
import type { Position, Candle } from '../types';
import type { TimeframeProvider } from '../providers/timeframe.provider';
import type { CandleProvider } from '../providers/candle.provider';
import type { OrderbookManagerService } from '../services/orderbook-manager.service';
import type { PublicWebSocketService } from '../services/public-websocket.service';
import type { WebSocketManagerService } from '../services/websocket-manager.service';
import type { IndicatorCacheService } from '../services/indicator-cache.service';
import type { IndicatorPreCalculationService } from '../services/indicator-precalculation.service';

export interface IMarketDataServices {
  bybitService: IExchange & {
    initialize?: () => Promise<void>;
    resyncTime?: () => Promise<void>;
    cancelAllConditionalOrders?: () => Promise<void>;
    getOpenPositions?: () => Promise<Position[]>;
    getCandles?: (params: CandleParams) => Promise<Candle[]>;
  };
  timeframeProvider: TimeframeProvider;
  candleProvider: CandleProvider;
  orderbookManager: OrderbookManagerService;
  publicWebSocket: PublicWebSocketService;
  webSocketManager: WebSocketManagerService;
  indicatorCache: IndicatorCacheService;
  indicatorPreCalc: IndicatorPreCalculationService;
}
