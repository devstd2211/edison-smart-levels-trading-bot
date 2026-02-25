import type { Candle } from '../types/core';
import { TimeframeRole } from '../types/enums';
import type {
  WebApiFundingRateView,
  WebApiIndicatorPreferences,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiOrderbookLevel,
  WebApiOrderbookSnapshot,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '../types/web-api';
import type { IWebApiLogger, IWebApiReadServices } from '../interfaces';

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
export class BotWebAPI {
  private readonly logger: IWebApiLogger;

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
      const candles = await this.services.webApiServices.marketDataServices.candleProvider.getCandles(
        TimeframeRole.PRIMARY,
        2,
      );

      const last = candles[candles.length - 1];
      const prev = candles.length > 1 ? candles[candles.length - 2] : undefined;

      let currentPrice = last?.close ?? 0;
      let priceChangePercent = 0;

      if (prev && prev.close !== 0) {
        priceChangePercent = ((currentPrice - prev.close) / prev.close) * 100;
      }

      if (!currentPrice && this.services.webApiServices.bybitService.getCurrentPrice) {
        currentPrice = await this.services.webApiServices.bybitService.getCurrentPrice();
      }

      const indicatorCache = this.services.webApiServices.marketDataServices.indicatorCache;
      const preferences = this.getIndicatorPreferences();
      const timeframes = preferences.timeframes ?? ['1h', '4h'];
      const rsiPeriods = preferences.rsiPeriods ?? [14];
      const emaPeriods = preferences.emaPeriods ?? [20, 50];
      const atrPeriods = preferences.atrPeriods ?? [14];

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
      return {
        currentPrice: 0,
        priceChangePercent: 0,
      };
    }
  }

  private getCachedIndicator(
    cache: IWebApiReadServices['webApiServices']['marketDataServices']['indicatorCache'],
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

  private getIndicatorPreferences(): WebApiIndicatorPreferences {
    return this.services.webApiServices.indicatorPreferences ?? {};
  }

  /**
   * Get candlestick data for web chart
   * @param timeframeStr - Timeframe as string (e.g., '5m', '15m')
   * @param limit - Maximum number of candles to return
   */
  async getCandles(timeframeStr: string, limit: number = 100): Promise<Candle[]> {
    try {
      // Map interval strings to TimeframeRole
      const timeframeMap: Record<string, TimeframeRole> = {
        '1m': TimeframeRole.ENTRY,
        '5m': TimeframeRole.PRIMARY,
        '15m': TimeframeRole.TREND1,
        '30m': TimeframeRole.TREND2,
        '60m': TimeframeRole.CONTEXT,
        '1h': TimeframeRole.CONTEXT,
      };

      const role = timeframeMap[timeframeStr] || TimeframeRole.PRIMARY;
      const candles = await this.services.webApiServices.marketDataServices.candleProvider.getCandles(
        role,
        limit,
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
      // Get closed trades from trading journal
      const closedTrades = this.services.webApiServices.journal.getClosedTrades();

      // Convert to position history format for web interface
      // Return most recent trades first
      const positions = closedTrades
        .slice(-limit) // Get last N trades
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
        this.services.webApiServices.marketDataServices.orderbookManager.getSnapshot();

      if (!snapshot) {
        this.logger.warn('Orderbook not available yet', { symbol });
        return {
          symbol,
          bids: [],
          asks: [],
          timestamp: Date.now(),
        };
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
      return {
        symbol,
        bids: [],
        asks: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get detected whale walls (large orders)
   * @param symbol - Trading pair symbol
   */
  async getWalls(symbol: string): Promise<WebApiWallsView> {
    try {
      // Check if wall tracker exists
      if (!this.services.wallTrackerService) {
        this.logger.warn('Wall tracker not initialized', { symbol });
        return { symbol, walls: [] };
      }

      // Get active walls from wall tracker
      const activeWalls = this.services.wallTrackerService.getActiveWalls();

      return {
        symbol,
        walls: activeWalls.map((wall) => ({
          side: wall.side,
          price: wall.price,
          quantity: wall.currentSize,
          strength: this.services.wallTrackerService!.getWallStrength(wall.price, wall.side),
          detected: true,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting walls', { error, symbol });
      return { symbol, walls: [] };
    }
  }

  /**
   * Get current and predicted funding rate
   * @param symbol - Trading pair symbol
   */
  async getFundingRate(symbol: string): Promise<WebApiFundingRateView> {
    try {
      // Try to get from Bybit API
      // IExchange.getFundingRate() returns number or is optional
      const fundingRate = this.services.webApiServices.bybitService.getFundingRate
        ? await this.services.webApiServices.bybitService.getFundingRate(symbol)
        : 0;

      // fundingRate is a number (current funding rate percentage)
      return {
        symbol,
        current: fundingRate || 0,
        predicted: fundingRate || 0, // Predicted same as current (Bybit doesn't provide predicted)
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 hours from now (Bybit funds every 8h)
        lastFundingTime: Date.now(),
      };
    } catch (error) {
      this.logger.error('Error getting funding rate', { error, symbol });
      return {
        symbol,
        current: 0,
        predicted: 0,
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
        lastFundingTime: Date.now(),
      };
    }
  }

  /**
   * Get volume profile (price levels vs volume distribution)
   * @param symbol - Trading pair symbol
   * @param levels - Number of price levels to analyze
   */
  async getVolumeProfile(symbol: string, levels: number = 20): Promise<WebApiVolumeProfileView> {
    try {
      // Get candles and analyze volume distribution
      const candles = await this.services.webApiServices.marketDataServices.candleProvider.getCandles(
        TimeframeRole.PRIMARY,
        100,
      );

      if (candles.length === 0) {
        return { symbol, levels: [], volumes: [], maxVolume: 0 };
      }

      // Create price level buckets
      const minPrice = Math.min(...candles.map((c) => c.low));
      const maxPrice = Math.max(...candles.map((c) => c.high));
      const priceRange = maxPrice - minPrice;
      const bucketSize = priceRange / levels;

      // Aggregate volume by price level
      const volumeBuckets = new Array(levels).fill(0);

      for (const candle of candles) {
        const volume = candle.volume || 0;
        // Distribute volume across price levels where candle occurred
        const lowBucket = Math.max(0, Math.floor((candle.low - minPrice) / bucketSize));
        const highBucket = Math.min(levels - 1, Math.floor((candle.high - minPrice) / bucketSize));

        for (let i = lowBucket; i <= highBucket; i++) {
          volumeBuckets[i] += volume / (highBucket - lowBucket + 1);
        }
      }

      const maxVolume = Math.max(...volumeBuckets, 1);
      const profileLevels = Array.from({ length: levels }, (_, i) => ({
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
      return { symbol, levels: [], volumes: [], maxVolume: 0 };
    }
  }
}
