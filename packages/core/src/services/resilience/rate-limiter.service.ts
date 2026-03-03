/**
 * Rate Limiter Service
 *
 * Adaptive rate limiting using token bucket algorithm:
 * - Smooth rate limiting with burst capacity
 * - Per-endpoint rate limits
 * - Queue management for excess requests
 * - Adaptive rate adjustment on 429 responses
 * - Metrics integration
 *
 * Phase 14.2.2
 */

import { LoggerService } from '../../types/legacy';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import type { ILifecycle } from '../../interfaces/ILifecycle';
import {
  DEFAULT_RATE_LIMIT_RPS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_BURST_SIZE,
  DEFAULT_RATE_LIMIT_QUEUE_SIZE,
  RATE_LIMIT_429_REDUCTION_FACTOR,
  RATE_LIMIT_RECOVERY_FACTOR,
  MIN_RATE_LIMIT_TOKENS,
  MAX_RATE_LIMITERS,
  TOKEN_REFILL_INTERVAL_MS,
} from '../../constants/phase-14-2-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum burst size (tokens in bucket) */
  burstSize: number;
  /** Queue size for excess requests */
  queueSize: number;
  /** Enable adaptive rate adjustment */
  adaptiveEnabled: boolean;
}

export interface TokenBucket {
  /** Current available tokens */
  tokens: number;
  /** Maximum tokens (burst capacity) */
  maxTokens: number;
  /** Last refill timestamp */
  lastRefill: number;
  /** Refill rate (tokens per second) */
  refillRate: number;
  /** Queue of waiting requests */
  queue: QueuedRequest[];
}

export interface QueuedRequest {
  /** Request ID */
  id: string;
  /** Number of tokens needed */
  tokens: number;
  /** Promise resolve callback */
  resolve: (value: boolean) => void;
  /** Promise reject callback */
  reject: (error: Error) => void;
  /** Timestamp when queued */
  queuedAt: number;
}

export interface RateLimiterStats {
  /** Current available tokens */
  tokens: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Current refill rate */
  refillRate: number;
  /** Queue size */
  queueSize: number;
  /** Total requests */
  totalRequests: number;
  /** Rejected requests */
  rejectedRequests: number;
  /** Queued requests */
  queuedRequests: number;
}

export class RateLimitExceededError extends Error {
  constructor(
    public key: string,
    public tokens: number,
    public available: number
  ) {
    super(`Rate limit exceeded for [${key}]: requested ${tokens}, available ${available}`);
    this.name = 'RateLimitExceededError';
  }
}

export class RateLimitQueueFullError extends Error {
  constructor(public key: string, public queueSize: number) {
    super(`Rate limiter queue full for [${key}]: ${queueSize} requests waiting`);
    this.name = 'RateLimitQueueFullError';
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class RateLimiterService implements ILifecycle {
  private readonly buckets: Map<string, TokenBucket>;
  private readonly config: RateLimiterConfig;
  private readonly stats: Map<string, RateLimiterStats>;
  private refillInterval?: NodeJS.Timeout;
  private started = false;

  constructor(
    config?: Partial<RateLimiterConfig>,
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    // Validate config OUTSIDE try-catch for THROW to propagate
    if (config?.maxRequests !== undefined && config.maxRequests <= 0) {
      throw new Error('maxRequests must be positive');
    }
    if (config?.windowMs !== undefined && config.windowMs <= 0) {
      throw new Error('windowMs must be positive');
    }
    if (config?.burstSize !== undefined && config.burstSize <= 0) {
      throw new Error('burstSize must be positive');
    }
    if (config?.queueSize !== undefined && config.queueSize < 0) {
      throw new Error('queueSize must be non-negative');
    }

    this.config = {
      maxRequests: config?.maxRequests ?? DEFAULT_RATE_LIMIT_RPS,
      windowMs: config?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
      burstSize: config?.burstSize ?? DEFAULT_RATE_LIMIT_BURST_SIZE,
      queueSize: config?.queueSize ?? DEFAULT_RATE_LIMIT_QUEUE_SIZE,
      adaptiveEnabled: config?.adaptiveEnabled ?? true,
    };

    this.buckets = new Map();
    this.stats = new Map();

    this.safeLog('info', 'RateLimiterService initialized', this.config);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Acquire tokens from rate limiter
   * @returns true if tokens acquired, false if rate limited
   */
  async acquire(key: string, tokens: number = 1): Promise<boolean> {
    // Validate input OUTSIDE try-catch for THROW to propagate
    if (!key || typeof key !== 'string') {
      throw new Error('Rate limiter key must be a non-empty string');
    }
    if (tokens <= 0) {
      throw new Error('Token count must be positive');
    }

    const bucket = this.getOrCreateBucket(key);
    const stats = this.getOrCreateStats(key);

    stats.totalRequests++;

    // Refill tokens
    this.refillTokens(bucket);

    // Check if enough tokens available
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.safeLog('debug', `Tokens acquired for [${key}]`, { tokens, remaining: bucket.tokens });
      return true;
    }

    // Not enough tokens - try to queue if enabled
    if (this.config.queueSize > 0 && bucket.queue.length < this.config.queueSize) {
      stats.queuedRequests++;
      return this.queueRequest(key, bucket, tokens);
    }

    // Queue full or disabled - reject
    stats.rejectedRequests++;
    this.safeLog('warn', `Rate limit exceeded for [${key}]`, { tokens, available: bucket.tokens });
    return false;
  }

  /**
   * Execute operation with rate limiting
   * @throws RateLimitExceededError if rate limit exceeded
   */
  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const acquired = await this.acquire(key);

    if (!acquired) {
      throw new RateLimitExceededError(key, 1, this.getRemainingTokens(key));
    }

    try {
      const result = await operation();

      // On success, gradually increase rate if adaptive enabled
      if (this.config.adaptiveEnabled) {
        this.adjustRate(key, RATE_LIMIT_RECOVERY_FACTOR);
      }

      return result;
    } catch (error: unknown) {
      // On 429 error, reduce rate if adaptive enabled
      if (this.config.adaptiveEnabled && this.is429Error(error)) {
        this.adjustRate(key, RATE_LIMIT_429_REDUCTION_FACTOR);
        this.safeLog('warn', `429 detected for [${key}], reducing rate`, { factor: RATE_LIMIT_429_REDUCTION_FACTOR });
      }

      throw error;
    }
  }

  /**
   * Get remaining tokens for key
   */
  getRemainingTokens(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.config.burstSize;

    this.refillTokens(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Get queue size for key
   */
  getQueueSize(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket?.queue.length ?? 0;
  }

  /**
   * Adjust rate by factor (for adaptive rate limiting)
   * Factor > 1: increase rate, Factor < 1: decrease rate
   */
  adjustRate(key: string, factor: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket) return;

    const newRate = bucket.refillRate * factor;
    const minRate = MIN_RATE_LIMIT_TOKENS / (this.config.windowMs / 1000);
    bucket.refillRate = Math.max(newRate, minRate);

    this.safeLog('debug', `Rate adjusted for [${key}]`, {
      factor,
      oldRate: bucket.refillRate / factor,
      newRate: bucket.refillRate
    });
  }

  /**
   * Get rate limiter statistics
   */
  getStats(key: string): RateLimiterStats | undefined {
    const bucket = this.buckets.get(key);
    const stats = this.stats.get(key);

    if (!bucket || !stats) return undefined;

    this.refillTokens(bucket);

    return {
      tokens: Math.floor(bucket.tokens),
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
      queueSize: bucket.queue.length,
      totalRequests: stats.totalRequests,
      rejectedRequests: stats.rejectedRequests,
      queuedRequests: stats.queuedRequests,
    };
  }

  /**
   * Get all rate limiter keys
   */
  getKeys(): string[] {
    return Array.from(this.buckets.keys());
  }

  /**
   * Get all rate limiter statistics (Phase 15.2: Added for ResilienceCoordinator)
   */
  getAllStats(): Record<string, { currentTokens: number; queueSize: number }> {
    const allStats: Record<string, { currentTokens: number; queueSize: number }> = {};
    for (const [key, bucket] of this.buckets.entries()) {
      this.refillTokens(bucket);
      allStats[key] = {
        currentTokens: Math.floor(bucket.tokens),
        queueSize: bucket.queue.length,
      };
    }
    return allStats;
  }

  /**
   * Clear all rate limiters (for testing)
   */
  clearAll(): void {
    this.buckets.clear();
    this.stats.clear();
    this.safeLog('info', 'All rate limiters cleared');
  }

  /**
   * Stop refill interval (for cleanup)
   */
  stop(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = undefined;
      this.safeLog('info', 'RateLimiterService stopped');
    }
    this.started = false;
  }

  /**
   * Start refill interval (lifecycle)
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startRefillInterval();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getOrCreateBucket(key: string): TokenBucket {
    if (!this.buckets.has(key)) {
      // Prevent memory leaks
      if (this.buckets.size >= MAX_RATE_LIMITERS) {
        this.safeLog('error', `Maximum rate limiters (${MAX_RATE_LIMITERS}) reached`);
        throw new Error(`Maximum rate limiters (${MAX_RATE_LIMITERS}) reached`);
      }

      const refillRate = this.config.maxRequests / (this.config.windowMs / 1000);

      this.buckets.set(key, {
        tokens: this.config.burstSize,
        maxTokens: this.config.burstSize,
        lastRefill: Date.now(),
        refillRate,
        queue: [],
      });

      this.safeLog('info', `Rate limiter [${key}] created`, { refillRate, maxTokens: this.config.burstSize });
    }

    return this.buckets.get(key)!;
  }

  private getOrCreateStats(key: string): RateLimiterStats {
    if (!this.stats.has(key)) {
      this.stats.set(key, {
        tokens: this.config.burstSize,
        maxTokens: this.config.burstSize,
        refillRate: this.config.maxRequests / (this.config.windowMs / 1000),
        queueSize: 0,
        totalRequests: 0,
        rejectedRequests: 0,
        queuedRequests: 0,
      });
    }

    return this.stats.get(key)!;
  }

  private refillTokens(bucket: TokenBucket): void {
    const now = Date.now();
    const timeSinceRefill = (now - bucket.lastRefill) / 1000; // Convert to seconds

    if (timeSinceRefill > 0) {
      const tokensToAdd = timeSinceRefill * bucket.refillRate;
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Process queue if tokens available
    this.processQueue(bucket);
  }

  private queueRequest(key: string, bucket: TokenBucket, tokens: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${key}-${Date.now()}-${Math.random()}`,
        tokens,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      bucket.queue.push(request);
      this.safeLog('debug', `Request queued for [${key}]`, { queueSize: bucket.queue.length });
    });
  }

  private processQueue(bucket: TokenBucket): void {
    while (bucket.queue.length > 0 && bucket.tokens >= bucket.queue[0].tokens) {
      const request = bucket.queue.shift()!;
      bucket.tokens -= request.tokens;
      request.resolve(true);
    }
  }

  private startRefillInterval(): void {
    if (this.refillInterval) {
      return;
    }
    this.refillInterval = setInterval(() => {
      for (const bucket of this.buckets.values()) {
        this.refillTokens(bucket);
      }
    }, TOKEN_REFILL_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (this.refillInterval.unref) {
      this.refillInterval.unref();
    }
  }

  private is429Error(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown };
      message?: unknown;
    };

    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return candidate.status === 429
      || candidate.statusCode === 429
      || candidate.response?.status === 429
      || message.includes('429')
      || message.toLowerCase().includes('rate limit');
  }

  private safeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
    try {
      if (this.logger) {
        this.logger[level](message, meta as Record<string, unknown> | undefined);
      }
    } catch (error) {
      // SKIP strategy: Logging failures should never block rate limiter operations
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
}
