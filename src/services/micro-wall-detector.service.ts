import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Micro Wall Detector Service - Scalping Strategy
 *
 * Detects small orderbook walls (5-10% of total volume) for scalping
 * Unlike WhaleDetector (15-20% walls), MicroWall targets frequent small movements
 *
 * Strategy:
 * - Detect micro walls (5-10% of orderbook)
 * - Wait for price to break through wall
 * - Enter quickly with tight TP (0.15%) and SL (0.08%)
 * - Exit within 1-2 minutes
 *
 * IMPORTANT: Requires WebSocket orderbook for real-time data
 */

import { LoggerService, SignalDirection, MicroWallDetectorConfig, MicroWall, OrderBook, OrderbookLevel } from '../types';

// ============================================================================
// MICRO WALL DETECTOR SERVICE
// ============================================================================

export class MicroWallDetectorService {
  private trackedWalls: Map<string, MicroWall> = new Map();
  private brokenWalls: Map<string, number> = new Map(); // wall key → broken timestamp

  constructor(
    private config: MicroWallDetectorConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('🔍 MicroWallDetectorService initialized', {
      minWallSizePercent: config.minWallSizePercent,
      breakConfirmationMs: config.breakConfirmationMs,
      maxConfidence: config.maxConfidence,
      wallExpiryMs: config.wallExpiryMs,
    });
  }

  /**
   * Detect micro walls in current orderbook
   * @param orderbook - Current orderbook snapshot
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns Array of detected micro walls
   */
  detectMicroWalls(orderbook: OrderBook, currentTime: number = Date.now()): MicroWall[] {
    const now = currentTime;
    const detectedWalls: MicroWall[] = [];

    // Helper to extract price and size from OrderbookLevel union type
    const getPrice = (level: OrderbookLevel): number => {
      const price = typeof level === 'object' && 'price' in level ? level.price : level[0];
      // Handle Decimal.js objects
      if (typeof price === 'object' && price !== null && 'toNumber' in price) {
        return (price as any).toNumber();
      }
      return Number(price);
    };
    const getSize = (level: OrderbookLevel): number => {
      const size = typeof level === 'object' && 'size' in level ? level.size : level[1];
      // Handle Decimal.js objects
      if (typeof size === 'object' && size !== null && 'toNumber' in size) {
        return (size as any).toNumber();
      }
      return Number(size);
    };

    // Calculate total orderbook volume
    const totalBidVolume = orderbook.bids.reduce((sum: number, level: OrderbookLevel) => {
      const price = getPrice(level);
      const size = getSize(level);
      return sum + price * size;
    }, 0);
    const totalAskVolume = orderbook.asks.reduce((sum: number, level: OrderbookLevel) => {
      const price = getPrice(level);
      const size = getSize(level);
      return sum + price * size;
    }, 0);
    const totalVolume = totalBidVolume + totalAskVolume;

    if (totalVolume === 0) {
      this.logger.debug('❌ MicroWall: Empty orderbook, skipping detection');
      return [];
    }

    // Get current price (midpoint)
    const firstBid = orderbook.bids[0];
    const firstAsk = orderbook.asks[0];
    const bestBid = firstBid ? getPrice(firstBid) : 0;
    const bestAsk = firstAsk ? getPrice(firstAsk) : 0;
    const currentPrice = (bestBid + bestAsk) / INTEGER_MULTIPLIERS.TWO;

    if (currentPrice === 0) {
      this.logger.debug('❌ MicroWall: Invalid price, skipping detection');
      return [];
    }

    // Check bids for micro walls
    for (const level of orderbook.bids) {
      const price = getPrice(level);
      const qty = getSize(level);
      const volumeUSDT = price * qty;
      const percentOfTotal = (volumeUSDT / totalVolume) * PERCENT_MULTIPLIER;

      if (percentOfTotal >= this.config.minWallSizePercent) {
        const distance = ((currentPrice - price) / currentPrice) * PERCENT_MULTIPLIER;
        const wallKey = `BID_${price.toFixed(DECIMAL_PLACES.PRICE)}`;

        const wall: MicroWall = {
          side: 'BID',
          price,
          size: volumeUSDT,
          percentOfTotal,
          distance,
          timestamp: now,
          broken: false,
        };

        detectedWalls.push(wall);
        this.trackedWalls.set(wallKey, wall);

        this.logger.debug('🟢 MicroWall detected (BID)', {
          price,
          size: volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
          percent: percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
          distance: distance.toFixed(DECIMAL_PLACES.STRENGTH),
        });
      }
    }

    // Check asks for micro walls
    for (const level of orderbook.asks) {
      const price = getPrice(level);
      const qty = getSize(level);
      const volumeUSDT = price * qty;
      const percentOfTotal = (volumeUSDT / totalVolume) * PERCENT_MULTIPLIER;

      if (percentOfTotal >= this.config.minWallSizePercent) {
        const distance = ((price - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;
        const wallKey = `ASK_${price.toFixed(DECIMAL_PLACES.PRICE)}`;

        const wall: MicroWall = {
          side: 'ASK',
          price,
          size: volumeUSDT,
          percentOfTotal,
          distance,
          timestamp: now,
          broken: false,
        };

        detectedWalls.push(wall);
        this.trackedWalls.set(wallKey, wall);

        this.logger.debug('🔴 MicroWall detected (ASK)', {
          price,
          size: volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
          percent: percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
          distance: distance.toFixed(DECIMAL_PLACES.STRENGTH),
        });
      }
    }

    return detectedWalls;
  }

  /**
   * Calculate confidence for a micro wall
   * Based on wall size and distance from current price
   * @param wall - Micro wall to evaluate
   * @returns Confidence score (0-100)
   */
  calculateWallConfidence(wall: MicroWall): number {
    // Size score: 0-60 points (based on % of orderbook)
    // 5% = PERCENTAGE_THRESHOLDS.MODERATE points, 10% = PERCENTAGE_THRESHOLDS.VERY_HIGH points, 15%+ = PERCENTAGE_THRESHOLDS.VERY_HIGH points
    const sizeScore = Math.min((wall.percentOfTotal / this.config.minWallSizePercent) * 30, 60);

    // Distance score: 0-30 points (closer = higher score)
    // 0.1% distance = 25 points, 0.5% = 15 points, 1%+ = 5 points
    const distanceScore = Math.max(30 - wall.distance * 25, 5);

    const confidence = Math.min(sizeScore + distanceScore, this.config.maxConfidence);

    this.logger.debug('📊 MicroWall confidence calculated', {
      side: wall.side,
      price: wall.price,
      sizeScore: sizeScore.toFixed(1),
      distanceScore: distanceScore.toFixed(1),
      confidence: confidence.toFixed(1),
    });

    return confidence;
  }

  /**
   * Check if a micro wall was broken by current price
   * @param wall - Micro wall to check
   * @param currentPrice - Current market price
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns True if wall was broken
   */
  isWallBroken(wall: MicroWall, currentPrice: number, currentTime: number = Date.now()): boolean {
    const now = currentTime;

    // Check if wall was already marked as broken
    if (wall.broken) {
      return true;
    }

    // BID wall broken = price moved DOWN through wall
    if (wall.side === 'BID' && currentPrice < wall.price) {
      const wallKey = `BID_${wall.price.toFixed(DECIMAL_PLACES.PRICE)}`;

      // Check if this wall was already broken previously (skip duplicate)
      if (this.brokenWalls.has(wallKey)) {
        this.logger.debug('⏭️ MicroWall already broken previously (BID)', {
          price: wall.price,
          wallKey,
        });
        return false; // Wall already processed, skip to avoid duplicate signals
      }

      // Wait for confirmation period
      const timeSinceDetection = now - wall.timestamp;
      if (timeSinceDetection < this.config.breakConfirmationMs) {
        this.logger.debug('⏳ MicroWall break confirmation pending (BID)', {
          price: wall.price,
          currentPrice,
          waitMs: this.config.breakConfirmationMs - timeSinceDetection,
        });
        return false;
      }

      wall.broken = true;
      wall.brokenAt = now;
      this.brokenWalls.set(wallKey, now);

      this.logger.info('💥 MicroWall BROKEN (BID → SHORT signal)', {
        wallPrice: wall.price,
        currentPrice,
        size: wall.size.toFixed(DECIMAL_PLACES.PERCENT),
        percent: wall.percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
      });

      return true;
    }

    // ASK wall broken = price moved UP through wall
    if (wall.side === 'ASK' && currentPrice > wall.price) {
      const wallKey = `ASK_${wall.price.toFixed(DECIMAL_PLACES.PRICE)}`;

      // Check if this wall was already broken previously (skip duplicate)
      if (this.brokenWalls.has(wallKey)) {
        this.logger.debug('⏭️ MicroWall already broken previously (ASK)', {
          price: wall.price,
          wallKey,
        });
        return false; // Wall already processed, skip to avoid duplicate signals
      }

      // Wait for confirmation period
      const timeSinceDetection = now - wall.timestamp;
      if (timeSinceDetection < this.config.breakConfirmationMs) {
        this.logger.debug('⏳ MicroWall break confirmation pending (ASK)', {
          price: wall.price,
          currentPrice,
          waitMs: this.config.breakConfirmationMs - timeSinceDetection,
        });
        return false;
      }

      wall.broken = true;
      wall.brokenAt = now;
      this.brokenWalls.set(wallKey, now);

      this.logger.info('💥 MicroWall BROKEN (ASK → LONG signal)', {
        wallPrice: wall.price,
        currentPrice,
        size: wall.size.toFixed(DECIMAL_PLACES.PERCENT),
        percent: wall.percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
      });

      return true;
    }

    return false;
  }

  /**
   * Cleanup expired walls from tracking
   * Removes walls older than wallExpiryMs
   */
  cleanupExpiredWalls(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Cleanup tracked walls
    for (const [key, wall] of this.trackedWalls.entries()) {
      const age = now - wall.timestamp;
      if (age > this.config.wallExpiryMs) {
        this.trackedWalls.delete(key);
        cleanedCount++;
      }
    }

    // Cleanup broken walls (prevent re-detection for longer period)
    const breakExpiryMs = this.config.wallExpiryMs * 5; // 5x longer for broken walls
    for (const [key, brokenAt] of this.brokenWalls.entries()) {
      const age = now - brokenAt;
      if (age > breakExpiryMs) {
        this.brokenWalls.delete(key);
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('🧹 MicroWall cleanup', {
        removed: cleanedCount,
        remaining: this.trackedWalls.size,
        brokenTracked: this.brokenWalls.size,
      });
    }
  }

  /**
   * Get all currently tracked micro walls
   * @returns Array of tracked walls
   */
  getTrackedWalls(): MicroWall[] {
    return Array.from(this.trackedWalls.values());
  }

  /**
   * Check if wall was recently broken (prevents re-entry)
   * @param side - Wall side
   * @param price - Wall price
   * @returns True if wall was recently broken
   */
  wasRecentlyBroken(side: 'BID' | 'ASK', price: number): boolean {
    const wallKey = `${side}_${price.toFixed(DECIMAL_PLACES.PRICE)}`;
    return this.brokenWalls.has(wallKey);
  }

  /**
   * Get signal direction from broken wall
   * @param wall - Broken wall
   * @returns Signal direction (LONG or SHORT)
   */
  getSignalDirection(wall: MicroWall): SignalDirection {
    // ASK wall broken = price went UP → LONG
    if (wall.side === 'ASK') {
      return SignalDirection.LONG;
    }
    // BID wall broken = price went DOWN → SHORT
    return SignalDirection.SHORT;
  }

  /**
   * Reset detector state (for testing)
   */
  reset(): void {
    this.trackedWalls.clear();
    this.brokenWalls.clear();
    this.logger.debug('🔄 MicroWallDetector reset');
  }
}
