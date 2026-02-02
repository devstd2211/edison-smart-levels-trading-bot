import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, TIME_UNITS, INTEGER_MULTIPLIERS } from '../constants';
import { MIN_REFILLS_FOR_ICEBERG, CLUSTER_MIN_WALLS, WALL_LIFETIME_SCORE_MAX, WALL_SIZE_STABILITY_SCORE_MAX, WALL_ICEBERG_BONUS_SCORE, RATIO_MULTIPLIERS } from '../constants/technical.constants';
/**
 * Wall Tracker Service (PHASE 4)
 *
 * Tracks orderbook wall lifetime and detects spoofing/iceberg orders.
 *
 * Features:
 * - Wall lifetime tracking (how long walls stay in book)
 * - Spoofing detection (walls added then removed quickly <5s)
 * - Iceberg detection (rapid refills = hidden orders)
 * - Wall cluster analysis (multiple walls at same level)
 * - Wall absorption tracking (volume traded through wall)
 *
 * Use Cases:
 * - Filter fake walls (spoofing) vs real institutional walls
 * - Detect iceberg orders (large hidden orders)
 * - Identify strong support/resistance (wall clusters)
 */

import { WallTrackingConfig, WallEvent, WallLifetime, WallCluster, LoggerService } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { WallTrackingError } from '../errors/DomainErrors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CLUSTER_PRICE_THRESHOLD_PERCENT = MULTIPLIERS.HALF; // Walls within 0.5% = cluster
// MIN_REFILLS_FOR_ICEBERG imported from technical.constants (3+ refills = iceberg)
// CLUSTER_MIN_WALLS imported from technical.constants (minimum walls to form cluster)

// ============================================================================
// WALL TRACKER SERVICE
// ============================================================================

export class WallTrackerService {
  private activeWalls: Map<string, WallLifetime> = new Map(); // key: `${side}_${price}`
  private wallHistory: WallEvent[] = [];

  constructor(
    private config: WallTrackingConfig,
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.28
  ) {}

  /**
   * Detect new wall in orderbook
   */
  detectWall(price: number, size: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Phase 8.9.28: Validation with error handling
      if (isNaN(price) || isNaN(size) || price <= 0 || size < 0) {
        if (this.errorHandler) {
          // Log validation error but continue (SKIP strategy)
          const error = new WallTrackingError('Invalid wall parameters', {
            operation: 'detect',
            wallPrice: price,
            wallSide: side,
            size,
            issue: 'NaN or negative values',
          });
          this.logger.warn('Wall detection skipped due to invalid parameters', {
            price,
            size,
            side,
          });
        }
        return; // SKIP: Don't track invalid wall
      }

      const key = this.getKey(side, price);
      const existing = this.activeWalls.get(key);

      if (!existing) {
        // New wall detected
        const wall: WallLifetime = {
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          price,
          side,
          maxSize: size,
          currentSize: size,
          events: [
            {
              timestamp: Date.now(),
              type: 'ADDED',
              price,
              size,
              side,
            },
          ],
          isSpoofing: false,
          isIceberg: false,
          absorbedVolume: 0,
        };

        this.activeWalls.set(key, wall);
        this.addEvent(wall.events[0]);

        // Note: Wall detection logging disabled to reduce spam
        // this.logger.debug('🧱 Wall detected (PHASE 4)', {
        //   side,
        //   price: price.toFixed(DECIMAL_PLACES.PRICE),
        //   size: size.toFixed(DECIMAL_PLACES.PERCENT),
        // });
      } else {
        // Wall still exists - update
        this.updateWall(existing, size);
      }
    } catch (error) {
      if (this.errorHandler) {
        // SKIP strategy: log error but continue processing
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error in detectWall';
        this.logger.warn('Error in wall detection, skipping wall', {
          error: errorMsg,
          price,
          size,
          side,
        });
      }
      // Silently continue - wall detection is non-blocking
    }
  }

  /**
   * Remove wall from tracking (wall disappeared from orderbook)
   */
  removeWall(price: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const key = this.getKey(side, price);
      const wall = this.activeWalls.get(key);

      if (!wall) {
        return; // Not tracked
      }

      // Phase 8.9.28: Calculate lifetime with validation
      const lifetime = Date.now() - wall.firstSeen;

      if (isNaN(lifetime) || !isFinite(lifetime)) {
        if (this.errorHandler) {
          this.logger.warn('Invalid wall lifetime calculation, skipping removal', {
            price,
            side,
            firstSeen: wall.firstSeen,
          });
        }
        return; // SKIP: Don't remove wall with invalid lifetime
      }

      // Check for spoofing (removed too quickly)
      if (lifetime < this.config.spoofingThresholdMs) {
        wall.isSpoofing = true;
      }

      // Add REMOVED event
      const event: WallEvent = {
        timestamp: Date.now(),
        type: 'REMOVED',
        price,
        size: wall.currentSize,
        side,
        reason: wall.isSpoofing ? 'spoofing' : 'filled_or_cancelled',
      };

      wall.events.push(event);
      this.addEvent(event);

      this.activeWalls.delete(key);

      // Note: Wall removal logging disabled to reduce spam
      // this.logger.debug('🧱 Wall removed (PHASE 4)', {
      //   side,
      //   price: price.toFixed(DECIMAL_PLACES.PRICE),
      //   lifetime: `${lifetime}ms`,
      //   isSpoofing: wall.isSpoofing,
      //   isIceberg: wall.isIceberg,
      // });
    } catch (error) {
      if (this.errorHandler) {
        // SKIP strategy: log error but continue processing
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error in removeWall';
        this.logger.warn('Error in wall removal, skipping', {
          error: errorMsg,
          price,
          side,
        });
      }
      // Silently continue - wall removal is non-blocking
    }
  }

  /**
   * Update existing wall (size changed)
   */
  private updateWall(wall: WallLifetime, newSize: number): void {
    wall.lastSeen = Date.now();

    // Check for absorption (size decreased)
    if (newSize < wall.currentSize) {
      const absorbed = wall.currentSize - newSize;
      wall.absorbedVolume += absorbed;

      const event: WallEvent = {
        timestamp: Date.now(),
        type: 'ABSORBED',
        price: wall.price,
        size: absorbed,
        side: wall.side,
      };

      wall.events.push(event);
      this.addEvent(event);
    }

    // Check for refill (size increased = iceberg)
    if (newSize > wall.currentSize) {
      const refilled = newSize - wall.currentSize;

      const event: WallEvent = {
        timestamp: Date.now(),
        type: 'REFILLED',
        price: wall.price,
        size: refilled,
        side: wall.side,
      };

      wall.events.push(event);
      this.addEvent(event);

      // Check for iceberg pattern (multiple refills)
      const refillCount = wall.events.filter((e) => e.type === 'REFILLED').length;
      if (refillCount >= MIN_REFILLS_FOR_ICEBERG && !wall.isIceberg) {
        wall.isIceberg = true;
        // Log only once when first detected (at exactly MIN_REFILLS_FOR_ICEBERG)
        /*this.logger.info('🧊 Iceberg detected (PHASE 4)', {
          side: wall.side,
          price: wall.price.toFixed(DECIMAL_PLACES.PRICE),
          refills: refillCount,
          totalSize: newSize.toFixed(DECIMAL_PLACES.PERCENT),
        });*/
      }
    }

    wall.currentSize = newSize;
    wall.maxSize = Math.max(wall.maxSize, newSize);
  }

  /**
   * Detect wall clusters (multiple walls at similar prices)
   */
  detectClusters(): WallCluster[] {
    if (!this.config.enabled) {
      return [];
    }

    try {
      // Phase 8.9.28: Error handling with SKIP strategy
      const clusters: WallCluster[] = [];

      // Group walls by side
      const bidWalls = Array.from(this.activeWalls.values()).filter((w) => w.side === 'BID');
      const askWalls = Array.from(this.activeWalls.values()).filter((w) => w.side === 'ASK');

      if (!bidWalls || !askWalls) {
        if (this.errorHandler) {
          this.logger.warn('Failed to group walls by side, returning empty clusters', {
            bidWallsCount: bidWalls?.length ?? 0,
            askWallsCount: askWalls?.length ?? 0,
          });
        }
        return []; // SKIP: return empty array
      }

      // Detect BID clusters
      const bidClusters = this.findClustersInWalls(bidWalls, 'BID');
      clusters.push(...bidClusters);

      // Detect ASK clusters
      const askClusters = this.findClustersInWalls(askWalls, 'ASK');
      clusters.push(...askClusters);

      return clusters;
    } catch (error) {
      if (this.errorHandler) {
        // SKIP strategy: log error but continue
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error in detectClusters';
        this.logger.warn('Error detecting wall clusters, returning empty array', {
          error: errorMsg,
        });
      }
      return []; // SKIP: safe default (empty clusters)
    }
  }

  /**
   * Find clusters in array of walls
   */
  private findClustersInWalls(walls: WallLifetime[], side: 'BID' | 'ASK'): WallCluster[] {
    if (walls.length < CLUSTER_MIN_WALLS) {
      return [];
    }

    // Sort by price
    const sorted = walls.sort((a, b) => a.price - b.price);
    const clusters: WallCluster[] = [];
    let currentCluster: WallLifetime[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const wall = sorted[i];
      const prevWall = sorted[i - 1];

      // Check if wall is within cluster threshold
      const priceDiff = Math.abs(wall.price - prevWall.price);
      const threshold = prevWall.price * (CLUSTER_PRICE_THRESHOLD_PERCENT / PERCENT_MULTIPLIER);

      if (priceDiff <= threshold) {
        // Add to current cluster
        currentCluster.push(wall);
      } else {
        // End current cluster, start new one
        if (currentCluster.length >= CLUSTER_MIN_WALLS) {
          clusters.push(this.createCluster(currentCluster, side));
        }
        currentCluster = [wall];
      }
    }

    // Add last cluster
    if (currentCluster.length >= CLUSTER_MIN_WALLS) {
      clusters.push(this.createCluster(currentCluster, side));
    }

    return clusters;
  }

  /**
   * Create cluster from walls
   */
  private createCluster(walls: WallLifetime[], side: 'BID' | 'ASK'): WallCluster {
    const prices = walls.map((w) => w.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const totalSize = walls.reduce((sum, w) => sum + w.currentSize, 0);
    const totalLifetime = walls.reduce((sum, w) => sum + (Date.now() - w.firstSeen), 0);
    const averageLifetime = totalLifetime / walls.length;

    // Calculate strength (based on size and lifetime)
    const avgSize = totalSize / walls.length;
    const sizeStrength = Math.min(avgSize / INTEGER_MULTIPLIERS.ONE_THOUSAND, 1) * 50; // 0-50 points
    const lifetimeStrength = Math.min(averageLifetime / TIME_UNITS.FIVE_MINUTES, 1) * 50; // 0-50 points (5min max)
    const strength = sizeStrength + lifetimeStrength;

    return {
      priceRange: [minPrice, maxPrice],
      side,
      wallCount: walls.length,
      totalSize,
      averageLifetime,
      strength: Math.round(strength),
    };
  }

  /**
   * Get active walls (for analysis)
   */
  getActiveWalls(): WallLifetime[] {
    return Array.from(this.activeWalls.values());
  }

  /**
   * Get wall history
   */
  getHistory(): WallEvent[] {
    return this.wallHistory;
  }

  /**
   * Clear all walls (reset)
   */
  clear(): void {
    this.activeWalls.clear();
    this.wallHistory = [];
  }

  /**
   * Get wall by price
   */
  getWall(price: number, side: 'BID' | 'ASK'): WallLifetime | undefined {
    const key = this.getKey(side, price);
    return this.activeWalls.get(key);
  }

  /**
   * Check if wall is spoofing
   */
  isSpoofing(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    return wall ? wall.isSpoofing : false;
  }

  /**
   * Check if wall is iceberg
   */
  isIceberg(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    return wall ? wall.isIceberg : false;
  }

  /**
   * Check if wall is real (not spoofing and lived long enough)
   * @returns true if wall is real and trustworthy
   */
  isWallReal(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    if (!wall) {
      return false;
    }

    const lifetime = Date.now() - wall.firstSeen;
    return lifetime >= this.config.minLifetimeMs && !wall.isSpoofing;
  }

  /**
   * Get wall strength score (0-1)
   * Factors: lifetime, size stability, iceberg detection
   */
  getWallStrength(price: number, side: 'BID' | 'ASK'): number {
    const wall = this.getWall(price, side);
    if (!wall) {
      return 0;
    }

    // Spoofing walls have zero strength
    if (wall.isSpoofing) {
      return 0;
    }

    try {
      // Phase 8.9.28: Error handling with GRACEFUL_DEGRADE strategy
      let strength = 0;

      // 1. Lifetime score (0-0.4)
      const lifetime = Date.now() - wall.firstSeen;
      if (isNaN(lifetime) || !isFinite(lifetime)) {
        if (this.errorHandler) {
          this.logger.warn('Invalid lifetime in wall strength calculation', {
            price,
            side,
            firstSeen: wall.firstSeen,
          });
        }
        return 0; // GRACEFUL_DEGRADE: return safe default
      }
      const lifetimeScore =
        Math.min(lifetime / this.config.minLifetimeMs, RATIO_MULTIPLIERS.FULL) *
        WALL_LIFETIME_SCORE_MAX;
      strength += lifetimeScore;

      // 2. Size stability score (0-0.3)
      // High if current size is close to max size
      if (wall.maxSize <= 0) {
        if (this.errorHandler) {
          this.logger.warn('Invalid wall size in strength calculation', {
            price,
            side,
            maxSize: wall.maxSize,
          });
        }
        return 0; // GRACEFUL_DEGRADE: return safe default
      }
      const sizeRatio = wall.currentSize / wall.maxSize;
      if (isNaN(sizeRatio) || !isFinite(sizeRatio)) {
        if (this.errorHandler) {
          this.logger.warn('Invalid size ratio in wall strength calculation', {
            price,
            side,
            currentSize: wall.currentSize,
            maxSize: wall.maxSize,
          });
        }
        return 0; // GRACEFUL_DEGRADE: return safe default
      }
      const sizeStability = sizeRatio * WALL_SIZE_STABILITY_SCORE_MAX;
      strength += sizeStability;

      // 3. Iceberg bonus (0-0.3)
      if (wall.isIceberg) {
        strength += WALL_ICEBERG_BONUS_SCORE;
      }

      const finalScore = Math.min(strength, RATIO_MULTIPLIERS.FULL);
      if (isNaN(finalScore) || !isFinite(finalScore)) {
        if (this.errorHandler) {
          this.logger.warn('Final score calculation resulted in NaN/Infinity', {
            price,
            side,
            lifetimeScore,
            sizeStability,
            isIceberg: wall.isIceberg,
          });
        }
        return 0; // GRACEFUL_DEGRADE: return safe default
      }

      return finalScore;
    } catch (error) {
      if (this.errorHandler) {
        // GRACEFUL_DEGRADE strategy: log error but return safe default
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error in getWallStrength';
        this.logger.warn('Error calculating wall strength, returning 0', {
          error: errorMsg,
          price,
          side,
        });
      }
      return 0; // GRACEFUL_DEGRADE: safe default
    }
  }

  /**
   * Get wall cluster at price level
   * @returns cluster info or null if no cluster found
   */
  getClusterAt(price: number, side: 'BID' | 'ASK'): WallCluster | null {
    const clusters = this.detectClusters();

    // Find cluster containing this price (check if price is within cluster's price range)
    return (
      clusters.find((c: WallCluster) => {
        if (c.side !== side) {
          return false;
        }
        const [minPrice, maxPrice] = c.priceRange;
        return price >= minPrice && price <= maxPrice;
      }) || null
    );
  }

  /**
   * Generate unique key for wall
   */
  private getKey(side: 'BID' | 'ASK', price: number): string {
    return `${side}_${price.toFixed(DECIMAL_PLACES.PRICE)}`;
  }

  /**
   * Add event to history (with limit)
   */
  private addEvent(event: WallEvent): void {
    this.wallHistory.push(event);

    // Trim history to config limit
    if (this.wallHistory.length > this.config.trackHistoryCount) {
      this.wallHistory.shift();
    }
  }

  /**
   * Get config (for testing)
   */
  getConfig(): WallTrackingConfig {
    return { ...this.config };
  }
}
