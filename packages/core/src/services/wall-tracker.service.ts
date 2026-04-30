/**
 * Wall Tracker Service (PHASE 4)
 *
 * Tracks orderbook wall lifetime and detects spoofing/iceberg orders.
 */

import { LoggerService } from './logger.service';
import { WallCluster, WallEvent, WallLifetime, WallTrackingConfig } from '../types/legacy';
import { ErrorHandler } from '../errors/ErrorHandler';
import { WallTrackingError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import {
  appendWallEventWithLimit,
  applyWallSizeUpdate,
  calculateWallStrengthScore,
  createRemovedWallEvent,
  createTrackedWall,
  createWallCluster,
  detectWallClusters,
  getWallTrackerKey,
  isValidWallInput,
  shouldMarkWallSpoofing,
} from './wall-tracker/wall-tracker-state.utils';

export class WallTrackerService {
  private activeWalls: Map<string, WallLifetime> = new Map();
  private wallHistory: WallEvent[] = [];

  constructor(
    private config: WallTrackingConfig,
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  detectWall(price: number, size: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      if (!isValidWallInput(price, size)) {
        if (this.errorHandler) {
          new WallTrackingError('Invalid wall parameters', {
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
        return;
      }

      const key = this.getKey(side, price);
      const existing = this.activeWalls.get(key);

      if (!existing) {
        const wall = createTrackedWall(price, size, side);
        this.activeWalls.set(key, wall);
        this.addEvent(wall.events[0]);
        return;
      }

      this.updateWall(existing, size);
    } catch (error) {
      if (this.errorHandler) {
        this.logger.warn('Error in wall detection, skipping wall', {
          error: getErrorMessage(error),
          price,
          size,
          side,
        });
      }
    }
  }

  removeWall(price: number, side: 'BID' | 'ASK'): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const key = this.getKey(side, price);
      const wall = this.activeWalls.get(key);

      if (!wall) {
        return;
      }

      const lifetime = Date.now() - wall.firstSeen;
      if (Number.isNaN(lifetime) || !Number.isFinite(lifetime)) {
        if (this.errorHandler) {
          this.logger.warn('Invalid wall lifetime calculation, skipping removal', {
            price,
            side,
            firstSeen: wall.firstSeen,
          });
        }
        return;
      }

      if (shouldMarkWallSpoofing(lifetime, this.config.spoofingThresholdMs)) {
        wall.isSpoofing = true;
      }

      const event = createRemovedWallEvent(wall);
      wall.events.push(event);
      this.addEvent(event);
      this.activeWalls.delete(key);
    } catch (error) {
      if (this.errorHandler) {
        this.logger.warn('Error in wall removal, skipping', {
          error: getErrorMessage(error),
          price,
          side,
        });
      }
    }
  }

  private updateWall(wall: WallLifetime, newSize: number): void {
    const previousEventCount = wall.events.length;
    applyWallSizeUpdate(wall, newSize);

    for (const event of wall.events.slice(previousEventCount)) {
      this.addEvent(event);
    }
  }

  detectClusters(): WallCluster[] {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const bidWalls = Array.from(this.activeWalls.values()).filter((wall) => wall.side === 'BID');
      const askWalls = Array.from(this.activeWalls.values()).filter((wall) => wall.side === 'ASK');

      if (!bidWalls || !askWalls) {
        if (this.errorHandler) {
          this.logger.warn('Failed to group walls by side, returning empty clusters', {
            bidWallsCount: bidWalls?.length ?? 0,
            askWallsCount: askWalls?.length ?? 0,
          });
        }
        return [];
      }

      return [
        ...this.findClustersInWalls(bidWalls, 'BID'),
        ...this.findClustersInWalls(askWalls, 'ASK'),
      ];
    } catch (error) {
      if (this.errorHandler) {
        this.logger.warn('Error detecting wall clusters, returning empty array', {
          error: getErrorMessage(error),
        });
      }
      return [];
    }
  }

  private findClustersInWalls(walls: WallLifetime[], side: 'BID' | 'ASK'): WallCluster[] {
    return detectWallClusters(walls, side);
  }

  private createCluster(walls: WallLifetime[], side: 'BID' | 'ASK'): WallCluster {
    return createWallCluster(walls, side);
  }

  getActiveWalls(): WallLifetime[] {
    return Array.from(this.activeWalls.values());
  }

  getHistory(): WallEvent[] {
    return this.wallHistory;
  }

  clear(): void {
    this.activeWalls.clear();
    this.wallHistory = [];
  }

  getWall(price: number, side: 'BID' | 'ASK'): WallLifetime | undefined {
    return this.activeWalls.get(this.getKey(side, price));
  }

  isSpoofing(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    return wall ? wall.isSpoofing : false;
  }

  isIceberg(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    return wall ? wall.isIceberg : false;
  }

  isWallReal(price: number, side: 'BID' | 'ASK'): boolean {
    const wall = this.getWall(price, side);
    if (!wall) {
      return false;
    }

    const lifetime = Date.now() - wall.firstSeen;
    return lifetime >= this.config.minLifetimeMs && !wall.isSpoofing;
  }

  getWallStrength(price: number, side: 'BID' | 'ASK'): number {
    const wall = this.getWall(price, side);
    if (!wall) {
      return 0;
    }

    const score = calculateWallStrengthScore(wall, this.config);
    if (score === null) {
      if (this.errorHandler) {
        this.logger.warn('Wall strength calculation resulted in invalid state', {
          price,
          side,
          firstSeen: wall.firstSeen,
          currentSize: wall.currentSize,
          maxSize: wall.maxSize,
          isIceberg: wall.isIceberg,
        });
      }
      return 0;
    }

    return score;
  }

  getClusterAt(price: number, side: 'BID' | 'ASK'): WallCluster | null {
    return (
      this.detectClusters().find((cluster) => {
        if (cluster.side !== side) {
          return false;
        }
        const [minPrice, maxPrice] = cluster.priceRange;
        return price >= minPrice && price <= maxPrice;
      }) || null
    );
  }

  private getKey(side: 'BID' | 'ASK', price: number): string {
    return getWallTrackerKey(side, price);
  }

  private addEvent(event: WallEvent): void {
    appendWallEventWithLimit(this.wallHistory, event, this.config.trackHistoryCount);
  }

  getConfig(): WallTrackingConfig {
    return { ...this.config };
  }
}
