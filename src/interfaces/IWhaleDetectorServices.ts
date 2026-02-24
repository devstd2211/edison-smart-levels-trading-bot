/**
 * IWhaleDetectorServices
 *
 * Narrow interface for RealTimeWhaleDetector dependencies.
 */

import type { LoggerService, OrderBook } from '../types';

export interface IWhaleDetectorServices {
  logger: LoggerService;
  tradingOrchestrator: {
    checkWhaleSignalRealtime(orderbookSnapshot: OrderBook): Promise<void>;
  };
}
