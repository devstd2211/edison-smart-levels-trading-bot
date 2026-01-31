import { TIME_UNITS } from '../constants';
import { MAX_ORDERBOOK_LEVELS } from '../constants/technical.constants';
/**
 * Orderbook Manager Service
 *
 * Maintains local orderbook snapshot from WebSocket updates:
 * - Receives snapshot on initial subscription
 * - Applies delta updates to maintain current state
 * - Provides full orderbook on demand for whale detection
 *
 * Responsibilities:
 * - Snapshot storage and management
 * - Delta application logic
 * - Memory management (prevent leaks)
 *
 * Single Responsibility: Orderbook state management
 */

import { LoggerService } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { WallTrackerService } from './wall-tracker.service';

// ============================================================================
// CONSTANTS
// ============================================================================

// MAX_ORDERBOOK_LEVELS imported from technical.constants (max levels to store)
const SNAPSHOT_RESET_THRESHOLD_MS = TIME_UNITS.MINUTE; // Reset if no snapshot for 1 min

// ============================================================================
// TYPES
// ============================================================================

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookSnapshot {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
  updateId: number;
}

export interface OrderbookUpdate {
  type: 'snapshot' | 'delta';
  bids: Array<[string, string]>; // [price, size] from Bybit
  asks: Array<[string, string]>;
  updateId: number;
  timestamp: number;
}

// ============================================================================
// ORDERBOOK MANAGER SERVICE
// ============================================================================

/**
 * Orderbook Manager Service
 *
 * Phase 8.9.18: ErrorHandler integration
 * - GRACEFUL_DEGRADE for WallTracker callbacks (prevents orderbook corruption)
 * - SKIP for NaN price/size validation
 * - GRACEFUL_DEGRADE for stale snapshot handling
 */
export class OrderbookManagerService {
  // Snapshot storage (Map for O(1) lookup/update/delete)
  private bidsMap: Map<number, number> = new Map(); // price -> size
  private asksMap: Map<number, number> = new Map();
  private lastUpdateId: number = 0;
  private lastSnapshotTime: number = 0;
  private isInitialized: boolean = false;

  constructor(
    private readonly symbol: string,
    private readonly logger: LoggerService,
    private readonly wallTracker?: WallTrackerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Process orderbook update from WebSocket
   * Handles both snapshot and delta messages
   */
  processUpdate(update: OrderbookUpdate): void {
    if (update.type === 'snapshot') {
      this.handleSnapshot(update);
    } else {
      this.handleDelta(update);
    }
  }

  /**
   * Get current orderbook snapshot
   * Returns sorted bids (descending) and asks (ascending)
   *
   * Phase 8.9.18: ErrorHandler integration with GRACEFUL_DEGRADE strategy
   * - GRACEFUL_DEGRADE on stale snapshot (serve with warning instead of null)
   */
  getSnapshot(): OrderbookSnapshot | null {
    if (!this.isInitialized) {
      this.logger.warn('Orderbook not initialized yet', { symbol: this.symbol });
      return null;
    }

    // Check if snapshot is stale
    const now = Date.now();
    const ageMs = now - this.lastSnapshotTime;
    if (ageMs > SNAPSHOT_RESET_THRESHOLD_MS) {
      // Phase 8.9.18: GRACEFUL_DEGRADE for stale snapshot
      if (this.errorHandler) {
        const error = new Error(`Orderbook snapshot is stale (age: ${ageMs}ms)`);
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'OrderbookManagerService.getSnapshot.staleSnapshot',
          onRecover: () => {
            this.logger.warn('Serving stale orderbook data (degraded mode)', {
              symbol: this.symbol,
              ageMs,
            });
          },
        });
      } else {
        this.logger.warn('Orderbook snapshot is stale, waiting for new data', {
          symbol: this.symbol,
          ageMs,
        });
        return null;
      }
      // Continue to serve stale data in degraded mode
    }

    // Convert Maps to sorted arrays
    const bids = this.getSortedBids();
    const asks = this.getSortedAsks();

    return {
      bids,
      asks,
      timestamp: this.lastSnapshotTime,
      updateId: this.lastUpdateId,
    };
  }

  /**
   * Check if orderbook is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.bidsMap.size > 0 && this.asksMap.size > 0;
  }

  /**
   * Get current orderbook statistics
   */
  getStats(): {
    bidsCount: number;
    asksCount: number;
    initialized: boolean;
    lastUpdate: number;
    } {
    return {
      bidsCount: this.bidsMap.size,
      asksCount: this.asksMap.size,
      initialized: this.isInitialized,
      lastUpdate: this.lastSnapshotTime,
    };
  }

  /**
   * Reset orderbook state
   * Used when connection is lost or on explicit reset
   */
  reset(): void {
    this.bidsMap.clear();
    this.asksMap.clear();
    this.lastUpdateId = 0;
    this.lastSnapshotTime = 0;
    this.isInitialized = false;

    this.logger.info('Orderbook reset', { symbol: this.symbol });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Handle snapshot message (full orderbook)
   * Reset local state and store new snapshot
   */
  private handleSnapshot(update: OrderbookUpdate): void {
    this.logger.info('📸 Orderbook snapshot received', {
      symbol: this.symbol,
      bids: update.bids.length,
      asks: update.asks.length,
      updateId: update.updateId,
    });

    // Reset existing data
    this.bidsMap.clear();
    this.asksMap.clear();

    // Store snapshot
    this.applyLevels(this.bidsMap, update.bids, true);
    this.applyLevels(this.asksMap, update.asks, false);

    this.lastUpdateId = update.updateId;
    this.lastSnapshotTime = Date.now();
    this.isInitialized = true;

    this.logger.debug('Snapshot applied', {
      bidsCount: this.bidsMap.size,
      asksCount: this.asksMap.size,
    });
  }

  /**
   * Handle delta message (incremental update)
   * Apply changes to existing snapshot
   */
  private handleDelta(update: OrderbookUpdate): void {
    if (!this.isInitialized) {
      // Silently ignore delta before snapshot - normal on connection startup
      // this.logger.debug('Received delta before snapshot, ignoring', {
      //   symbol: this.symbol,
      // });
      return;
    }

    // Apply delta to bids and asks
    this.applyLevels(this.bidsMap, update.bids, true);
    this.applyLevels(this.asksMap, update.asks, false);

    this.lastUpdateId = update.updateId;
    this.lastSnapshotTime = Date.now();

    // Log periodically (1% of updates to avoid spam)
    /*if (Math.random() < 0.01) {
      this.logger.debug('Delta applied', {
        bidsCount: this.bidsMap.size,
        asksCount: this.asksMap.size,
        updateId: update.updateId,
      });
    }*/
  }

  /**
   * Apply price levels to map
   * Rules:
   * - size = 0 → delete level
   * - size > 0 → insert or update level
   *
   * Phase 8.9.18: ErrorHandler integration
   * - SKIP on NaN price/size (invalid data from WS)
   * - GRACEFUL_DEGRADE on WallTracker callback errors (continue processing other levels)
   */
  private applyLevels(
    map: Map<number, number>,
    levels: Array<[string, string]>,
    isBids: boolean = true,
  ): void {
    const side: 'BID' | 'ASK' = isBids ? 'BID' : 'ASK';

    for (const [priceStr, sizeStr] of levels) {
      const price = parseFloat(priceStr);
      const size = parseFloat(sizeStr);

      // Phase 8.9.18: Validate price and size (NaN check)
      if (isNaN(price) || isNaN(size)) {
        if (this.errorHandler) {
          const error = new Error(`Invalid level data: price=${priceStr}, size=${sizeStr}`);
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: `OrderbookManagerService.applyLevels.invalidLevel[${side}]`,
            onRecover: () => {
              this.logger.debug(`Skipped invalid level (${side})`, { price: priceStr, size: sizeStr });
            },
          });
        }
        continue; // Skip this level
      }

      if (size === 0) {
        // Delete level
        map.delete(price);

        // PHASE 4: Notify Wall Tracker (wall removed)
        // Phase 8.9.18: GRACEFUL_DEGRADE on WallTracker error
        if (this.wallTracker) {
          try {
            this.wallTracker.removeWall(price, side);
          } catch (error) {
            if (this.errorHandler) {
              this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
                context: 'OrderbookManagerService.applyLevels.wallTrackerRemoveWall',
                onRecover: () => {
                  this.logger.warn(`WallTracker removeWall failed (continuing)`, {
                    price,
                    side,
                    error: error instanceof Error ? error.message : String(error),
                  });
                },
              });
            }
            // Continue processing other levels despite wall tracker error
          }
        }
      } else {
        // Insert or update level
        map.set(price, size);

        // PHASE 4: Notify Wall Tracker (wall detected/updated)
        // Phase 8.9.18: GRACEFUL_DEGRADE on WallTracker error
        if (this.wallTracker) {
          try {
            this.wallTracker.detectWall(price, size, side);
          } catch (error) {
            if (this.errorHandler) {
              this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
                context: 'OrderbookManagerService.applyLevels.wallTrackerDetectWall',
                onRecover: () => {
                  this.logger.warn(`WallTracker detectWall failed (continuing)`, {
                    price,
                    size,
                    side,
                    error: error instanceof Error ? error.message : String(error),
                  });
                },
              });
            }
            // Continue processing other levels despite wall tracker error
          }
        }
      }
    }

    // Memory leak protection: trim if too large
    if (map.size > MAX_ORDERBOOK_LEVELS) {
      this.trimOrderbook(map, isBids);
    }
  }

  /**
   * Trim orderbook to prevent memory leaks
   * Keep only best N levels
   * For bids: keep highest prices
   * For asks: keep lowest prices
   */
  private trimOrderbook(map: Map<number, number>, isBids: boolean = true): void {
    if (map.size <= MAX_ORDERBOOK_LEVELS) {
      return;
    }

    // Convert to array and sort
    // Bids: descending (highest first), Asks: ascending (lowest first)
    const sorted = Array.from(map.entries()).sort((a, b) => {
      return isBids ? b[0] - a[0] : a[0] - b[0];
    });

    const toKeep = sorted.slice(0, MAX_ORDERBOOK_LEVELS);

    map.clear();
    for (const [price, size] of toKeep) {
      map.set(price, size);
    }

    this.logger.warn('Orderbook trimmed to prevent memory leak', {
      symbol: this.symbol,
      side: isBids ? 'bids' : 'asks',
      previousSize: sorted.length,
      newSize: map.size,
    });
  }

  /**
   * Get sorted bids (highest price first)
   */
  private getSortedBids(): OrderbookLevel[] {
    return Array.from(this.bidsMap.entries())
      .sort((a, b) => b[0] - a[0]) // Descending price
      .map(([price, size]) => ({ price, size }));
  }

  /**
   * Get sorted asks (lowest price first)
   */
  private getSortedAsks(): OrderbookLevel[] {
    return Array.from(this.asksMap.entries())
      .sort((a, b) => a[0] - b[0]) // Ascending price
      .map(([price, size]) => ({ price, size }));
  }
}
