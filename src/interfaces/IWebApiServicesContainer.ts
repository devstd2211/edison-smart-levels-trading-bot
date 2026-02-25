/**
 * IWebApiServicesContainer
 *
 * Grouped web API services (MarketData + Journal + Bybit).
 */

import type { Candle } from '../types/core';
import type { TradeRecord } from '../types/journal';
import type { TimeframeRole } from '../types/enums';
import type { WebApiIndicatorPreferences, WebApiOrderbookSnapshot } from '../types/web-api';
import type { IExchange } from './IExchange';

export interface IWebApiCandleProvider {
  getCandles(role: TimeframeRole, limit: number): Promise<Candle[]>;
}

export interface IWebApiOrderbookManager {
  getSnapshot(): WebApiOrderbookSnapshot | null;
}

export interface IWebApiMarketDataServices {
  candleProvider: IWebApiCandleProvider;
  orderbookManager: IWebApiOrderbookManager;
  indicatorCache: IWebApiIndicatorCache;
}

export interface IWebApiJournalReader {
  getClosedTrades(): TradeRecord[];
}

export interface IWebApiIndicatorCache {
  get(key: string): number | null;
}

export interface IWebApiExchange {
  getFundingRate?: (symbol: string) => Promise<number>;
}

export interface IWebApiServicesContainer {
  marketDataServices: IWebApiMarketDataServices;
  journal: IWebApiJournalReader;
  bybitService: IExchange & IWebApiExchange;
  indicatorPreferences?: WebApiIndicatorPreferences;
}
