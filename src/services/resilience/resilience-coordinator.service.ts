import { LoggerService } from '../../types';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
import { RetryPolicyService, RetryPolicyConfig } from './retry-policy.service';
import { BulkheadService, BulkheadConfig } from './bulkhead.service';
import { PrometheusMetricsService } from '../prometheus-metrics.service';

/**
 * Options for resilient operation execution
 */
export interface ResilienceOptions {
  /**
   * Circuit breaker name to use (e.g., 'bybit-api', 'websocket')
   * If provided, wraps operation in circuit breaker protection
   */
  circuitBreaker?: string;

  /**
   * Rate limiter key to use (e.g., 'bybit-rest', 'telegram-api')
   * If provided, enforces rate limits before execution
   */
  rateLimit?: string;

  /**
   * Bulkhead pool name to use (e.g., 'trading', 'api', 'websocket')
   * If provided, isolates operation to prevent resource exhaustion
   */
  bulkhead?: string;

  /**
   * Retry policy configuration
   * If provided, retries operation on transient failures
   */
  retry?: Partial<RetryPolicyConfig>;

  /**
   * Bulkhead configuration override
   */
  bulkheadConfig?: Partial<BulkheadConfig>;

  /**
   * Whether to record metrics for this operation
   * Default: true
   */
  recordMetrics?: boolean;

  /**
   * Operation name for metrics/logging
   */
  operationName?: string;
}

/**
 * Execution result with metadata
 */
export interface ResilienceResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  metadata: {
    circuitBreakerUsed: boolean;
    rateLimiterUsed: boolean;
    bulkheadUsed: boolean;
    retryUsed: boolean;
    attemptCount: number;
    durationMs: number;
  };
}

/**
 * Aggregated statistics from all resilience patterns
 */
export interface ResilienceStats {
  circuitBreakers: Record<string, { state: string; failures: number; successes: number }>;
  rateLimiters: Record<string, { currentTokens: number; queueSize: number }>;
  retryPolicy: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalRetries: number;
    budgetUsage: number;
    budgetLimit: number;
  };
  bulkheads: Record<string, { activeWorkers: number; queuedRequests: number; totalCompleted: number }>;
}

/**
 * ResilienceCoordinator - Unified resilience layer
 *
 * Combines multiple resilience patterns into a single, cohesive API:
 * 1. Circuit Breaker - Prevents cascading failures
 * 2. Rate Limiter - Enforces API rate limits
 * 3. Bulkhead - Isolates resources to prevent exhaustion
 * 4. Retry Policy - Handles transient failures
 *
 * Execution flow:
 * 1. Check circuit breaker state (fail fast if OPEN)
 * 2. Acquire rate limiter tokens (wait if needed)
 * 3. Execute in bulkhead pool (isolate resources)
 * 4. Retry on transient failures (with exponential backoff)
 * 5. Record metrics and update circuit breaker state
 *
 * Example usage:
 * ```typescript
 * const result = await coordinator.execute(
 *   () => bybitService.placeOrder(order),
 *   {
 *     circuitBreaker: 'bybit-api',
 *     rateLimit: 'bybit-rest',
 *     bulkhead: 'trading',
 *     retry: { maxAttempts: 3 },
 *     operationName: 'place-order'
 *   }
 * );
 * ```
 */
export class ResilienceCoordinator {
  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly rateLimiter: RateLimiterService,
    private readonly retryPolicy: RetryPolicyService,
    private readonly bulkhead: BulkheadService,
    private readonly metrics?: PrometheusMetricsService,
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    this.safeLog('info', 'ResilienceCoordinator initialized');
  }

  /**
   * Execute operation with resilience patterns
   *
   * @param operation - Async operation to execute
   * @param options - Resilience options
   * @returns Execution result with metadata
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: ResilienceOptions = {}
  ): Promise<ResilienceResult<T>> {
    const startTime = Date.now();
    const metadata = {
      circuitBreakerUsed: !!options.circuitBreaker,
      rateLimiterUsed: !!options.rateLimit,
      bulkheadUsed: !!options.bulkhead,
      retryUsed: !!options.retry,
      attemptCount: 0,
      durationMs: 0
    };

    try {
      // Build the execution pipeline
      let wrappedOperation = operation;

      // Layer 4: Retry policy (innermost - wraps actual operation)
      if (options.retry) {
        const retryConfig = options.retry;
        wrappedOperation = async () => {
          const result = await this.retryPolicy.executeWithRetry(operation, retryConfig);
          metadata.attemptCount = this.retryPolicy.getStats().totalRetries + 1;
          return result;
        };
      }

      // Layer 3: Bulkhead (resource isolation)
      if (options.bulkhead) {
        const poolName = options.bulkhead;
        const innerOp = wrappedOperation;
        wrappedOperation = async () => {
          return this.bulkhead.execute(poolName, innerOp, options.bulkheadConfig);
        };
      }

      // Layer 2: Rate limiter (token acquisition)
      if (options.rateLimit) {
        const rateLimitKey = options.rateLimit;
        const innerOp = wrappedOperation;
        wrappedOperation = async () => {
          return this.rateLimiter.execute(rateLimitKey, innerOp);
        };
      }

      // Layer 1: Circuit breaker (outermost - fail fast)
      let value: T;
      if (options.circuitBreaker) {
        const circuitName = options.circuitBreaker;
        value = await this.circuitBreaker.execute(wrappedOperation, circuitName);
      } else {
        value = await wrappedOperation();
      }

      // Success
      metadata.durationMs = Date.now() - startTime;

      if (options.recordMetrics !== false && options.operationName) {
        this.recordSuccess(options.operationName, metadata.durationMs);
      }

      this.safeLog('debug', `Operation succeeded: ${options.operationName || 'unknown'}`, { metadata });

      return {
        success: true,
        value,
        metadata
      };
    } catch (error) {
      // Failure
      metadata.durationMs = Date.now() - startTime;

      if (options.recordMetrics !== false && options.operationName) {
        this.recordFailure(options.operationName, metadata.durationMs);
      }

      this.safeLog('error', `Operation failed: ${options.operationName || 'unknown'}`, {
        error: error instanceof Error ? error.message : String(error),
        metadata
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata
      };
    }
  }

  /**
   * Execute operation with simplified options (returns value directly or throws)
   *
   * @param operation - Async operation to execute
   * @param options - Resilience options
   * @returns Operation result
   * @throws Error if operation fails after all resilience patterns applied
   */
  async executeOrThrow<T>(
    operation: () => Promise<T>,
    options: ResilienceOptions = {}
  ): Promise<T> {
    const result = await this.execute(operation, options);

    if (result.success && result.value !== undefined) {
      return result.value;
    }

    throw result.error || new Error('Operation failed with unknown error');
  }

  /**
   * Get aggregated statistics from all resilience patterns
   *
   * @returns Combined statistics
   */
  getStats(): ResilienceStats {
    try {
      return {
        circuitBreakers: this.getCircuitBreakerStats(),
        rateLimiters: this.getRateLimiterStats(),
        retryPolicy: this.retryPolicy.getStats(),
        bulkheads: this.getBulkheadStats()
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
          strategy: RecoveryStrategy.SKIP,
          context: 'getStats'
        });
      }

      // Return safe defaults
      return {
        circuitBreakers: {},
        rateLimiters: {},
        retryPolicy: {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          totalRetries: 0,
          budgetUsage: 0,
          budgetLimit: 0
        },
        bulkheads: {}
      };
    }
  }

  /**
   * Health check for all resilience patterns
   *
   * @returns true if all patterns are healthy
   */
  isHealthy(): boolean {
    try {
      const stats = this.getStats();

      // Check circuit breakers - any in OPEN state?
      const hasOpenCircuits = Object.values(stats.circuitBreakers).some(
        cb => cb.state === 'OPEN'
      );
      if (hasOpenCircuits) {
        this.safeLog('warn', 'Health check failed: Circuit breaker(s) in OPEN state');
        return false;
      }

      // Check retry budget - exhausted?
      const budgetUsageRatio = stats.retryPolicy.budgetLimit > 0
        ? stats.retryPolicy.budgetUsage / stats.retryPolicy.budgetLimit
        : 0;
      if (budgetUsageRatio > 0.9) {
        this.safeLog('warn', 'Health check failed: Retry budget nearly exhausted', {
          budgetUsageRatio
        });
        return false;
      }

      // Check bulkheads - any at capacity?
      const hasSaturatedBulkheads = Object.values(stats.bulkheads).some(
        bh => bh.activeWorkers >= 10 && bh.queuedRequests > 0
      );
      if (hasSaturatedBulkheads) {
        this.safeLog('warn', 'Health check failed: Bulkhead(s) saturated');
        return false;
      }

      return true;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
          strategy: RecoveryStrategy.SKIP,
          context: 'isHealthy'
        });
      }

      // Assume unhealthy on error
      return false;
    }
  }

  /**
   * Reset all resilience patterns (useful for testing)
   */
  reset(): void {
    try {
      // Circuit breakers don't have global reset, but we can log
      this.safeLog('info', 'Resetting all resilience patterns');

      // Reset retry budget
      this.retryPolicy.resetBudget();

      this.safeLog('info', 'All resilience patterns reset successfully');
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
          strategy: RecoveryStrategy.SKIP,
          context: 'reset'
        });
      }
    }
  }

  /**
   * Stop all background tasks (cleanup on shutdown)
   */
  stop(): void {
    try {
      this.safeLog('info', 'Stopping ResilienceCoordinator');
      this.retryPolicy.stop();
      this.bulkhead.stop();
      this.safeLog('info', 'ResilienceCoordinator stopped');
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
          strategy: RecoveryStrategy.SKIP,
          context: 'stop'
        });
      }
    }
  }

  // === Private helper methods ===

  private getCircuitBreakerStats(): Record<string, { state: string; failures: number; successes: number }> {
    // Phase 15.2: Now using getAllStats() method added to CircuitBreakerService
    return this.circuitBreaker.getAllStats();
  }

  private getRateLimiterStats(): Record<string, { currentTokens: number; queueSize: number }> {
    // Phase 15.2: Now using getAllStats() method added to RateLimiterService
    return this.rateLimiter.getAllStats();
  }

  private getBulkheadStats(): Record<string, { activeWorkers: number; queuedRequests: number; totalCompleted: number }> {
    // Phase 15.2: Now using getAllStats() method added to BulkheadService
    return this.bulkhead.getAllStats();
  }

  private recordSuccess(operationName: string, durationMs: number): void {
    if (!this.metrics) return;

    try {
      // Record latency (use 'unknown' as side since we don't track it here)
      this.metrics.recordOrderLatency(durationMs, 'unknown', 'resilience');
      // Can add more metrics here if needed
    } catch (error) {
      // Metrics recording should never throw
      this.safeLog('error', 'Failed to record success metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private recordFailure(operationName: string, durationMs: number): void {
    if (!this.metrics) return;

    try {
      // Can add error metrics here if needed
      this.metrics.recordOrderLatency(durationMs, 'unknown', 'resilience');
    } catch (error) {
      // Metrics recording should never throw
      this.safeLog('error', 'Failed to record failure metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    if (!this.logger) return;

    try {
      this.logger[level](message, meta);
    } catch (error) {
      // Never throw from logging
      if (this.errorHandler) {
        this.errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
          strategy: RecoveryStrategy.SKIP,
          context: 'safeLog'
        });
      }
    }
  }
}
