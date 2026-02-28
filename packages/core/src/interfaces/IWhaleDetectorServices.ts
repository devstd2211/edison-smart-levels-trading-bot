/**
 * IWhaleDetectorServices
 *
 * Narrow interface for RealTimeWhaleDetector dependencies.
 */

import type { LoggerService } from '../services/logger.service';
import type { OrderBook } from '../types/orderbook';

export interface IWhaleDetectorServices {
  logger: LoggerService;
  tradingOrchestrator: {
    checkWhaleSignalRealtime(orderbookSnapshot: OrderBook): Promise<void>;
  };
}
