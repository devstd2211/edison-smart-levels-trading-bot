/**
 * Retry Policy Service
 *
 * Advanced retry strategies with:
 * - Exponential backoff with jitter
 * - Retry budget to prevent retry storms
 * - Conditional retry based on error type
 * - Integration with circuit breaker and rate limiter
 *
 * Phase 14.2.3
 */

import { LoggerService } from '../../types';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  DEFAULT_MAX_RETRY_ATTEMPTS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_EXPONENTIAL_BASE,
  DEFAULT_RETRY_JITTER_FACTOR,
  DEFAULT_RETRY_BUDGET_PERCENT,
  RETRY_BUDGET_RESET_INTERVAL_MS,
  MIN_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  TRANSIENT_ERROR_CODES,
  RETRYABLE_HTTP_STATUS_CODES,
  NON_RETRYABLE_HTTP_STATUS_CODES,
} from '../../constants/phase-14-2-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface RetryPolicyConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Exponential backoff base (delay multiplier) */
  exponentialBase: number;
  /** Enable jitter (randomness) */
  jitterEnabled: boolean;
  /** Retry budget percentage (0-1) */
  retryBudgetPercent: number;
}

export interface RetryStats {
  /** Total operations attempted */
  totalOperations: number;
  /** Operations that succeeded */
  successfulOperations: number;
  /** Operations that failed */
  failedOperations: number;
  /** Total retry attempts */
  totalRetries: number;
  /** Current retry budget usage */
  budgetUsage: number;
  /** Maximum allowed retries (budget) */
  budgetLimit: number;
}

export class RetryBudgetExceededError extends Error {
  constructor(
    public budgetUsage: number,
    public budgetLimit: number
  ) {
    super(`Retry budget exceeded: ${budgetUsage}/${budgetLimit} retries used`);
    this.name = 'RetryBudgetExceededError';
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(
    public attempts: number,
    public maxAttempts: number,
    public lastError: Error
  ) {
    super(`Max retries (${maxAttempts}) exceeded after ${attempts} attempts: ${lastError.message}`);
    this.name = 'MaxRetriesExceededError';
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class RetryPolicyService {
  private readonly config: RetryPolicyConfig;
  private stats: RetryStats;
  private budgetResetInterval?: NodeJS.Timeout;

  constructor(
    config?: Partial<RetryPolicyConfig>,
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    // Validate config OUTSIDE try-catch for THROW to propagate
    if (config?.maxAttempts !== undefined && config.maxAttempts < 0) {
      throw new Error('maxAttempts must be non-negative');
    }
    if (config?.baseDelayMs !== undefined && config.baseDelayMs < 0) {
      throw new Error('baseDelayMs must be non-negative');
    }
    if (config?.maxDelayMs !== undefined && config.maxDelayMs < 0) {
      throw new Error('maxDelayMs must be non-negative');
    }
    if (config?.exponentialBase !== undefined && config.exponentialBase <= 0) {
      throw new Error('exponentialBase must be positive');
    }
    if (config?.retryBudgetPercent !== undefined && (config.retryBudgetPercent < 0 || config.retryBudgetPercent > 1)) {
      throw new Error('retryBudgetPercent must be between 0 and 1');
    }

    this.config = {
      maxAttempts: config?.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS,
      baseDelayMs: config?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: config?.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
      exponentialBase: config?.exponentialBase ?? DEFAULT_RETRY_EXPONENTIAL_BASE,
      jitterEnabled: config?.jitterEnabled ?? true,
      retryBudgetPercent: config?.retryBudgetPercent ?? DEFAULT_RETRY_BUDGET_PERCENT,
    };

    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      budgetUsage: 0,
      budgetLimit: 0,
    };

    // Start budget reset interval
    this.startBudgetResetInterval();

    this.safeLog('info', 'RetryPolicyService initialized', this.config);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Execute operation with retry policy
   * @throws RetryBudgetExceededError if retry budget exceeded
   * @throws MaxRetriesExceededError if max retries exceeded
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryPolicyConfig>
  ): Promise<T> {
    const effectiveConfig = { ...this.config, ...config };
    this.stats.totalOperations++;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= effectiveConfig.maxAttempts) {
      try {
        const result = await operation();
        this.stats.successfulOperations++;

        if (attempt > 0) {
          this.safeLog('info', `Operation succeeded after ${attempt} retries`);
        }

        return result;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Check if should retry
        if (attempt > effectiveConfig.maxAttempts) {
          this.stats.failedOperations++;
          throw new MaxRetriesExceededError(attempt, effectiveConfig.maxAttempts, lastError);
        }

        // Check retry budget
        if (!this.canRetry()) {
          this.stats.failedOperations++;
          throw new RetryBudgetExceededError(this.stats.budgetUsage, this.stats.budgetLimit);
        }

        // Check if error is retryable
        if (!this.shouldRetry(lastError, attempt)) {
          this.stats.failedOperations++;
          throw lastError;
        }

        // Consume retry budget
        this.stats.totalRetries++;
        this.stats.budgetUsage++;

        // Calculate backoff delay
        const delay = this.getBackoffDelay(attempt, effectiveConfig.baseDelayMs, effectiveConfig);

        this.safeLog('warn', `Retry attempt ${attempt}/${effectiveConfig.maxAttempts}`, {
          error: lastError.message,
          delayMs: delay,
          budgetUsage: this.stats.budgetUsage,
        });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // Should never reach here
    this.stats.failedOperations++;
    throw new MaxRetriesExceededError(attempt, effectiveConfig.maxAttempts, lastError!);
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(error: Error, attempt: number): boolean {
    // Check for transient error codes (network errors)
    if (this.isTransientError(error)) {
      return true;
    }

    // Check for retryable HTTP status codes
    if (this.isRetryableHttpError(error)) {
      return true;
    }

    // Check for non-retryable HTTP status codes (client errors)
    if (this.isNonRetryableHttpError(error)) {
      return false;
    }

    // Default: retry all errors unless explicitly marked as non-retryable
    return true;
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   */
  getBackoffDelay(
    attempt: number,
    baseDelay: number = this.config.baseDelayMs,
    config?: Partial<RetryPolicyConfig>
  ): number {
    const effectiveConfig = { ...this.config, ...config };

    // Exponential backoff: baseDelay * (exponentialBase ^ (attempt - 1))
    let delay = baseDelay * Math.pow(effectiveConfig.exponentialBase, attempt - 1);

    // Add jitter if enabled
    if (effectiveConfig.jitterEnabled) {
      const jitterFactor = DEFAULT_RETRY_JITTER_FACTOR;
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1); // ±jitter%
      delay += jitter;
    }

    // Clamp to min/max
    delay = Math.max(MIN_RETRY_DELAY_MS, delay);
    delay = Math.min(effectiveConfig.maxDelayMs, delay);
    delay = Math.min(MAX_RETRY_DELAY_MS, delay);

    return Math.floor(delay);
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    // Update budget limit before returning stats
    this.updateBudgetLimit();
    return { ...this.stats };
  }

  /**
   * Get retry budget usage (absolute count)
   */
  getBudgetUsage(): number {
    return this.stats.budgetUsage;
  }

  /**
   * Get retry budget usage ratio (0-1)
   */
  getBudgetUsageRatio(): number {
    if (this.stats.budgetLimit === 0) return 0;
    return this.stats.budgetUsage / this.stats.budgetLimit;
  }

  /**
   * Reset retry budget
   */
  resetBudget(): void {
    this.stats.budgetUsage = 0;
    this.updateBudgetLimit();
    this.safeLog('debug', 'Retry budget reset', {
      budgetLimit: this.stats.budgetLimit,
      totalOperations: this.stats.totalOperations,
    });
  }

  /**
   * Stop budget reset interval (for cleanup)
   */
  stop(): void {
    if (this.budgetResetInterval) {
      clearInterval(this.budgetResetInterval);
      this.budgetResetInterval = undefined;
      this.safeLog('info', 'RetryPolicyService stopped');
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private canRetry(): boolean {
    this.updateBudgetLimit();

    // If budget limit is 0 (not enough operations yet), allow limited retries
    if (this.stats.budgetLimit === 0) {
      // Allow up to 3 retries when budget not established
      return this.stats.budgetUsage < 3;
    }

    // Normal budget enforcement
    return this.stats.budgetUsage < this.stats.budgetLimit;
  }

  private updateBudgetLimit(): void {
    // Budget limit = retryBudgetPercent * totalOperations
    this.stats.budgetLimit = Math.floor(this.stats.totalOperations * this.config.retryBudgetPercent);
  }

  private isTransientError(error: Error): boolean {
    const errorCode = (error as any).code;
    return TRANSIENT_ERROR_CODES.includes(errorCode);
  }

  private isRetryableHttpError(error: Error): boolean {
    const status = this.getHttpStatus(error);
    return status !== null && RETRYABLE_HTTP_STATUS_CODES.includes(status);
  }

  private isNonRetryableHttpError(error: Error): boolean {
    const status = this.getHttpStatus(error);
    return status !== null && NON_RETRYABLE_HTTP_STATUS_CODES.includes(status);
  }

  private getHttpStatus(error: any): number | null {
    return error?.status ?? error?.statusCode ?? error?.response?.status ?? null;
  }

  private startBudgetResetInterval(): void {
    this.budgetResetInterval = setInterval(() => {
      this.resetBudget();
    }, RETRY_BUDGET_RESET_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (this.budgetResetInterval.unref) {
      this.budgetResetInterval.unref();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private safeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
    try {
      if (this.logger) {
        this.logger[level](message, meta as Record<string, unknown> | undefined);
      }
    } catch (error) {
      // SKIP strategy: Logging failures should never block retry operations
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
}
