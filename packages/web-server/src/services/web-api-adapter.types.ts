import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';

export interface IWebApiAdapter {
  getMarketData(): Promise<WebApiMarketData>;
  getCandles(timeframe: string, limit: number): Promise<WebApiCandle[]>;
  getPositionHistory(limit: number): Promise<WebApiPositionHistoryEntry[]>;
  getOrderBook(symbol: string): Promise<WebApiOrderBookView>;
  getWalls(symbol: string): Promise<WebApiWallsView>;
  getFundingRate(symbol: string): Promise<WebApiFundingRateView>;
  getVolumeProfile(symbol: string, levels: number): Promise<WebApiVolumeProfileView>;
}
