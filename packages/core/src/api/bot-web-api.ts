import type { Candle } from '../types/core';
import { TimeframeRole } from '../types/enums';
import { getDefaultWebApiIndicatorPreferences } from '../config/web-api-config';
import type {
  IWebApiAdapter,
  WebApiFundingRateView,
  WebApiIndicatorPreferences,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiOrderbookLevel,
  WebApiOrderbookSnapshot,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import type {
  IWebApiLogger,
  IWebApiReadServices,
  IWebApiWallTracker,
} from '../interfaces';

type NormalizedWebApiIndicatorPreferences = {
  timeframes: string[];
  rsiPeriods: number[];
  emaPeriods: number[];
  atrPeriods: number[];
};

/**
 * Bot Web API - Provides data access for web interface
 *
 * Responsibilities:
 * - Expose market data (candles, orderbook, walls, funding rates)
 * - Provide trade history
 * - Calculate volume profiles
 * - Format data for web consumption
 *
 * This separates web API concerns from core trading logic (TradingBot).
 * The web interface should only interact through this adapter.
 */
export class BotWebAPI implements IWebApiAdapter {
  private readonly logger: IWebApiLogger;
  private static readonly MARKET_DATA_TIMEFRAME = TimeframeRole.PRIMARY;
  private static readonly MARKET_DATA_SAMPLE_SIZE = 2;
  private static readonly VOLUME_PROFILE_CANDLE_LIMIT = 100;
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly DEFAULT_HISTORY_LIMIT = 50;
  private static readonly DEFAULT_VOLUME_PROFILE_LEVELS = 20;
  private static readonly FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;
  private static readonly DEFAULT_MARKET_DATA: WebApiMarketData = {
    currentPrice: 0,
    priceChangePercent: 0,
  };
  private static readonly TIMEFRAME_MAP: Record<string, TimeframeRole> = {
    '1m': TimeframeRole.ENTRY,
    '5m': TimeframeRole.PRIMARY,
    '15m': TimeframeRole.TREND1,
    '30m': TimeframeRole.TREND2,
    '60m': TimeframeRole.CONTEXT,
    '1h': TimeframeRole.CONTEXT,
  };

  constructor(private services: IWebApiReadServices) {
    this.logger = services.logger;
  }

  /**
   * Get current market data (price, indicators, trend)
   * Used by web interface to display live data
   */
  async getMarketData(): Promise<WebApiMarketData> {
    try {
      // Prefer cached candles (PRIMARY timeframe) to avoid hitting exchange APIs.
      const candles = await this.services.candleProvider.getCandles(
        BotWebAPI.MARKET_DATA_TIMEFRAME,
        BotWebAPI.MARKET_DATA_SAMPLE_SIZE,
      );

      const last = candles[candles.length - 1];
      const prev = candles.length > 1 ? candles[candles.length - 2] : undefined;

      let currentPrice = last?.close ?? 0;
      let priceChangePercent = 0;

      if (prev && prev.close !== 0) {
        priceChangePercent = ((currentPrice - prev.close) / prev.close) * 100;
      }

      if (!currentPrice && this.services.bybitService.getCurrentPrice) {
        currentPrice = await this.services.bybitService.getCurrentPrice();
      }

      const indicatorCache = this.services.indicatorCache;
      const preferences = this.getIndicatorPreferences();
      const { timeframes, rsiPeriods, emaPeriods, atrPeriods } = preferences;

      const rsi = this.getCachedIndicator(indicatorCache, 'RSI', rsiPeriods, timeframes);
      const ema20 = this.getCachedIndicator(indicatorCache, 'EMA', [20], timeframes) ??
        this.getCachedIndicator(indicatorCache, 'EMA', emaPeriods, timeframes);
      const ema50 = this.getCachedIndicator(indicatorCache, 'EMA', [50], timeframes) ??
        this.getCachedIndicator(indicatorCache, 'EMA', emaPeriods, timeframes);
      const atr = this.getCachedIndicator(indicatorCache, 'ATR', atrPeriods, timeframes);

      // Basic trend derived from price change until analyzers are exposed.
      const trend =
        priceChangePercent > 0 ? 'UP' : priceChangePercent < 0 ? 'DOWN' : 'NEUTRAL';

      return {
        currentPrice,
        priceChangePercent,
        rsi,
        ema20,
        ema50,
        atr,
        trend,
        btcCorrelation: undefined,
        nearestLevel: undefined,
        distanceToLevel: undefined,
      };
    } catch (error) {
      this.logger.error('Error getting market data', { error });
      return { ...BotWebAPI.DEFAULT_MARKET_DATA };
    }
  }

  private getCachedIndicator(
    cache: IWebApiReadServices['indicatorCache'],
    name: 'RSI' | 'EMA' | 'ATR',
    periods: number[],
    timeframes: string[],
  ): number | undefined {
    for (const period of periods) {
      for (const tf of timeframes) {
        const key = `${name}-${period}-${tf}`;
        const value = cache.get(key);
        if (value !== null && value !== undefined) {
          return value;
        }
      }
    }

    return undefined;
  }

  private getIndicatorPreferences(): NormalizedWebApiIndicatorPreferences {
    const defaults = getDefaultWebApiIndicatorPreferences();
    const preferences = this.services.indicatorPreferences;

    return {
      timeframes: preferences.timeframes ?? defaults.timeframes ?? ['1h', '4h'],
      rsiPeriods: preferences.rsiPeriods ?? defaults.rsiPeriods ?? [14],
      emaPeriods: preferences.emaPeriods ?? defaults.emaPeriods ?? [20, 50],
      atrPeriods: preferences.atrPeriods ?? defaults.atrPeriods ?? [14],
    };
  }

  private toTimeframeRole(timeframeStr: string): TimeframeRole {
    return BotWebAPI.TIMEFRAME_MAP[timeframeStr] || TimeframeRole.PRIMARY;
  }

  private normalizeVolumeProfileLevels(levels: number): number {
    return Number.isFinite(levels) && levels > 0
      ? Math.floor(levels)
      : BotWebAPI.DEFAULT_VOLUME_PROFILE_LEVELS;
  }

  private normalizeLimit(limit: number, fallback: number): number {
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : fallback;
  }

  private createEmptyOrderBook(symbol: string): WebApiOrderBookView {
    return {
      symbol,
      bids: [],
      asks: [],
      timestamp: Date.now(),
    };
  }

  private createEmptyWalls(symbol: string): WebApiWallsView {
    return { symbol, walls: [] };
  }

  private createFundingRateView(symbol: string, rate: number): WebApiFundingRateView {
    const timestamp = Date.now();
    return {
      symbol,
      current: rate,
      predicted: rate,
      nextFundingTime: timestamp + BotWebAPI.FUNDING_INTERVAL_MS,
      lastFundingTime: timestamp,
    };
  }

  private createEmptyVolumeProfile(symbol: string): WebApiVolumeProfileView {
    return { symbol, levels: [], volumes: [], maxVolume: 0 };
  }

  private getWallTrackerService(): IWebApiWallTracker | null {
    return this.services.wallTrackerService ?? null;
  }

  /**
   * Get candlestick data for web chart
   * @param timeframeStr - Timeframe as string (e.g., '5m', '15m')
   * @param limit - Maximum number of candles to return
   */
  async getCandles(timeframeStr: string, limit: number = 100): Promise<Candle[]> {
    try {
      const normalizedLimit = this.normalizeLimit(limit, BotWebAPI.DEFAULT_LIMIT);
      const candles = await this.services.candleProvider.getCandles(
        this.toTimeframeRole(timeframeStr),
        normalizedLimit,
      );
      return Array.from(candles);
    } catch (error) {
      this.logger.error('Error getting candles', { error, timeframeStr, limit });
      return [];
    }
  }

  /**
   * Get position history (closed positions from trading journal)
   */
  async getPositionHistory(limit: number = 50): Promise<WebApiPositionHistoryEntry[]> {
    try {
      const normalizedLimit = this.normalizeLimit(limit, BotWebAPI.DEFAULT_HISTORY_LIMIT);
      // Get closed trades from trading journal
      const closedTrades = this.services.journal.getClosedTrades();

      // Convert to position history format for web interface
      // Return most recent trades first
      const positions = closedTrades
        .slice(-normalizedLimit) // Get last N trades
        .reverse() // Reverse to show most recent first
        .map((trade) => {
          // Calculate PnL from entry/exit prices
          const pnl = trade.exitPrice
            ? trade.side === 'LONG'
              ? (trade.exitPrice - trade.entryPrice) * trade.quantity
              : (trade.entryPrice - trade.exitPrice) * trade.quantity
            : 0;

          return {
            id: trade.id,
            side: trade.side,
            entryPrice: trade.entryPrice,
            entryTime: trade.openedAt,
            exitPrice: trade.exitPrice,
            exitTime: trade.closedAt,
            pnl: pnl,
            quantity: trade.quantity,
            status: trade.status,
          };
        });

      return positions;
    } catch (error) {
      this.logger.error('Error getting position history', { error, limit });
      return [];
    }
  }

  /**
   * Get current orderbook snapshot for a symbol
   * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
   */
  async getOrderBook(symbol: string): Promise<WebApiOrderBookView> {
    try {
      // Use the orderbook manager to get current snapshot
      const snapshot: Readonly<WebApiOrderbookSnapshot> | null =
        this.services.orderbookManager.getSnapshot();

      if (!snapshot) {
        this.logger.warn('Orderbook not available yet', { symbol });
        return this.createEmptyOrderBook(symbol);
      }

      // Convert to web format with cumulative volumes
      const bids = snapshot.bids.map((level: WebApiOrderbookLevel, idx: number) => ({
        price: level.price,
        quantity: level.size,
        cumulative: snapshot.bids
          .slice(0, idx + 1)
          .reduce((sum: number, l: WebApiOrderbookLevel) => sum + l.size, 0),
      }));

      const asks = snapshot.asks.map((level: WebApiOrderbookLevel, idx: number) => ({
        price: level.price,
        quantity: level.size,
        cumulative: snapshot.asks
          .slice(0, idx + 1)
          .reduce((sum: number, l: WebApiOrderbookLevel) => sum + l.size, 0),
      }));

      return {
        symbol,
        bids,
        asks,
        timestamp: snapshot.timestamp,
      };
    } catch (error) {
      this.logger.error('Error getting orderbook', { error, symbol });
      return this.createEmptyOrderBook(symbol);
    }
  }

  /**
   * Get detected whale walls (large orders)
   * @param symbol - Trading pair symbol
   */
  async getWalls(symbol: string): Promise<WebApiWallsView> {
    try {
      const wallTrackerService = this.getWallTrackerService();
      if (!wallTrackerService) {
        this.logger.warn('Wall tracker not initialized', { symbol });
        return this.createEmptyWalls(symbol);
      }

      const activeWalls = wallTrackerService.getActiveWalls();

      return {
        symbol,
        walls: activeWalls.map((wall) => ({
          side: wall.side,
          price: wall.price,
          quantity: wall.currentSize,
          strength: wallTrackerService.getWallStrength(wall.price, wall.side),
          detected: true,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting walls', { error, symbol });
      return this.createEmptyWalls(symbol);
    }
  }

  /**
   * Get current and predicted funding rate
   * @param symbol - Trading pair symbol
   */
  async getFundingRate(symbol: string): Promise<WebApiFundingRateView> {
    try {
      const fundingRate = this.services.bybitService.getFundingRate
        ? await this.services.bybitService.getFundingRate(symbol)
        : 0;
      return this.createFundingRateView(symbol, fundingRate || 0);
    } catch (error) {
      this.logger.error('Error getting funding rate', { error, symbol });
      return this.createFundingRateView(symbol, 0);
    }
  }

  /**
   * Get volume profile (price levels vs volume distribution)
   * @param symbol - Trading pair symbol
   * @param levels - Number of price levels to analyze
   */
  async getVolumeProfile(symbol: string, levels: number = 20): Promise<WebApiVolumeProfileView> {
    try {
      const normalizedLevels = this.normalizeVolumeProfileLevels(levels);

      // Get candles and analyze volume distribution
      const candles = await this.services.candleProvider.getCandles(
        BotWebAPI.MARKET_DATA_TIMEFRAME,
        BotWebAPI.VOLUME_PROFILE_CANDLE_LIMIT,
      );

      if (candles.length === 0) {
        return this.createEmptyVolumeProfile(symbol);
      }

      // Create price level buckets
      const minPrice = Math.min(...candles.map((c) => c.low));
      const maxPrice = Math.max(...candles.map((c) => c.high));
      const priceRange = maxPrice - minPrice;
      const bucketSize = priceRange > 0 ? priceRange / normalizedLevels : 1;

      // Aggregate volume by price level
      const volumeBuckets = new Array(normalizedLevels).fill(0);

      for (const candle of candles) {
        const volume = candle.volume || 0;
        // Distribute volume across price levels where candle occurred
        const lowBucket = Math.max(0, Math.floor((candle.low - minPrice) / bucketSize));
        const highBucket = Math.min(
          normalizedLevels - 1,
          Math.floor((candle.high - minPrice) / bucketSize),
        );

        for (let i = lowBucket; i <= highBucket; i++) {
          volumeBuckets[i] += volume / (highBucket - lowBucket + 1);
        }
      }

      const maxVolume = Math.max(...volumeBuckets, 1);
      const profileLevels = Array.from({ length: normalizedLevels }, (_, i) => ({
        price: minPrice + i * bucketSize,
        volume: volumeBuckets[i],
      }));

      return {
        symbol,
        levels: profileLevels.map((l) => `$${l.price.toFixed(2)}`),
        volumes: profileLevels.map((l) => l.volume),
        maxVolume,
      };
    } catch (error) {
      this.logger.error('Error getting volume profile', { error, symbol, levels });
      return this.createEmptyVolumeProfile(symbol);
    }
  }
}
