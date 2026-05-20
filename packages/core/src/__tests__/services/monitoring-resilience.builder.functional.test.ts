import type { BotServiceState } from '../../services/bot-services.builder';
import { createHealthCheckConfig } from '../../services/factories/builders/health-check-config.builder';
import { resolveMonitoringMetricsRecorder } from '../../services/factories/builders/monitoring-metrics-recorder.builder';
import { createMonitoringServerConfig } from '../../services/factories/builders/monitoring-server-config.builder';
import {
  createBulkheadConfig,
  createCircuitBreakerConfig,
  createRateLimiterConfig,
  createRetryPolicyConfig,
} from '../../services/factories/builders/resilience-service-config.builder';
import {
  createBotFactoryRuntimeTestConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Monitoring/resilience builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates monitoring config helpers outside the composition root body', () => {
    expect(createHealthCheckConfig()).toEqual({
      enabled: true,
      thresholds: {
        memoryUsagePercent: 90,
        cpuUsagePercent: 80,
        diskUsagePercent: 90,
      },
    });

    expect(
      createMonitoringServerConfig({
        serverEnabled: true,
        port: 9191,
        metricsPath: '/m',
        healthPath: '/h',
        cors: false,
      }),
    ).toEqual({
      enabled: true,
      port: 9191,
      metricsPath: '/m',
      healthPath: '/h',
      cors: false,
    });
  });

  test('creates resilience config helpers and narrows metrics recorder capability', () => {
    const resilience = {
      enabled: true,
      circuitBreaker: { failureThreshold: 7, timeout: 120000 },
      rateLimiter: { bybit: { maxRequests: 12, adaptiveEnabled: false } },
      retry: { maxAttempts: 4, retryBudgetPercent: 0.25 },
      bulkhead: { trading: { maxConcurrent: 3, rejectPolicy: 'TIMEOUT' as const } },
    };

    expect(createCircuitBreakerConfig(resilience)).toMatchObject({
      failureThreshold: 7,
      timeout: 120000,
      failureRateThreshold: 0.5,
    });
    expect(createRateLimiterConfig(resilience)).toMatchObject({
      maxRequests: 12,
      adaptiveEnabled: false,
      queueSize: 50,
    });
    expect(createRetryPolicyConfig(resilience)).toMatchObject({
      maxAttempts: 4,
      retryBudgetPercent: 0.25,
      exponentialBase: 2,
    });
    expect(createBulkheadConfig(resilience)).toMatchObject({
      maxConcurrent: 3,
      rejectPolicy: 'TIMEOUT',
      queueSize: 20,
    });

    expect(
      resolveMonitoringMetricsRecorder({
        recordOrderLatency: jest.fn(),
      }),
    ).toBeDefined();
    expect(resolveMonitoringMetricsRecorder({})).toBeUndefined();
  });

  test('factory path wires extracted monitoring and resilience builders through service creation', () => {
    const config = createBotFactoryRuntimeTestConfig() as typeof createBotFactoryRuntimeTestConfig extends () => infer T
      ? T
      : never;
    const configWithMonitoring = config as typeof config & {
      monitoring?: {
        metricsEnabled: boolean;
        healthCheckEnabled: boolean;
        serverEnabled: boolean;
        port: number;
        metricsPath: string;
        healthPath: string;
        cors: boolean;
        thresholds: {
          memoryUsagePercent: number;
          cpuUsagePercent: number;
          diskUsagePercent: number;
        };
      };
      resilience?: {
        enabled: boolean;
        circuitBreaker: { failureThreshold: number; timeout: number };
        rateLimiter: { bybit: { maxRequests: number; queueSize: number } };
        retry: { maxAttempts: number; retryBudgetPercent: number };
        bulkhead: { trading: { maxConcurrent: number; timeoutMs: number } };
      };
    };

    configWithMonitoring.monitoring = {
      metricsEnabled: true,
      healthCheckEnabled: true,
      serverEnabled: true,
      port: 9191,
      metricsPath: '/m',
      healthPath: '/h',
      cors: false,
      thresholds: {
        memoryUsagePercent: 85,
        cpuUsagePercent: 70,
        diskUsagePercent: 88,
      },
    };
    configWithMonitoring.resilience = {
      enabled: true,
      circuitBreaker: {
        failureThreshold: 7,
        timeout: 120000,
      },
      rateLimiter: {
        bybit: {
          maxRequests: 12,
          queueSize: 40,
        },
      },
      retry: {
        maxAttempts: 4,
        retryBudgetPercent: 0.25,
      },
      bulkhead: {
        trading: {
          maxConcurrent: 3,
          timeoutMs: 1500,
        },
      },
    };

    const services = createTrackedBotFactoryRuntimeSource(
      trackedServices,
      configWithMonitoring,
    ) as BotServiceState;

    expect(services.metricsService).toBeDefined();
    expect(services.healthCheckService).toBeDefined();
    expect(services.monitoringServer).toBeDefined();
    expect(services.circuitBreaker).toBeDefined();
    expect(services.rateLimiter).toBeDefined();
    expect(services.retryPolicy).toBeDefined();
    expect(services.bulkhead).toBeDefined();
    expect(services.resilienceCoordinator).toBeDefined();
    expect(services.monitoringServices.metrics).toBe(services.metrics);
    expect(services.monitoringServices.monitoringServer).toBe(services.monitoringServer);
    expect(services.resilienceCoordinator?.isHealthy()).toBe(true);
  });
});
