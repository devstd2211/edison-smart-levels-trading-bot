import { ErrorHandler } from '../../errors/ErrorHandler';
import type { ILifecycle } from '../../interfaces/ILifecycle';
import { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import { BulkheadService } from '../../services/resilience/bulkhead.service';
import { CircuitBreakerService } from '../../services/resilience/circuit-breaker.service';
import type { BulkheadConfig } from '../../services/resilience/bulkhead.service';
import type { CircuitBreakerConfig } from '../../services/resilience/circuit-breaker.service';
import { RateLimiterService } from '../../services/resilience/rate-limiter.service';
import type { RateLimiterConfig } from '../../services/resilience/rate-limiter.service';
import { ResilienceCoordinator } from '../../services/resilience/resilience-coordinator.service';
import { RetryPolicyService } from '../../services/resilience/retry-policy.service';
import type { RetryPolicyConfig } from '../../services/resilience/retry-policy.service';
import { LoggerService } from '../../services/logger.service';

type MockLogger = Partial<LoggerService>;

export interface ResilienceTestHarness {
  logger: MockLogger;
  errorHandler: ErrorHandler;
  trackLifecycle: <T extends ILifecycle>(service: T, options?: { start?: boolean }) => T;
  stopTrackedServices: () => void;
  createTrackedBulkheadService: (
    config?: Partial<BulkheadConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => BulkheadService;
  createCircuitBreakerService: (
    config?: Partial<CircuitBreakerConfig>,
    options?: { logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => CircuitBreakerService;
  createTrackedRateLimiterService: (
    config?: Partial<RateLimiterConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RateLimiterService;
  createTrackedRetryPolicyService: (
    config?: Partial<RetryPolicyConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RetryPolicyService;
  createCoordinatorStack: () => {
    circuitBreaker: CircuitBreakerService;
    rateLimiter: RateLimiterService;
    retryPolicy: RetryPolicyService;
    bulkhead: BulkheadService;
    metrics: PrometheusMetricsService;
    coordinator: ResilienceCoordinator;
  };
}

export interface ResilienceTestContext {
  harness: ResilienceTestHarness;
  logger: MockLogger;
  errorHandler: ErrorHandler;
  cleanup: () => void;
}

export interface ManagedRateLimiterContext extends ResilienceTestContext {
  createDefaultService: (
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RateLimiterService;
  createInvalidService: (
    config: ConstructorParameters<typeof RateLimiterService>[0],
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RateLimiterService;
  createService: (
    config?: Partial<RateLimiterConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RateLimiterService;
}

export interface ManagedRetryPolicyContext extends ResilienceTestContext {
  createDefaultService: (
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RetryPolicyService;
  createInvalidService: (
    config: ConstructorParameters<typeof RetryPolicyService>[0],
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RetryPolicyService;
  createService: (
    config?: Partial<RetryPolicyConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => RetryPolicyService;
  useFakeTimers: () => void;
}

export interface ManagedCircuitBreakerContext extends ResilienceTestContext {
  createDefaultService: (
    options?: { logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => CircuitBreakerService;
  createInvalidService: (
    config: ConstructorParameters<typeof CircuitBreakerService>[0],
    options?: { logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => CircuitBreakerService;
  createService: (
    config?: Partial<CircuitBreakerConfig>,
    options?: { logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => CircuitBreakerService;
}

export interface ManagedBulkheadContext extends ResilienceTestContext {
  createDefaultService: (
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => BulkheadService;
  createInvalidService: (
    config: ConstructorParameters<typeof BulkheadService>[0],
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => BulkheadService;
  createService: (
    config?: Partial<BulkheadConfig>,
    options?: { start?: boolean; logger?: LoggerService; errorHandler?: ErrorHandler },
  ) => BulkheadService;
}

export interface ManagedResilienceCoordinatorContext extends ResilienceTestContext {
  coordinator: ResilienceCoordinator;
  circuitBreaker: CircuitBreakerService;
  rateLimiter: RateLimiterService;
  retryPolicy: RetryPolicyService;
  bulkhead: BulkheadService;
  metrics: PrometheusMetricsService;
}

export type RateLimiterFactories = Pick<
  ManagedRateLimiterContext,
  'createDefaultService' | 'createInvalidService' | 'createService' | 'cleanup'
>;

export type RetryPolicyFactories = Pick<
  ManagedRetryPolicyContext,
  | 'createDefaultService'
  | 'createInvalidService'
  | 'createService'
  | 'useFakeTimers'
  | 'cleanup'
>;

export type CircuitBreakerFactories = Pick<
  ManagedCircuitBreakerContext,
  'createDefaultService' | 'createInvalidService' | 'createService' | 'cleanup'
>;

export type BulkheadFactories = Pick<
  ManagedBulkheadContext,
  'createDefaultService' | 'createInvalidService' | 'createService' | 'cleanup'
>;

export type ResilienceCoordinatorRuntime = Pick<
  ManagedResilienceCoordinatorContext,
  | 'coordinator'
  | 'circuitBreaker'
  | 'rateLimiter'
  | 'retryPolicy'
  | 'bulkhead'
  | 'metrics'
  | 'cleanup'
>;

export function createMockResilienceLogger(): MockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function createResilienceTestHarness(): ResilienceTestHarness {
  const logger = createMockResilienceLogger();
  const errorHandler = new ErrorHandler(logger as LoggerService);
  const trackedServices: ILifecycle[] = [];

  return {
    logger,
    errorHandler,
    trackLifecycle<T extends ILifecycle>(service: T, options: { start?: boolean } = {}): T {
      trackedServices.push(service);

      if (options.start !== false) {
        service.start();
      }

      return service;
    },
    stopTrackedServices(): void {
      while (trackedServices.length > 0) {
        trackedServices.pop()?.stop();
      }
    },
    createTrackedBulkheadService(
      config = {},
      options = {},
    ): BulkheadService {
      const service = new BulkheadService(
        config,
        options.logger ?? (logger as LoggerService),
        options.errorHandler ?? errorHandler,
      );
      return this.trackLifecycle(service, { start: options.start });
    },
    createCircuitBreakerService(
      config = {},
      options = {},
    ): CircuitBreakerService {
      return new CircuitBreakerService(
        config,
        options.logger ?? (logger as LoggerService),
        options.errorHandler ?? errorHandler,
      );
    },
    createTrackedRateLimiterService(
      config = {},
      options = {},
    ): RateLimiterService {
      const service = new RateLimiterService(
        config,
        options.logger ?? (logger as LoggerService),
        options.errorHandler ?? errorHandler,
      );
      return this.trackLifecycle(service, { start: options.start });
    },
    createTrackedRetryPolicyService(
      config = {},
      options = {},
    ): RetryPolicyService {
      const service = new RetryPolicyService(
        config,
        options.logger ?? (logger as LoggerService),
        options.errorHandler ?? errorHandler,
      );
      return this.trackLifecycle(service, { start: options.start });
    },
    createCoordinatorStack() {
      const circuitBreaker = new CircuitBreakerService(
        {
          failureThreshold: 3,
          failureRateThreshold: 0.5,
          successThreshold: 2,
          timeout: 1000,
          volumeThreshold: 5,
        },
        logger as LoggerService,
        errorHandler,
      );

      const rateLimiter = this.trackLifecycle(
        new RateLimiterService(
          {
            maxRequests: 5,
            windowMs: 1000,
            burstSize: 10,
            queueSize: 20,
            adaptiveEnabled: true,
          },
          logger as LoggerService,
          errorHandler,
        ),
      );

      const retryPolicy = this.trackLifecycle(
        new RetryPolicyService(
          {
            maxAttempts: 3,
            baseDelayMs: 50,
            maxDelayMs: 500,
            exponentialBase: 2,
            jitterEnabled: false,
            retryBudgetPercent: 0.1,
          },
          logger as LoggerService,
          errorHandler,
        ),
      );

      const bulkhead = this.trackLifecycle(
        new BulkheadService(
          {
            maxConcurrent: 5,
            queueSize: 10,
            timeoutMs: 1000,
            rejectPolicy: 'QUEUE',
          },
          logger as LoggerService,
          errorHandler,
        ),
      );

      const metrics = this.trackLifecycle(
        new PrometheusMetricsService(
          { enabled: true },
          logger as LoggerService,
          errorHandler,
        ),
      );

      const coordinator = new ResilienceCoordinator(
        circuitBreaker,
        rateLimiter,
        retryPolicy,
        bulkhead,
        metrics,
        logger as LoggerService,
        errorHandler,
      );

      return {
        circuitBreaker,
        rateLimiter,
        retryPolicy,
        bulkhead,
        metrics,
        coordinator,
      };
    },
  };
}

export function createResilienceTestContext(): ResilienceTestContext {
  const harness = createResilienceTestHarness();

  return {
    harness,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    cleanup: () => harness.stopTrackedServices(),
  };
}

export function createManagedRateLimiterContext(): ManagedRateLimiterContext {
  const context = createResilienceTestContext();

  return {
    ...context,
    createDefaultService: (options = {}) =>
      context.harness.createTrackedRateLimiterService({}, options),
    createInvalidService: (config, options = {}) =>
      context.harness.trackLifecycle(
        new RateLimiterService(
          config,
          options.logger ?? (context.logger as LoggerService),
          options.errorHandler ?? context.errorHandler,
        ),
        { start: options.start },
      ),
    createService: (config = {}, options = {}) =>
      context.harness.createTrackedRateLimiterService(config, options),
    cleanup: () => {
      context.cleanup();
      jest.clearAllTimers();
    },
  };
}

export function createManagedRetryPolicyContext(): ManagedRetryPolicyContext {
  const context = createResilienceTestContext();
  let usingFakeTimers = false;

  return {
    ...context,
    createDefaultService: (options = {}) =>
      context.harness.createTrackedRetryPolicyService({}, options),
    createInvalidService: (config, options = {}) =>
      context.harness.trackLifecycle(
        new RetryPolicyService(
          config,
          options.logger ?? (context.logger as LoggerService),
          options.errorHandler ?? context.errorHandler,
        ),
        { start: options.start },
      ),
    createService: (config = {}, options = {}) =>
      context.harness.createTrackedRetryPolicyService(config, options),
    useFakeTimers: () => {
      jest.clearAllTimers();
      jest.useFakeTimers();
      usingFakeTimers = true;
    },
    cleanup: () => {
      context.cleanup();
      jest.clearAllTimers();
      if (usingFakeTimers) {
        jest.useRealTimers();
      }
    },
  };
}

export function createManagedCircuitBreakerContext(): ManagedCircuitBreakerContext {
  const context = createResilienceTestContext();

  return {
    ...context,
    createDefaultService: (options = {}) =>
      context.harness.createCircuitBreakerService({}, options),
    createInvalidService: (config, options = {}) =>
      new CircuitBreakerService(
        config,
        options.logger ?? (context.logger as LoggerService),
        options.errorHandler ?? context.errorHandler,
      ),
    createService: (config = {}, options = {}) =>
      context.harness.createCircuitBreakerService(config, options),
    cleanup: () => {
      context.cleanup();
      jest.clearAllTimers();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createManagedBulkheadContext(): ManagedBulkheadContext {
  const context = createResilienceTestContext();

  return {
    ...context,
    createDefaultService: (options = {}) =>
      context.harness.createTrackedBulkheadService({}, options),
    createInvalidService: (config, options = {}) =>
      context.harness.trackLifecycle(
        new BulkheadService(
          config,
          options.logger ?? (context.logger as LoggerService),
          options.errorHandler ?? context.errorHandler,
        ),
        { start: options.start },
      ),
    createService: (config = {}, options = {}) =>
      context.harness.createTrackedBulkheadService(config, options),
    cleanup: () => {
      context.cleanup();
      jest.clearAllTimers();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createManagedResilienceCoordinatorContext(): ManagedResilienceCoordinatorContext {
  const context = createResilienceTestContext();
  const stack = context.harness.createCoordinatorStack();

  return {
    ...context,
    ...stack,
    cleanup: () => {
      stack.coordinator.stop();
      context.cleanup();
      jest.clearAllTimers();
    },
  };
}
