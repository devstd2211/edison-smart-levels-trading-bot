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

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { WallTrackerService } from './wall-tracker.service';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';
import {
  createOrderbookSnapshot,
  getOrderbookSide,
  getOrderbookSnapshotAge,
  parseOrderbookLevel,
  trimOrderbookEntries,
  type OrderbookSide,
} from './orderbook-manager/orderbook-manager-state.utils';

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
      return;
    }

    this.handleDelta(update);
  }

  /**
   * Get a detached orderbook snapshot for observational reads.
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

    const staleAgeMs = getOrderbookSnapshotAge(
      this.lastSnapshotTime,
      Date.now(),
      SNAPSHOT_RESET_THRESHOLD_MS,
    );
    if (staleAgeMs !== null && !this.handleStaleSnapshot(staleAgeMs)) {
      return null;
    }

    return this.buildSnapshotCopy();
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
    this.logger.info(`[Orderbook] ${ICONS.chart} snapshot received`, {
      symbol: this.symbol,
      bids: update.bids.length,
      asks: update.asks.length,
      updateId: update.updateId,
    });

    this.replaceSnapshot(update);

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
      return;
    }

    this.applyDelta(update);
  }

  /**
   * Apply price levels to map
   * Rules:
   * - size = 0 -> delete level
   * - size > 0 -> insert or update level
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
    const side = getOrderbookSide(isBids);

    for (const [priceStr, sizeStr] of levels) {
      const parsedLevel = parseOrderbookLevel([priceStr, sizeStr]);

      if (!parsedLevel) {
        this.handleInvalidLevel(priceStr, sizeStr, side);
        continue;
      }

      const { price, size } = parsedLevel;
      if (size === 0) {
        this.removeLevel(map, price, side);
        continue;
      }

      this.upsertLevel(map, price, size, side);
    }

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

    const previousSize = map.size;
    const toKeep = trimOrderbookEntries(map.entries(), isBids, MAX_ORDERBOOK_LEVELS);
    map.clear();
    for (const [price, size] of toKeep) {
      map.set(price, size);
    }

    this.logger.warn('Orderbook trimmed to prevent memory leak', {
      symbol: this.symbol,
      side: isBids ? 'bids' : 'asks',
      previousSize,
      newSize: map.size,
    });
  }

  private buildSnapshotCopy(): OrderbookSnapshot {
    return createOrderbookSnapshot(
      this.bidsMap.entries(),
      this.asksMap.entries(),
      this.lastSnapshotTime,
      this.lastUpdateId,
    );
  }

  private replaceSnapshot(update: OrderbookUpdate): void {
    this.bidsMap.clear();
    this.asksMap.clear();
    this.applyLevels(this.bidsMap, update.bids, true);
    this.applyLevels(this.asksMap, update.asks, false);
    this.commitUpdate(update.updateId);
    this.isInitialized = true;
  }

  private applyDelta(update: OrderbookUpdate): void {
    this.applyLevels(this.bidsMap, update.bids, true);
    this.applyLevels(this.asksMap, update.asks, false);
    this.commitUpdate(update.updateId);
  }

  private commitUpdate(updateId: number): void {
    this.lastUpdateId = updateId;
    this.lastSnapshotTime = Date.now();
  }

  private handleInvalidLevel(priceStr: string, sizeStr: string, side: OrderbookSide): void {
    if (!this.errorHandler) {
      return;
    }

    const error = new Error(`Invalid level data: price=${priceStr}, size=${sizeStr}`);
    this.errorHandler.handle(error, {
      strategy: RecoveryStrategy.SKIP,
      context: `OrderbookManagerService.applyLevels.invalidLevel[${side}]`,
      onRecover: () => {
        this.logger.debug(`Skipped invalid level (${side})`, { price: priceStr, size: sizeStr });
      },
    });
  }

  private removeLevel(map: Map<number, number>, price: number, side: OrderbookSide): void {
    map.delete(price);
    this.notifyWallTracker(
      () => this.wallTracker?.removeWall(price, side),
      'OrderbookManagerService.applyLevels.wallTrackerRemoveWall',
      () => ({
        price,
        side,
      }),
      'WallTracker removeWall failed (continuing)',
    );
  }

  private upsertLevel(
    map: Map<number, number>,
    price: number,
    size: number,
    side: OrderbookSide,
  ): void {
    map.set(price, size);
    this.notifyWallTracker(
      () => this.wallTracker?.detectWall(price, size, side),
      'OrderbookManagerService.applyLevels.wallTrackerDetectWall',
      () => ({
        price,
        size,
        side,
      }),
      'WallTracker detectWall failed (continuing)',
    );
  }

  private notifyWallTracker(
    action: () => void,
    context: string,
    metadata: () => Record<string, number | string>,
    warning: string,
  ): void {
    if (!this.wallTracker) {
      return;
    }

    try {
      action();
    } catch (error) {
      if (!this.errorHandler) {
        return;
      }

      this.errorHandler.handle(error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context,
        onRecover: () => {
          this.logger.warn(warning, {
            ...metadata(),
            error: getErrorMessage(error),
          });
        },
      });
    }
  }

  private handleStaleSnapshot(ageMs: number): boolean {
    if (!this.errorHandler) {
      this.logger.warn('Orderbook snapshot is stale, waiting for new data', {
        symbol: this.symbol,
        ageMs,
      });
      return false;
    }

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
    return true;
  }
}
