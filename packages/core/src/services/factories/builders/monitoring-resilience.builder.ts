import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { HealthCheckService } from '../../health-check.service';
import { MonitoringServer } from '../../monitoring-server.service';
import { BulkheadService } from '../../resilience/bulkhead.service';
import { CircuitBreakerService } from '../../resilience/circuit-breaker.service';
import { RateLimiterService } from '../../resilience/rate-limiter.service';
import { ResilienceCoordinator } from '../../resilience/resilience-coordinator.service';
import { RetryPolicyService } from '../../resilience/retry-policy.service';
import type { MonitoringConfig, ResilienceConfig } from './bot-services.types';
import { createHealthCheckConfig } from './health-check-config.builder';
import { resolveMonitoringMetricsRecorder } from './monitoring-metrics-recorder.builder';
import { createMonitoringServerConfig } from './monitoring-server-config.builder';
import {
  createBulkheadConfig,
  createCircuitBreakerConfig,
  createRateLimiterConfig,
  createRetryPolicyConfig,
} from './resilience-service-config.builder';

type MonitoringHealthServicesState = Pick<
  BotServiceState,
  | 'bybitService'
  | 'webSocketManager'
  | 'logger'
  | 'errorHandler'
  | 'metricsService'
  | 'healthCheckService'
  | 'monitoringServer'
>;

type ResilienceServicesState = Pick<
  BotServiceState,
  | 'logger'
  | 'errorHandler'
  | 'metricsService'
  | 'circuitBreaker'
  | 'rateLimiter'
  | 'retryPolicy'
  | 'bulkhead'
  | 'resilienceCoordinator'
>;

export type MonitoringResilienceBuilderState =
  & MonitoringHealthServicesState
  & ResilienceServicesState;

const resolveResilienceConfig = (
  config: Config,
): ResilienceConfig | undefined => (config as Partial<{ resilience?: ResilienceConfig }>).resilience;

export const initializeMonitoringHealthServices = (
  state: MonitoringHealthServicesState,
  monitoring?: MonitoringConfig,
): void => {
  if (monitoring?.healthCheckEnabled) {
    const healthCheckConfig = createHealthCheckConfig(monitoring);

    state.healthCheckService = new HealthCheckService(
      state.bybitService,
      state.webSocketManager,
      healthCheckConfig,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('Health Check Service initialized (Phase 14.1.2)', {
      memoryThreshold: healthCheckConfig.thresholds.memoryUsagePercent,
      cpuThreshold: healthCheckConfig.thresholds.cpuUsagePercent,
    });
  }

  if (monitoring?.serverEnabled && (state.metricsService || state.healthCheckService)) {
    const monitoringServerConfig = createMonitoringServerConfig(monitoring);

    state.monitoringServer = new MonitoringServer(
      state.metricsService,
      state.healthCheckService,
      monitoringServerConfig,
      state.logger,
      state.errorHandler,
    );

    state.logger.info('Monitoring Server initialized (Phase 14.1.3)', {
      port: monitoringServerConfig.port,
      metricsPath: monitoringServerConfig.metricsPath,
      healthPath: monitoringServerConfig.healthPath,
    });
  }
};

export const initializeResilienceServices = (
  state: ResilienceServicesState,
  config: Config,
): void => {
  const resilience = resolveResilienceConfig(config);
  if (!resilience?.enabled) {
    return;
  }

  const circuitBreakerConfig = createCircuitBreakerConfig(resilience);
  const rateLimiterConfig = createRateLimiterConfig(resilience);
  const retryPolicyConfig = createRetryPolicyConfig(resilience);
  const bulkheadConfig = createBulkheadConfig(resilience);
  const metricsRecorder = resolveMonitoringMetricsRecorder(state.metricsService);

  state.circuitBreaker = new CircuitBreakerService(
    circuitBreakerConfig,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('Circuit Breaker initialized (Phase 14.2.1)', {
    failureThreshold: circuitBreakerConfig.failureThreshold,
    timeout: circuitBreakerConfig.timeout,
  });

  state.rateLimiter = new RateLimiterService(
    rateLimiterConfig,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('Rate Limiter initialized (Phase 14.2.2)', {
    configs: Object.keys(resilience.rateLimiter || { bybit: {} }),
  });

  state.retryPolicy = new RetryPolicyService(
    retryPolicyConfig,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('Retry Policy initialized (Phase 14.2.3)', {
    maxAttempts: retryPolicyConfig.maxAttempts,
    retryBudget: `${retryPolicyConfig.retryBudgetPercent}%`,
  });

  state.bulkhead = new BulkheadService(
    bulkheadConfig,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('Bulkhead initialized (Phase 14.2.4)', {
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
  state.logger.info('Resilience Coordinator initialized (Phase 14.2.5)', {
    patterns: ['circuitBreaker', 'rateLimiter', 'retryPolicy', 'bulkhead'],
    hasMetrics: !!state.metricsService,
  });
};

export const initializeMonitoringAndResilience = (
  state: MonitoringResilienceBuilderState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  initializeMonitoringHealthServices(state, monitoring);
  initializeResilienceServices(state, config);
};
