/**
 * IWebApiServicesContainer
 *
 * Grouped web API services (MarketData + Journal + Bybit).
 */

import type { IMarketDataServices } from './IMarketDataServices';
import type { TradeRecord } from '../types';
import type { IExchange } from './IExchange';

export interface IWebApiServicesContainer {
  marketDataServices: Pick<IMarketDataServices, 'candleProvider' | 'orderbookManager'>;
  journal: {
    getClosedTrades(): TradeRecord[];
  };
  bybitService: IExchange;
}
