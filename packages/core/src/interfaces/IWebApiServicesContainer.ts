/**
 * IWebApiServicesContainer
 *
 * Grouped web API services (MarketData + Journal + Bybit).
 */

import type { Candle } from '../types/core';
import type { TradeRecord } from '../types/journal/types';
import type { TimeframeRole } from '../types/enums';
import type { WebApiIndicatorPreferences, WebApiOrderbookSnapshot } from '@edison/contracts';
import type { AccountBalance } from './IExchange';

export interface IWebApiCandleProvider {
  getCandles(role: TimeframeRole, limit: number): Promise<ReadonlyArray<Candle>>;
}

export interface IWebApiOrderbookManager {
  getSnapshot(): Readonly<WebApiOrderbookSnapshot> | null;
}

export interface IWebApiMarketDataServices {
  readonly candleProvider: IWebApiCandleProvider;
  readonly orderbookManager: IWebApiOrderbookManager;
  readonly indicatorCache: IWebApiIndicatorCache;
}

export interface IWebApiJournalReader {
  getClosedTrades(): ReadonlyArray<TradeRecord>;
}

export interface IWebApiIndicatorCache {
  get(key: string): number | null;
}

export interface IWebApiExchange {
  getBalance(): Promise<AccountBalance>;
  getCurrentPrice?: () => Promise<number>;
  getFundingRate?: (symbol: string) => Promise<number>;
}

export interface IWebApiServicesContainer {
  readonly marketDataServices: IWebApiMarketDataServices;
  readonly journal: IWebApiJournalReader;
  readonly bybitService: IWebApiExchange;
  readonly indicatorPreferences: WebApiIndicatorPreferences;
}
