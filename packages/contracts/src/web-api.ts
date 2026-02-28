/**
 * Web API contracts
 */

export interface WebApiOrderbookLevel {
  price: number;
  size: number;
}

export interface WebApiOrderbookSnapshot {
  bids: WebApiOrderbookLevel[];
  asks: WebApiOrderbookLevel[];
  timestamp: number;
  updateId: number;
}

export interface WebApiMarketData {
  currentPrice: number;
  priceChangePercent: number;
  rsi?: number;
  ema20?: number;
  ema50?: number;
  atr?: number;
  trend?: string;
  btcCorrelation?: number;
  nearestLevel?: number;
  distanceToLevel?: number;
}

export interface WebApiCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp: number;
}

export interface WebApiPositionHistoryEntry {
  id?: string | number;
  symbol?: string;
  side: string;
  entryPrice: number;
  entryTime: number;
  exitPrice?: number;
  exitTime?: number;
  pnl: number;
  quantity: number;
  leverage?: number;
  status?: string;
  entryCondition?: string;
  exitCondition?: string;
}

export interface WebApiOrderBookView {
  symbol: string;
  bids: Array<{ price: number; quantity: number; cumulative: number }>;
  asks: Array<{ price: number; quantity: number; cumulative: number }>;
  timestamp: number;
}

export interface WebApiWallView {
  side: string;
  price: number;
  quantity: number;
  strength: number;
  detected: boolean;
}

export interface WebApiWallsView {
  symbol: string;
  walls: WebApiWallView[];
}

export interface WebApiFundingRateView {
  symbol: string;
  current: number;
  predicted: number;
  nextFundingTime: number;
  lastFundingTime: number;
}

export interface WebApiVolumeProfileView {
  symbol: string;
  levels: string[];
  volumes: number[];
  maxVolume: number;
}

export interface WebApiCandlesResponse {
  candles: WebApiCandle[];
}

export interface WebApiPositionsResponse {
  positions: WebApiPositionHistoryEntry[];
}

export interface WebApiIndicatorPreferences {
  timeframes?: string[];
  rsiPeriods?: number[];
  emaPeriods?: number[];
  atrPeriods?: number[];
}

export interface WebApiConfig {
  indicatorPreferences?: WebApiIndicatorPreferences;
}
