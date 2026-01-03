import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { INTEGER_MULTIPLIERS, DEFAULT_BLOCKING_CHECK_DISTANCE_PERCENT } from '../constants/technical.constants';
/**
 * Order Book Analyzer
 *
 * Analyzes order book depth to detect:
 * - Bid/Ask imbalance (buying vs selling pressure)
 * - Walls (large orders that can block price movement)
 * - Support/Resistance zones from order book
 *
 * Single Responsibility: Analyze order book data ONLY
 * Does NOT make trading decisions - only provides analysis
 */

import {
  LoggerService,
  OrderbookLevel,
  OrderBookWall,
  OrderBookImbalance,
  OrderBookAnalysis,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

// Re-export unified types from types.ts for backwards compatibility
export type { OrderbookLevel, OrderBookWall, OrderBookImbalance, OrderBookAnalysis };

export interface OrderBookData {
  bids: OrderbookLevel[]; // Buy orders (price descending)
  asks: OrderbookLevel[]; // Sell orders (price ascending)
  timestamp: number;
}

export interface OrderBookConfig {
  enabled: boolean;
  depth: number; // Number of levels to analyze
  wallThreshold: number; // Min % of total volume to be considered a wall
  imbalanceThreshold: number; // Min ratio to be considered bullish/bearish
  updateIntervalMs: number; // How often to fetch order book
}

// ============================================================================
// ORDER BOOK ANALYZER
// ============================================================================

export class OrderBookAnalyzer {
  constructor(
    private config: OrderBookConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Analyze order book data
   *
   * @param orderBook - Order book data (bids/asks)
   * @param currentPrice - Current market price
   * @param symbol - Trading pair symbol (default: 'UNKNOWN')
   * @returns Order book analysis
   */
  analyze(orderBook: OrderBookData, currentPrice: number, symbol: string = 'UNKNOWN'): OrderBookAnalysis {
    // Calculate imbalance (buying vs selling pressure)
    const imbalance = this.calculateImbalance(orderBook);

    // Detect walls (large orders)
    const walls = this.detectWalls(orderBook, currentPrice);

    // Find strongest levels
    const strongestBid = this.findStrongestLevel(orderBook.bids);
    const strongestAsk = this.findStrongestLevel(orderBook.asks);

    // Calculate spread
    const spread = this.calculateSpread(orderBook, currentPrice);

    // Depth info
    const depth = {
      bid: orderBook.bids.length,
      ask: orderBook.asks.length,
    };

    /* this.logger.debug('Order book analyzed', {
      imbalance: `${imbalance.direction} (ratio: ${imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT)})`,
      walls: walls.length,
      spread: `${spread.toFixed(DECIMAL_PLACES.PRICE)}%`,
      depth: `${depth.bid} bids / ${depth.ask} asks`,
    });
*/
    return {
      timestamp: orderBook.timestamp,
      orderBook: {
        symbol,
        timestamp: orderBook.timestamp,
        bids: orderBook.bids,
        asks: orderBook.asks,
        updateId: 0, // Not available in analyzer context
      },
      imbalance,
      walls,
      strongestBid,
      strongestAsk,
      spread,
      depth,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private extractPrice(level: OrderbookLevel): number {
    return typeof level === 'object' && 'price' in level ? level.price : level[0];
  }

  private extractQuantity(level: OrderbookLevel): number {
    return typeof level === 'object' && 'size' in level ? level.size : level[1];
  }

  // ============================================================================
  // PRIVATE METHODS - Imbalance
  // ============================================================================

  /**
   * Calculate bid/ask imbalance
   */
  private calculateImbalance(orderBook: OrderBookData): OrderBookImbalance {
    // Sum all bid volumes
    const bidVolume = orderBook.bids.reduce((sum, level) => sum + this.extractQuantity(level), 0);

    // Sum all ask volumes
    const askVolume = orderBook.asks.reduce((sum, level) => sum + this.extractQuantity(level), 0);

    // Calculate ratio (bid / ask)
    const ratio = askVolume > 0 ? bidVolume / askVolume : 0;

    // Determine direction
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ratio >= this.config.imbalanceThreshold) {
      direction = 'BULLISH'; // More buying pressure
    } else if (ratio <= 1 / this.config.imbalanceThreshold) {
      direction = 'BEARISH'; // More selling pressure
    }

    // Calculate strength (0-1)
    // Strength increases as ratio deviates from 1.0
    const deviation = Math.abs(ratio - 1.0);
    const strength = Math.min(deviation / INTEGER_MULTIPLIERS.TWO, 1.0);

    return {
      bidVolume,
      askVolume,
      ratio,
      direction,
      strength,
    };
  }

  // ============================================================================
  // PRIVATE METHODS - Walls
  // ============================================================================

  /**
   * Detect walls (large orders)
   */
  private detectWalls(orderBook: OrderBookData, currentPrice: number): OrderBookWall[] {
    const walls: OrderBookWall[] = [];

    // Calculate total volumes
    const totalBidVolume = orderBook.bids.reduce((sum, level) => sum + this.extractQuantity(level), 0);
    const totalAskVolume = orderBook.asks.reduce((sum, level) => sum + this.extractQuantity(level), 0);

    // Check bid walls
    for (const bid of orderBook.bids) {
      const bidPrice = this.extractPrice(bid);
      const bidQty = this.extractQuantity(bid);
      const percentOfTotal = (bidQty / totalBidVolume) * PERCENT_MULTIPLIER;
      if (percentOfTotal >= this.config.wallThreshold * PERCENT_MULTIPLIER) {
        const distance = ((currentPrice - bidPrice) / currentPrice) * PERCENT_MULTIPLIER;
        walls.push({
          side: 'BID',
          price: bidPrice,
          quantity: bidQty,
          percentOfTotal,
          distance,
        });
      }
    }

    // Check ask walls
    for (const ask of orderBook.asks) {
      const askPrice = this.extractPrice(ask);
      const askQty = this.extractQuantity(ask);
      const percentOfTotal = (askQty / totalAskVolume) * PERCENT_MULTIPLIER;
      if (percentOfTotal >= this.config.wallThreshold * PERCENT_MULTIPLIER) {
        const distance = ((askPrice - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;
        walls.push({
          side: 'ASK',
          price: askPrice,
          quantity: askQty,
          percentOfTotal,
          distance,
        });
      }
    }

    // Sort by distance from current price
    walls.sort((a, b) => a.distance - b.distance);

    return walls;
  }

  // ============================================================================
  // PRIVATE METHODS - Levels
  // ============================================================================

  /**
   * Find strongest level (highest size)
   */
  private findStrongestLevel(levels: OrderbookLevel[]): OrderbookLevel | null {
    if (levels.length === 0) {
      return null;
    }

    let strongest = levels[0];
    let strongestQty = this.extractQuantity(strongest);
    let strongestPrice = this.extractPrice(strongest);

    for (const level of levels) {
      const qty = this.extractQuantity(level);
      const price = this.extractPrice(level);
      if (qty > strongestQty) {
        strongestQty = qty;
        strongestPrice = price;
      }
    }

    return { price: strongestPrice, size: strongestQty };
  }

  // ============================================================================
  // PRIVATE METHODS - Spread
  // ============================================================================

  /**
   * Calculate spread (best bid - best ask)
   */
  private calculateSpread(orderBook: OrderBookData, currentPrice: number): number {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return 0;
    }

    const bestBid = this.extractPrice(orderBook.bids[0]); // Highest bid
    const bestAsk = this.extractPrice(orderBook.asks[0]); // Lowest ask

    const spread = ((bestAsk - bestBid) / currentPrice) * PERCENT_MULTIPLIER;

    return spread;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get human-readable summary
   */
  getSummary(analysis: OrderBookAnalysis): string {
    const parts: string[] = [];

    // Imbalance
    parts.push(
      `Imbalance: ${analysis.imbalance.direction} (${(analysis.imbalance.strength * PERCENT_MULTIPLIER).toFixed(0)}% strength)`,
    );

    // Walls
    if (analysis.walls.length > 0) {
      const nearestWall = analysis.walls[0];
      parts.push(
        `Nearest wall: ${nearestWall.side} @ ${nearestWall.price.toFixed(DECIMAL_PLACES.PERCENT)} (${nearestWall.distance.toFixed(DECIMAL_PLACES.PERCENT)}% away)`,
      );
    } else {
      parts.push('No walls detected');
    }

    // Spread
    parts.push(`Spread: ${analysis.spread.toFixed(DECIMAL_PLACES.PRICE)}%`);

    return parts.join(' | ');
  }

  /**
   * Check if there's a wall blocking the path
   *
   * @param analysis - Order book analysis
   * @param direction - Trade direction (LONG/SHORT)
   * @param maxDistance - Max distance to check (% from current price)
   * @returns True if wall is blocking
   */
  hasBlockingWall(
    analysis: OrderBookAnalysis,
    direction: 'LONG' | 'SHORT',
    maxDistance: number = DEFAULT_BLOCKING_CHECK_DISTANCE_PERCENT,
  ): boolean {
    for (const wall of analysis.walls) {
      // For LONG: check ASK walls above current price
      if (direction === 'LONG' && wall.side === 'ASK' && wall.distance <= maxDistance) {
        return true;
      }

      // For SHORT: check BID walls below current price
      if (direction === 'SHORT' && wall.side === 'BID' && wall.distance <= maxDistance) {
        return true;
      }
    }

    return false;
  }
}
