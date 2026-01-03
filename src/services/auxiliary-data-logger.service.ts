import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Auxiliary Data Logger Service
 *
 * Logs OrderBook and Volume data for informational purposes.
 * Does NOT affect signal generation decisions - logging only!
 *
 * Extracted from SignalGeneratorService for better testability.
 */

import {
  SignalDirection,
  Config,
  TimeframeRole,
  LoggerService,
  OrderBookAnalyzer,
  VolumeAnalyzer,
} from '../types';
import { BybitService } from './bybit';
import { CandleProvider } from '../providers/candle.provider';

// ============================================================================
// AUXILIARY DATA LOGGER SERVICE
// ============================================================================

export class AuxiliaryDataLogger {
  private orderBookAnalyzer: OrderBookAnalyzer | null = null;
  private volumeAnalyzer: VolumeAnalyzer | null = null;

  constructor(
    private bybitService: BybitService,
    private candleProvider: CandleProvider,
    private config: Config,
    private logger: LoggerService,
  ) {
    // Initialize OrderBook analyzer if enabled
    if (this.config.orderBook?.enabled) {
      this.orderBookAnalyzer = new OrderBookAnalyzer(
        this.config.orderBook,
        this.logger,
      );
      this.logger.info('OrderBook logging enabled');
    }

    // Initialize Volume analyzer if enabled
    if (this.config.volume?.enabled) {
      this.volumeAnalyzer = new VolumeAnalyzer(
        this.config.volume,
        this.logger,
      );
      this.logger.info('Volume logging enabled');
    }
  }

  /**
   * Log OrderBook and Volume analysis (non-blocking)
   *
   * @param currentPrice - Current market price
   * @param direction - Signal direction
   */
  async logAnalysis(currentPrice: number, direction: SignalDirection): Promise<void> {
    // Skip if both analyzers disabled
    if (!this.orderBookAnalyzer && !this.volumeAnalyzer) {
      return;
    }

    try {
      // Log OrderBook if enabled
      if (this.orderBookAnalyzer && this.config.orderBook) {
        await this.logOrderBook(
          this.config.exchange.symbol,
          currentPrice,
          direction,
        );
      }

      // Log Volume if enabled
      if (this.volumeAnalyzer && this.config.volume) {
        await this.logVolume(currentPrice, direction);
      }
    } catch (error) {
      this.logger.warn('Failed to log auxiliary data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log OrderBook analysis
   *
   * @param symbol - Trading symbol
   * @param currentPrice - Current market price
   * @param direction - Signal direction
   */
  private async logOrderBook(
    symbol: string,
    currentPrice: number,
    direction: SignalDirection,
  ): Promise<void> {
    if (!this.orderBookAnalyzer || !this.config.orderBook) {
      return;
    }

    try {
      this.logger.debug('Fetching order book...');

      const orderBookData = await this.bybitService.getOrderBook(
        symbol,
        this.config.orderBook.depth,
      );

      const orderBookAnalysis = this.orderBookAnalyzer.analyze(
        {
          bids: orderBookData.bids,
          asks: orderBookData.asks,
          timestamp: orderBookData.timestamp,
        },
        currentPrice,
      );

      // Log summary
      const summary = this.orderBookAnalyzer.getSummary(orderBookAnalysis);
      this.logger.info('📊 OrderBook Analysis', { summary });

      // Log detailed analysis
      this.logger.debug('OrderBook details', {
        imbalance: {
          direction: orderBookAnalysis.imbalance.direction,
          ratio: orderBookAnalysis.imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT),
          strength: `${(orderBookAnalysis.imbalance.strength * PERCENT_MULTIPLIER).toFixed(0)}%`,
          bidVolume: orderBookAnalysis.imbalance.bidVolume.toFixed(DECIMAL_PLACES.PERCENT),
          askVolume: orderBookAnalysis.imbalance.askVolume.toFixed(DECIMAL_PLACES.PERCENT),
        },
        walls: orderBookAnalysis.walls.length,
        spread: `${orderBookAnalysis.spread.toFixed(DECIMAL_PLACES.PRICE)}%`,
        depth: `${orderBookAnalysis.depth.bid} bids / ${orderBookAnalysis.depth.ask} asks`,
      });

      // Check for blocking walls (info only)
      const hasWall = this.orderBookAnalyzer.hasBlockingWall(
        orderBookAnalysis,
        direction === SignalDirection.LONG ? 'LONG' : 'SHORT',
        2.0,
      );

      if (hasWall) {
        this.logger.info('⚠️ OrderBook wall detected in path', {
          direction,
          distance: '< 2%',
        });
      }
    } catch (error) {
      this.logger.warn('Failed to log OrderBook', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log Volume analysis
   *
   * @param currentPrice - Current market price
   * @param direction - Signal direction
   */
  private async logVolume(
    currentPrice: number,
    direction: SignalDirection,
  ): Promise<void> {
    if (!this.volumeAnalyzer || !this.config.volume) {
      return;
    }

    try {
      this.logger.debug('Analyzing volume profile...');

      // Get PRIMARY candles for volume analysis
      const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY);

      if (!primaryCandles || primaryCandles.length === 0) {
        this.logger.warn('No candles available for volume analysis');
        return;
      }

      const volumeAnalysis = this.volumeAnalyzer.analyze(primaryCandles, currentPrice);

      // Log summary
      const summary = this.volumeAnalyzer.getSummary(volumeAnalysis);
      this.logger.info('📈 Volume Analysis', { summary });

      // Log detailed analysis
      this.logger.debug('Volume details', {
        poc: volumeAnalysis.poc
          ? `${volumeAnalysis.poc.price.toFixed(DECIMAL_PLACES.PERCENT)} (${volumeAnalysis.poc.volume.toFixed(0)})`
          : 'N/A',
        hvns: volumeAnalysis.hvns.length,
        lvns: volumeAnalysis.lvns.length,
        totalVolume: volumeAnalysis.totalVolume.toFixed(0),
        avgVolume: volumeAnalysis.avgVolume.toFixed(DECIMAL_PLACES.PERCENT),
      });

      // Check for blocking HVNs (info only)
      const hasHVN = this.volumeAnalyzer.hasBlockingHVN(
        volumeAnalysis,
        direction === SignalDirection.LONG ? 'LONG' : 'SHORT',
        2.0,
      );

      if (hasHVN) {
        this.logger.info('⚠️ High Volume Node detected in path', {
          direction,
          distance: '< 2%',
        });
      }

      // Check if in LVN (weak zone)
      const inLVN = this.volumeAnalyzer.isInLVN(volumeAnalysis, currentPrice);
      if (inLVN) {
        this.logger.info('📍 Current price is in Low Volume Node (weak zone)', {
          price: currentPrice,
        });
      }

      // Check if near POC
      const nearPOC = this.volumeAnalyzer.isNearPOC(volumeAnalysis, currentPrice, 0.5);
      if (nearPOC) {
        this.logger.info('📍 Current price is near Point of Control', {
          price: currentPrice,
          poc: volumeAnalysis.poc?.price.toFixed(DECIMAL_PLACES.PERCENT),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to log Volume', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
