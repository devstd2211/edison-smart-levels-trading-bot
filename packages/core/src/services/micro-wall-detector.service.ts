import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Micro Wall Detector Service - Scalping Strategy (Phase 8.9.64)
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
 *
 * ErrorHandler Integration (Phase 8.9.64):
 * - THROW: Null/invalid orderbook, invalid config values
 * - GRACEFUL_DEGRADE: NaN/Infinity volume calculations (return empty array)
 * - SKIP: Logging failures (safeLog() wrapper)
 */

import { LoggerService, SignalDirection, MicroWallDetectorConfig, MicroWall, OrderBook, OrderbookLevel } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

// ============================================================================
// MICRO WALL DETECTOR SERVICE
// ============================================================================

export class MicroWallDetectorService {
  private trackedWalls: Map<string, MicroWall> = new Map();
  private brokenWalls: Map<string, number> = new Map(); // wall key -> broken timestamp

  constructor(
    private config: MicroWallDetectorConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation
    this.validateConfig(config);

    this.safeLog('info', `${ICONS.note} MicroWallDetectorService initialized`, {
      minWallSizePercent: config.minWallSizePercent,
      breakConfirmationMs: config.breakConfirmationMs,
      maxConfidence: config.maxConfidence,
      wallExpiryMs: config.wallExpiryMs,
    });
  }

  /**
   * Validate configuration (THROW on invalid values)
   */
  private validateConfig(config: MicroWallDetectorConfig): void {
    if (!config) {
      throw new Error('MicroWallDetectorService: config is required');
    }
    if (config.minWallSizePercent <= 0 || config.minWallSizePercent > 100) {
      throw new Error('MicroWallDetectorService: minWallSizePercent must be 0-100');
    }
    if (config.breakConfirmationMs < 0) {
      throw new Error('MicroWallDetectorService: breakConfirmationMs must be >= 0');
    }
    if (config.maxConfidence <= 0 || config.maxConfidence > 100) {
      throw new Error('MicroWallDetectorService: maxConfidence must be 1-100');
    }
    if (config.wallExpiryMs <= 0) {
      throw new Error('MicroWallDetectorService: wallExpiryMs must be > 0');
    }
  }

  /**
   * Safe logging wrapper - SKIP strategy for logger failures
   */
  private safeLog(level: 'info' | 'debug' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    try {
      if (level === 'info') this.logger.info(message, context);
      else if (level === 'debug') this.logger.debug(message, context);
      else if (level === 'warn') this.logger.warn(message, context);
      else if (level === 'error') this.logger.error(message, context);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
      // Silent fail - never block operation due to logger errors
    }
  }

  /**
   * Detect micro walls in current orderbook
   * @param orderbook - Current orderbook snapshot
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns Array of detected micro walls
   * THROW: Invalid orderbook structure
   * GRACEFUL_DEGRADE: NaN/Infinity in calculations -> return empty array
   */
  detectMicroWalls(orderbook: OrderBook, currentTime: number = Date.now()): MicroWall[] {
    // THROW: Input validation
    if (!orderbook) {
      throw new Error('MicroWallDetectorService: orderbook is required');
    }
    if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
      throw new Error('MicroWallDetectorService: orderbook.bids and asks must be arrays');
    }

    const now = currentTime;
    const detectedWalls: MicroWall[] = [];

    const toNumberFromUnknown = (value: unknown): number => {
      if (this.hasToNumber(value)) {
        return value.toNumber();
      }
      return Number(value);
    };

    // Helper to extract price and size from OrderbookLevel union type
    const getPrice = (level: OrderbookLevel): number => {
      const price = typeof level === 'object' && 'price' in level ? level.price : level[0];
      return toNumberFromUnknown(price);
    };
    const getSize = (level: OrderbookLevel): number => {
      const size = typeof level === 'object' && 'size' in level ? level.size : level[1];
      return toNumberFromUnknown(size);
    };

    try {
      // Calculate total orderbook volume
      // GRACEFUL_DEGRADE: Handle NaN/Infinity volumes
      let totalBidVolume = 0;
      for (const level of orderbook.bids) {
        const price = getPrice(level);
        const size = getSize(level);
        if (!isFinite(price) || !isFinite(size)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Invalid bid level (NaN/Infinity)`, { price, size });
          continue;
        }
        totalBidVolume += price * size;
      }

      let totalAskVolume = 0;
      for (const level of orderbook.asks) {
        const price = getPrice(level);
        const size = getSize(level);
        if (!isFinite(price) || !isFinite(size)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Invalid ask level (NaN/Infinity)`, { price, size });
          continue;
        }
        totalAskVolume += price * size;
      }

      if (!isFinite(totalBidVolume) || !isFinite(totalAskVolume)) {
        // GRACEFUL_DEGRADE: Return empty array if volume calculation failed
        this.safeLog('debug', `${ICONS.warning} MicroWall: Volume calculation resulted in NaN/Infinity, skipping detection`);
        return [];
      }

      const totalVolume = totalBidVolume + totalAskVolume;

      if (totalVolume === 0) {
        this.safeLog('debug', `${ICONS.error} MicroWall: Empty orderbook, skipping detection`);
        return [];
      }

      // Get current price (midpoint)
      const firstBid = orderbook.bids[0];
      const firstAsk = orderbook.asks[0];
      const bestBid = firstBid ? getPrice(firstBid) : 0;
      const bestAsk = firstAsk ? getPrice(firstAsk) : 0;

      // GRACEFUL_DEGRADE: Invalid price calculation
      if (!isFinite(bestBid) || !isFinite(bestAsk)) {
        this.safeLog('debug', `${ICONS.error} MicroWall: Invalid bid/ask prices (NaN/Infinity), skipping detection`);
        return [];
      }

      const currentPrice = (bestBid + bestAsk) / INTEGER_MULTIPLIERS.TWO;

      if (currentPrice === 0 || !isFinite(currentPrice)) {
        this.safeLog('debug', `${ICONS.error} MicroWall: Invalid price calculation, skipping detection`);
        return [];
      }

      // Check bids for micro walls
      for (const level of orderbook.bids) {
        const price = getPrice(level);
        const qty = getSize(level);

        // GRACEFUL_DEGRADE: Skip invalid price/quantity
        if (!isFinite(price) || !isFinite(qty)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Skipping invalid bid level`, { price, qty });
          continue;
        }

        const volumeUSDT = price * qty;
        if (!isFinite(volumeUSDT)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Volume calculation resulted in NaN/Infinity`, {
            price,
            qty,
            volumeUSDT,
          });
          continue;
        }

        const percentOfTotal = (volumeUSDT / totalVolume) * PERCENT_MULTIPLIER;

        if (percentOfTotal >= this.config.minWallSizePercent) {
          const distance = ((currentPrice - price) / currentPrice) * PERCENT_MULTIPLIER;

          // GRACEFUL_DEGRADE: Check distance validity
          if (!isFinite(distance)) {
            this.safeLog('debug', `${ICONS.warning} MicroWall: Distance calculation resulted in NaN/Infinity`);
            continue;
          }

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

          this.safeLog('debug', `${ICONS.success} MicroWall detected (BID)`, {
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

        // GRACEFUL_DEGRADE: Skip invalid price/quantity
        if (!isFinite(price) || !isFinite(qty)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Skipping invalid ask level`, { price, qty });
          continue;
        }

        const volumeUSDT = price * qty;
        if (!isFinite(volumeUSDT)) {
          this.safeLog('debug', `${ICONS.warning} MicroWall: Volume calculation resulted in NaN/Infinity`, {
            price,
            qty,
            volumeUSDT,
          });
          continue;
        }

        const percentOfTotal = (volumeUSDT / totalVolume) * PERCENT_MULTIPLIER;

        if (percentOfTotal >= this.config.minWallSizePercent) {
          const distance = ((price - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;

          // GRACEFUL_DEGRADE: Check distance validity
          if (!isFinite(distance)) {
            this.safeLog('debug', `${ICONS.warning} MicroWall: Distance calculation resulted in NaN/Infinity`);
            continue;
          }

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

          this.safeLog('debug', `${ICONS.error} MicroWall detected (ASK)`, {
            price,
            size: volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
            percent: percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
            distance: distance.toFixed(DECIMAL_PLACES.STRENGTH),
          });
        }
      }

      return detectedWalls;
    } catch (error) {
      // GRACEFUL_DEGRADE: Return empty array if processing fails
      this.safeLog('warn', `${ICONS.warning} MicroWall detection failed`, { error: getErrorMessage(error) });
      return [];
    }
  }

  /**
   * Calculate confidence for a micro wall
   * Based on wall size and distance from current price
   * @param wall - Micro wall to evaluate
   * @returns Confidence score (0-100)
   * THROW: Invalid wall
   * GRACEFUL_DEGRADE: Calculation failures -> return default confidence
   */
  calculateWallConfidence(wall: MicroWall): number {
    // THROW: Input validation
    if (!wall) {
      throw new Error('MicroWallDetectorService: wall is required');
    }
    if (!isFinite(wall.percentOfTotal) || !isFinite(wall.distance) || !isFinite(wall.price)) {
      throw new Error('MicroWallDetectorService: wall has invalid numeric values (NaN/Infinity)');
    }

    try {
      // Size score: 0-60 points (based on % of orderbook)
      const sizeScore = Math.min((wall.percentOfTotal / this.config.minWallSizePercent) * 30, 60);

      // Distance score: 0-30 points (closer = higher score)
      const distanceScore = Math.max(30 - wall.distance * 25, 5);

      // GRACEFUL_DEGRADE: Check calculation validity
      if (!isFinite(sizeScore) || !isFinite(distanceScore)) {
        this.safeLog('warn', `${ICONS.warning} MicroWall: Confidence score calculation resulted in NaN/Infinity`);
        return 0; // Safe default
      }

      const confidence = Math.min(sizeScore + distanceScore, this.config.maxConfidence);

      this.safeLog('debug', `${ICONS.chart} MicroWall confidence calculated`, {
        side: wall.side,
        price: wall.price,
        sizeScore: sizeScore.toFixed(1),
        distanceScore: distanceScore.toFixed(1),
        confidence: confidence.toFixed(1),
      });

      return confidence;
    } catch (error) {
      // GRACEFUL_DEGRADE: Return safe default on calculation failure
      this.safeLog('warn', `${ICONS.warning} MicroWall confidence calculation failed`, { error: getErrorMessage(error) });
      return 0;
    }
  }

  /**
   * Check if a micro wall was broken by current price
   * @param wall - Micro wall to check
   * @param currentPrice - Current market price
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns True if wall was broken
   * THROW: Invalid wall/price
   */
  isWallBroken(wall: MicroWall, currentPrice: number, currentTime: number = Date.now()): boolean {
    // THROW: Input validation
    if (!wall) {
      throw new Error('MicroWallDetectorService: wall is required');
    }
    if (!isFinite(currentPrice)) {
      throw new Error('MicroWallDetectorService: currentPrice must be a finite number');
    }
    if (!isFinite(wall.price)) {
      throw new Error('MicroWallDetectorService: wall.price must be a finite number');
    }

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
        this.safeLog('debug', `${ICONS.note} MicroWall already broken previously (BID)`, {
          price: wall.price,
          wallKey,
        });
        return false; // Wall already processed, skip to avoid duplicate signals
      }

      // Wait for confirmation period
      const timeSinceDetection = now - wall.timestamp;
      if (timeSinceDetection < this.config.breakConfirmationMs) {
        this.safeLog('debug', `${ICONS.note} MicroWall break confirmation pending (BID)`, {
          price: wall.price,
          currentPrice,
          waitMs: this.config.breakConfirmationMs - timeSinceDetection,
        });
        return false;
      }

      wall.broken = true;
      wall.brokenAt = now;
      this.brokenWalls.set(wallKey, now);

      this.safeLog('info', `${ICONS.warning} MicroWall broken (BID -> SHORT signal)`, {
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
        this.safeLog('debug', `${ICONS.note} MicroWall already broken previously (ASK)`, {
          price: wall.price,
          wallKey,
        });
        return false; // Wall already processed, skip to avoid duplicate signals
      }

      // Wait for confirmation period
      const timeSinceDetection = now - wall.timestamp;
      if (timeSinceDetection < this.config.breakConfirmationMs) {
        this.safeLog('debug', `${ICONS.note} MicroWall break confirmation pending (ASK)`, {
          price: wall.price,
          currentPrice,
          waitMs: this.config.breakConfirmationMs - timeSinceDetection,
        });
        return false;
      }

      wall.broken = true;
      wall.brokenAt = now;
      this.brokenWalls.set(wallKey, now);

      this.safeLog('info', `${ICONS.warning} MicroWall broken (ASK -> LONG signal)`, {
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
   * SKIP: Logging failures
   */
  cleanupExpiredWalls(): void {
    try {
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
        this.safeLog('debug', `${ICONS.note} MicroWall cleanup`, {
          removed: cleanedCount,
          remaining: this.trackedWalls.size,
          brokenTracked: this.brokenWalls.size,
        });
      }
    } catch (error) {
      // SKIP: Silent fail for cleanup errors
      this.safeLog('warn', `${ICONS.warning} MicroWall cleanup failed`, { error: getErrorMessage(error) });
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
    // ASK wall broken = price went UP -> LONG
    if (wall.side === 'ASK') {
      return SignalDirection.LONG;
    }
    // BID wall broken = price went DOWN -> SHORT
    return SignalDirection.SHORT;
  }

  /**
   * Reset detector state (for testing)
   * SKIP: Logging failures
   */
  reset(): void {
    try {
      this.trackedWalls.clear();
      this.brokenWalls.clear();
      this.safeLog('debug', `${ICONS.note} MicroWallDetector reset`);
    } catch (error) {
      // SKIP: Silent fail for reset errors
      this.safeLog('warn', `${ICONS.warning} MicroWall reset failed`, { error: getErrorMessage(error) });
    }
  }

  private hasToNumber(value: unknown): value is { toNumber: () => number } {
    return (
      typeof value === 'object'
      && value !== null
      && 'toNumber' in value
      && typeof (value as { toNumber?: unknown }).toNumber === 'function'
    );
  }
}
