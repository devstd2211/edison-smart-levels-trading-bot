import type { BulkheadConfig } from '../../resilience/bulkhead.service';
import type { CircuitBreakerConfig } from '../../resilience/circuit-breaker.service';
import type { RateLimiterConfig } from '../../resilience/rate-limiter.service';
import type { RetryPolicyConfig } from '../../resilience/retry-policy.service';
import type { ResilienceConfig } from './bot-services.types';

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  successThreshold: 2,
  timeout: 60000,
  volumeThreshold: 10,
};

const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 10,
  windowMs: 1000,
  burstSize: 15,
  queueSize: 50,
  adaptiveEnabled: true,
};

const DEFAULT_RETRY_POLICY_CONFIG: RetryPolicyConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  exponentialBase: 2,
  jitterEnabled: true,
  retryBudgetPercent: 10,
};

const DEFAULT_BULKHEAD_CONFIG: BulkheadConfig = {
  maxConcurrent: 10,
  queueSize: 20,
  timeoutMs: 5000,
  rejectPolicy: 'QUEUE',
};

export const createCircuitBreakerConfig = (
  resilience?: ResilienceConfig,
): Partial<CircuitBreakerConfig> => ({
  ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
  ...resilience?.circuitBreaker,
});

export const createRateLimiterConfig = (
  resilience?: ResilienceConfig,
): Partial<RateLimiterConfig> => ({
  ...DEFAULT_RATE_LIMITER_CONFIG,
  ...resilience?.rateLimiter?.bybit,
});

export const createRetryPolicyConfig = (
  resilience?: ResilienceConfig,
): Partial<RetryPolicyConfig> => ({
  ...DEFAULT_RETRY_POLICY_CONFIG,
  ...resilience?.retry,
});

export const createBulkheadConfig = (
  resilience?: ResilienceConfig,
): Partial<BulkheadConfig> => ({
  ...DEFAULT_BULKHEAD_CONFIG,
  ...resilience?.bulkhead?.trading,
});
