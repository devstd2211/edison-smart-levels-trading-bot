import {
  createBotFactoryServiceBoundaryConfig,
  createBotFactoryServiceStateConfig,
  createCoreEntrypointRuntimeConfig,
  createGroupedServicesBuilderConfig,
  createMonitoringResilienceBuilderConfig,
} from './bot-factory-runtime-test.utils';

describe('bot factory runtime test utils', () => {
  test('createMonitoringResilienceBuilderConfig enables only the monitoring and resilience runtime families that boundary suite needs', () => {
    const config = createMonitoringResilienceBuilderConfig() as {
      monitoring?: {
        metricsEnabled?: boolean;
        healthCheckEnabled?: boolean;
        serverEnabled?: boolean;
        port?: number;
      };
      resilience?: {
        enabled?: boolean;
        circuitBreaker?: {
          failureThreshold?: number;
        };
      };
    };

    expect(config.monitoring).toEqual(
      expect.objectContaining({
        metricsEnabled: true,
        healthCheckEnabled: true,
        serverEnabled: true,
        port: 9191,
      }),
    );
    expect(config.resilience).toEqual(
      expect.objectContaining({
        enabled: true,
        circuitBreaker: expect.objectContaining({
          failureThreshold: 7,
        }),
      }),
    );
  });

  test('createGroupedServicesBuilderConfig keeps grouped-service boundary coverage on the narrow runtime fixture', () => {
    const config = createGroupedServicesBuilderConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotFactoryServiceStateConfig keeps bot-service-state bootstrap coverage on the runtime fixture', () => {
    const config = createBotFactoryServiceStateConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotFactoryServiceBoundaryConfig keeps bot-factory service coverage on the narrow runtime fixture', () => {
    const config = createBotFactoryServiceBoundaryConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createCoreEntrypointRuntimeConfig reuses the legacy entrypoint fixture for wrapper-level core entrypoint coverage', () => {
    const config = createCoreEntrypointRuntimeConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });
});
