/**
 * MarketDataServices
 *
 * Grouped container for market data dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type {
  IMarketDataServiceContainerDeps,
  IMarketDataServices,
} from '../../interfaces/IMarketDataServices';
import type { IExchange } from '../../interfaces/IExchange';

export class MarketDataServices implements IMarketDataServices {
  readonly bybitService: IExchange;
  readonly timeframeProvider: IMarketDataServices['timeframeProvider'];
  readonly candleProvider: IMarketDataServices['candleProvider'];
  readonly orderbookManager: IMarketDataServices['orderbookManager'];
  readonly publicWebSocket: IMarketDataServices['publicWebSocket'];
  readonly webSocketManager: IMarketDataServices['webSocketManager'];
  readonly indicatorCache: IMarketDataServices['indicatorCache'];
  readonly indicatorPreCalc: IMarketDataServices['indicatorPreCalc'];

  constructor(deps: IMarketDataServiceContainerDeps) {
    this.bybitService = deps.bybitService;
    this.timeframeProvider = deps.timeframeProvider;
    this.candleProvider = deps.candleProvider;
    this.orderbookManager = deps.orderbookManager;
    this.publicWebSocket = deps.publicWebSocket;
    this.webSocketManager = deps.webSocketManager;
    this.indicatorCache = deps.indicatorCache;
    this.indicatorPreCalc = deps.indicatorPreCalc;
  }
}

export const createMarketDataServices = (
  deps: IMarketDataServiceContainerDeps,
): IMarketDataServices => new MarketDataServices(deps);
