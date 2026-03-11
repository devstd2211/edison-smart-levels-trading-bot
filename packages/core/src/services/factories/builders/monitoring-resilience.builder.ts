import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import type { IMonitoringMetricsRecorder } from '../../../interfaces';
import { HealthCheckService } from '../../health-check.service';
import { MonitoringServer } from '../../monitoring-server.service';
import { CircuitBreakerService } from '../../resilience/circuit-breaker.service';
import { RateLimiterService } from '../../resilience/rate-limiter.service';
import { RetryPolicyService } from '../../resilience/retry-policy.service';
import { BulkheadService } from '../../resilience/bulkhead.service';
import { ResilienceCoordinator } from '../../resilience/resilience-coordinator.service';
import type { MonitoringConfig, ResilienceConfig } from './bot-services.types';

export const initializeMonitoringAndResilience = (
  state: BotServicesState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;

  const getNumberOption = (value: unknown, key: string, fallback: number): number => {
    const candidate = asRecord(value)?.[key];
    return typeof candidate === 'number' ? candidate : fallback;
  };

  if (monitoring?.healthCheckEnabled) {
    state.healthCheckService = new HealthCheckService(
      state.bybitService,
      state.webSocketManager,
      {
        enabled: true,
        thresholds: {
          memoryUsagePercent: monitoring?.thresholds?.memoryUsagePercent || 90,
          cpuUsagePercent: monitoring?.thresholds?.cpuUsagePercent || 80,
          diskUsagePercent: monitoring?.thresholds?.diskUsagePercent || 90,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Health Check Service initialized (Phase 14.1.2)', {
      memoryThreshold: monitoring?.thresholds?.memoryUsagePercent || 90,
      cpuThreshold: monitoring?.thresholds?.cpuUsagePercent || 80,
    });
  }

  if (monitoring?.serverEnabled && (state.metricsService || state.healthCheckService)) {
    state.monitoringServer = new MonitoringServer(
      state.metricsService,
      state.healthCheckService,
      {
        enabled: true,
        port: monitoring?.port || 9090,
        metricsPath: monitoring?.metricsPath || '/metrics',
        healthPath: monitoring?.healthPath || '/health',
        cors: monitoring?.cors ?? true,
      },
      state.logger,
      state.errorHandler,
    );

    state.logger.info('✅ Monitoring Server initialized (Phase 14.1.3)', {
      port: monitoring?.port || 9090,
      metricsPath: monitoring?.metricsPath || '/metrics',
      healthPath: monitoring?.healthPath || '/health',
    });
  }

  const resilience = asRecord(config)?.resilience as ResilienceConfig | undefined;
  if (resilience?.enabled) {
    const isMetricsRecorder = (value: unknown): value is IMonitoringMetricsRecorder => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }
      const candidate = value as { recordOrderLatency?: unknown };
      return typeof candidate.recordOrderLatency === 'function';
    };
    const metricsRecorder = isMetricsRecorder(state.metricsService)
      ? state.metricsService
      : undefined;

    state.circuitBreaker = new CircuitBreakerService(
      resilience.circuitBreaker || {
        failureThreshold: 5,
        failureRateThreshold: 0.5,
        successThreshold: 2,
        timeout: 60000,
        volumeThreshold: 10,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Circuit Breaker initialized (Phase 14.2.1)', {
      failureThreshold: getNumberOption(resilience.circuitBreaker, 'failureThreshold', 5),
      timeout: getNumberOption(resilience.circuitBreaker, 'timeout', 60000),
    });

    state.rateLimiter = new RateLimiterService(
      resilience.rateLimiter || {
        bybit: {
          maxRequests: 10,
          windowMs: 1000,
          burstSize: 15,
          queueSize: 50,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Rate Limiter initialized (Phase 14.2.2)', {
      configs: Object.keys(resilience.rateLimiter || { bybit: {} }),
    });

    state.retryPolicy = new RetryPolicyService(
      resilience.retry || {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        exponentialBase: 2,
        jitterEnabled: true,
        retryBudgetPercent: 10,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Retry Policy initialized (Phase 14.2.3)', {
      maxAttempts: getNumberOption(resilience.retry, 'maxAttempts', 3),
      retryBudget: `${getNumberOption(resilience.retry, 'retryBudgetPercent', 10)}%`,
    });

    state.bulkhead = new BulkheadService(
      resilience.bulkhead || {
        trading: {
          maxConcurrent: 10,
          queueSize: 20,
          timeoutMs: 5000,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Bulkhead initialized (Phase 14.2.4)', {
      pools: Object.keys(resilience.bulkhead || { trading: {} }),
    });

    state.resilienceCoordinator = new ResilienceCoordinator(
      state.circuitBreaker,
      state.rateLimiter,
      state.retryPolicy,
      state.bulkhead,
      metricsRecorder,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Resilience Coordinator initialized (Phase 14.2.5)', {
      patterns: ['circuitBreaker', 'rateLimiter', 'retryPolicy', 'bulkhead'],
      hasMetrics: !!state.metricsService,
    });
  }
};
