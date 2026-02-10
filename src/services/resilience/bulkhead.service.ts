/**
 * Bulkhead Service
 *
 * Resource isolation pattern to prevent cascading failures:
 * - Separate resource pools per service (API, WebSocket, etc.)
 * - Configurable max concurrent operations + queue size
 * - Rejection policies: FAIL_FAST, QUEUE, TIMEOUT
 * - Metrics: active workers, queued requests, rejections
 * - Timeout management for queued operations
 *
 * Phase 14.2.4
 */

import { LoggerService } from '../../types';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  DEFAULT_BULKHEAD_MAX_CONCURRENT,
  DEFAULT_BULKHEAD_QUEUE_SIZE,
  DEFAULT_BULKHEAD_TIMEOUT_MS,
  MAX_BULKHEADS,
  BULKHEAD_QUEUE_CHECK_INTERVAL_MS,
  BULKHEAD_REJECT_FAIL_FAST,
  BULKHEAD_REJECT_QUEUE,
  BULKHEAD_REJECT_TIMEOUT,
} from '../../constants/phase-14-2-constants';

// ============================================================================
// TYPES
// ============================================================================

export type RejectPolicy = 'FAIL_FAST' | 'QUEUE' | 'TIMEOUT';

export interface BulkheadConfig {
  /** Maximum concurrent operations */
  maxConcurrent: number;
  /** Queue size for excess operations */
  queueSize: number;
  /** Timeout for queued operations (ms) */
  timeoutMs: number;
  /** Rejection policy when pool full */
  rejectPolicy: RejectPolicy;
}

export interface BulkheadStats {
  /** Active workers count */
  activeWorkers: number;
  /** Queued requests count */
  queuedRequests: number;
  /** Total completed operations */
  totalCompleted: number;
  /** Total rejected operations */
  totalRejected: number;
  /** Total timed out operations */
  totalTimedOut: number;
}

interface QueuedOperation<T> {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  timeoutId?: NodeJS.Timeout;
}

interface ResourcePool {
  config: BulkheadConfig;
  activeWorkers: number;
  queue: QueuedOperation<any>[];
  stats: BulkheadStats;
}

export class BulkheadRejectedException extends Error {
  constructor(
    public poolName: string,
    public reason: string
  ) {
    super(`Bulkhead rejected operation for pool "${poolName}": ${reason}`);
    this.name = 'BulkheadRejectedException';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(
    public poolName: string,
    public timeoutMs: number
  ) {
    super(`Bulkhead timeout after ${timeoutMs}ms for pool "${poolName}"`);
    this.name = 'BulkheadTimeoutError';
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class BulkheadService {
  private readonly pools = new Map<string, ResourcePool>();
  private readonly queueCheckInterval?: NodeJS.Timeout;

  constructor(
    private readonly defaultConfig?: Partial<BulkheadConfig>,
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    // Validate config OUTSIDE try-catch for THROW to propagate
    if (defaultConfig?.maxConcurrent !== undefined && defaultConfig.maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be positive');
    }
    if (defaultConfig?.queueSize !== undefined && defaultConfig.queueSize < 0) {
      throw new Error('queueSize must be non-negative');
    }
    if (defaultConfig?.timeoutMs !== undefined && defaultConfig.timeoutMs < 0) {
      throw new Error('timeoutMs must be non-negative');
    }

    // Start queue timeout checker
    this.startQueueChecker();

    this.safeLog('info', 'BulkheadService initialized', { defaultConfig });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Execute operation within a bulkhead
   * @throws BulkheadRejectedException if rejected based on policy
   * @throws BulkheadTimeoutError if operation times out in queue
   */
  async execute<T>(
    poolName: string,
    operation: () => Promise<T>,
    config?: Partial<BulkheadConfig>
  ): Promise<T> {
    const pool = this.getOrCreatePool(poolName, config);

    // Check if can execute immediately
    if (pool.activeWorkers < pool.config.maxConcurrent) {
      return this.executeImmediately(pool, operation);
    }

    // Pool is full - apply rejection policy
    return this.handlePoolFull(pool, poolName, operation);
  }

  /**
   * Get active workers count for a pool
   */
  getActiveWorkers(poolName: string): number {
    const pool = this.pools.get(poolName);
    return pool?.activeWorkers ?? 0;
  }

  /**
   * Get queued requests count for a pool
   */
  getQueueSize(poolName: string): number {
    const pool = this.pools.get(poolName);
    return pool?.queue.length ?? 0;
  }

  /**
   * Get pool statistics
   */
  getStats(poolName: string): BulkheadStats | null {
    const pool = this.pools.get(poolName);
    if (!pool) return null;
    return { ...pool.stats };
  }

  /**
   * Get all pool statistics (Phase 15.2: Added for ResilienceCoordinator)
   */
  getAllStats(): Record<string, { activeWorkers: number; queuedRequests: number; totalCompleted: number }> {
    const allStats: Record<string, { activeWorkers: number; queuedRequests: number; totalCompleted: number }> = {};
    for (const [poolName, pool] of this.pools.entries()) {
      allStats[poolName] = {
        activeWorkers: pool.stats.activeWorkers,
        queuedRequests: pool.stats.queuedRequests,
        totalCompleted: pool.stats.totalCompleted,
      };
    }
    return allStats;
  }

  /**
   * Reset a pool (clear queue, reset stats)
   */
  reset(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    // Cancel all queued operations
    pool.queue.forEach(op => {
      if (op.timeoutId) clearTimeout(op.timeoutId);
      op.reject(new BulkheadRejectedException(poolName, 'Pool reset'));
    });

    pool.queue = [];
    pool.activeWorkers = 0;
    pool.stats.activeWorkers = 0;
    pool.stats.queuedRequests = 0;

    this.safeLog('info', `Pool "${poolName}" reset`);
  }

  /**
   * Remove a pool completely
   */
  removePool(poolName: string): void {
    this.reset(poolName);
    this.pools.delete(poolName);
    this.safeLog('info', `Pool "${poolName}" removed`);
  }

  /**
   * Stop queue checker (for cleanup)
   */
  stop(): void {
    if (this.queueCheckInterval) {
      clearInterval(this.queueCheckInterval);
      this.safeLog('info', 'BulkheadService stopped');
    }

    // Clean up all pools
    for (const poolName of this.pools.keys()) {
      this.reset(poolName);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getOrCreatePool(poolName: string, config?: Partial<BulkheadConfig>): ResourcePool {
    let pool = this.pools.get(poolName);

    if (!pool) {
      // Check max pools limit
      if (this.pools.size >= MAX_BULKHEADS) {
        throw new Error(`Cannot create pool "${poolName}": max bulkheads (${MAX_BULKHEADS}) reached`);
      }

      const effectiveConfig: BulkheadConfig = {
        maxConcurrent: config?.maxConcurrent ?? this.defaultConfig?.maxConcurrent ?? DEFAULT_BULKHEAD_MAX_CONCURRENT,
        queueSize: config?.queueSize ?? this.defaultConfig?.queueSize ?? DEFAULT_BULKHEAD_QUEUE_SIZE,
        timeoutMs: config?.timeoutMs ?? this.defaultConfig?.timeoutMs ?? DEFAULT_BULKHEAD_TIMEOUT_MS,
        rejectPolicy: config?.rejectPolicy ?? this.defaultConfig?.rejectPolicy ?? BULKHEAD_REJECT_QUEUE as RejectPolicy,
      };

      pool = {
        config: effectiveConfig,
        activeWorkers: 0,
        queue: [],
        stats: {
          activeWorkers: 0,
          queuedRequests: 0,
          totalCompleted: 0,
          totalRejected: 0,
          totalTimedOut: 0,
        },
      };

      this.pools.set(poolName, pool);
      this.safeLog('info', `Pool "${poolName}" created`, effectiveConfig);
    }

    return pool;
  }

  private async executeImmediately<T>(pool: ResourcePool, operation: () => Promise<T>): Promise<T> {
    pool.activeWorkers++;
    pool.stats.activeWorkers = pool.activeWorkers;

    try {
      const result = await operation();
      pool.stats.totalCompleted++;
      return result;
    } finally {
      pool.activeWorkers--;
      pool.stats.activeWorkers = pool.activeWorkers;

      // Process next queued operation
      this.processQueue(pool);
    }
  }

  private async handlePoolFull<T>(
    pool: ResourcePool,
    poolName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const policy = pool.config.rejectPolicy;

    if (policy === BULKHEAD_REJECT_FAIL_FAST) {
      pool.stats.totalRejected++;
      throw new BulkheadRejectedException(
        poolName,
        `Pool full (${pool.activeWorkers}/${pool.config.maxConcurrent}), FAIL_FAST policy`
      );
    }

    // QUEUE or TIMEOUT policy
    if (pool.queue.length >= pool.config.queueSize) {
      pool.stats.totalRejected++;
      throw new BulkheadRejectedException(
        poolName,
        `Queue full (${pool.queue.length}/${pool.config.queueSize})`
      );
    }

    // Enqueue operation
    return this.enqueueOperation(pool, poolName, operation);
  }

  private enqueueOperation<T>(
    pool: ResourcePool,
    poolName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedOp: QueuedOperation<T> = {
        operation,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      // Set timeout if TIMEOUT policy
      if (pool.config.rejectPolicy === BULKHEAD_REJECT_TIMEOUT) {
        queuedOp.timeoutId = setTimeout(() => {
          this.handleQueueTimeout(pool, poolName, queuedOp);
        }, pool.config.timeoutMs);
      }

      pool.queue.push(queuedOp);
      pool.stats.queuedRequests = pool.queue.length;

      this.safeLog('debug', `Operation queued for pool "${poolName}"`, {
        queueSize: pool.queue.length,
        activeWorkers: pool.activeWorkers,
      });
    });
  }

  private async processQueue(pool: ResourcePool): Promise<void> {
    // Check if can process next operation
    if (pool.activeWorkers >= pool.config.maxConcurrent) {
      return;
    }

    const queuedOp = pool.queue.shift();
    if (!queuedOp) return;

    pool.stats.queuedRequests = pool.queue.length;

    // Clear timeout if set
    if (queuedOp.timeoutId) {
      clearTimeout(queuedOp.timeoutId);
    }

    // Execute the operation
    pool.activeWorkers++;
    pool.stats.activeWorkers = pool.activeWorkers;

    try {
      const result = await queuedOp.operation();
      pool.stats.totalCompleted++;
      queuedOp.resolve(result);
    } catch (error: any) {
      queuedOp.reject(error);
    } finally {
      pool.activeWorkers--;
      pool.stats.activeWorkers = pool.activeWorkers;

      // Process next queued operation
      this.processQueue(pool);
    }
  }

  private handleQueueTimeout<T>(
    pool: ResourcePool,
    poolName: string,
    queuedOp: QueuedOperation<T>
  ): void {
    // Remove from queue
    const index = pool.queue.indexOf(queuedOp);
    if (index !== -1) {
      pool.queue.splice(index, 1);
      pool.stats.queuedRequests = pool.queue.length;
      pool.stats.totalTimedOut++;

      const error = new BulkheadTimeoutError(poolName, pool.config.timeoutMs);
      queuedOp.reject(error);

      this.safeLog('warn', `Operation timed out in queue for pool "${poolName}"`, {
        timeoutMs: pool.config.timeoutMs,
        queueSize: pool.queue.length,
      });
    }
  }

  private startQueueChecker(): void {
    // Check queues periodically for timeouts (belt and suspenders approach)
    const interval = setInterval(() => {
      for (const [poolName, pool] of this.pools.entries()) {
        if (pool.config.rejectPolicy !== BULKHEAD_REJECT_TIMEOUT) continue;

        const now = Date.now();
        const timeoutMs = pool.config.timeoutMs;

        // Check for timed-out operations
        const timedOut = pool.queue.filter(op => now - op.enqueuedAt > timeoutMs);
        timedOut.forEach(op => this.handleQueueTimeout(pool, poolName, op));
      }
    }, BULKHEAD_QUEUE_CHECK_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (interval.unref) {
      interval.unref();
    }

    (this as any).queueCheckInterval = interval;
  }

  private safeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
    try {
      if (this.logger) {
        this.logger[level](message, meta as Record<string, unknown> | undefined);
      }
    } catch (error) {
      // SKIP strategy: Logging failures should never block bulkhead operations
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
}
