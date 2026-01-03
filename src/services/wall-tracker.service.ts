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
  ) {}

  /**
   * Detect new wall in orderbook
   */
  detectWall(price: number, size: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
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
  }

  /**
   * Remove wall from tracking (wall disappeared from orderbook)
   */
  removeWall(price: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.getKey(side, price);
    const wall = this.activeWalls.get(key);

    if (!wall) {
      return; // Not tracked
    }

    const lifetime = Date.now() - wall.firstSeen;

    // Check for spoofing (removed too quickly)
    if (lifetime < this.config.spoofingThresholdMs) {
      wall.isSpoofing = true;
      /*this.logger.warn('⚠️ Spoofing detected (PHASE 4)', {
        side,
        price: price.toFixed(DECIMAL_PLACES.PRICE),
        lifetime: `${lifetime}ms`,
        size: wall.currentSize.toFixed(DECIMAL_PLACES.PERCENT),
      });*/
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

    const clusters: WallCluster[] = [];

    // Group walls by side
    const bidWalls = Array.from(this.activeWalls.values()).filter((w) => w.side === 'BID');
    const askWalls = Array.from(this.activeWalls.values()).filter((w) => w.side === 'ASK');

    // Detect BID clusters
    clusters.push(...this.findClustersInWalls(bidWalls, 'BID'));

    // Detect ASK clusters
    clusters.push(...this.findClustersInWalls(askWalls, 'ASK'));

    return clusters;
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

    let strength = 0;

    // 1. Lifetime score (0-0.4)
    const lifetime = Date.now() - wall.firstSeen;
    const lifetimeScore = Math.min(lifetime / this.config.minLifetimeMs, RATIO_MULTIPLIERS.FULL) * WALL_LIFETIME_SCORE_MAX;
    strength += lifetimeScore;

    // 2. Size stability score (0-0.3)
    // High if current size is close to max size
    const sizeRatio = wall.currentSize / wall.maxSize;
    const sizeStability = sizeRatio * WALL_SIZE_STABILITY_SCORE_MAX;
    strength += sizeStability;

    // 3. Iceberg bonus (0-0.3)
    if (wall.isIceberg) {
      strength += WALL_ICEBERG_BONUS_SCORE;
    }

    return Math.min(strength, RATIO_MULTIPLIERS.FULL);
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
