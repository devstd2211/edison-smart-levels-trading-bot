import {
  createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig,
  createBotFactoryServiceRuntimeDefaultConfig,
  createBotServiceStateRuntimeDefaultConfig,
  createCliBoundaryRuntimeDefaultConfig,
  createCoreEntrypointCandleRuntimeConfig,
  createGroupedServicesRuntimeDefaultConfig,
  createMonitoringResilienceBuilderConfig,
  createRootBotFactoryBoundaryRuntimeDefaultConfig,
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

  test('createGroupedServicesRuntimeDefaultConfig keeps grouped-service boundary coverage on the narrow runtime fixture', () => {
    const config = createGroupedServicesRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotServiceStateRuntimeDefaultConfig keeps bot-service-state bootstrap coverage on the runtime fixture', () => {
    const config = createBotServiceStateRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotFactoryServiceRuntimeDefaultConfig keeps bot-factory service coverage on the narrow runtime fixture', () => {
    const config = createBotFactoryServiceRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createCliBoundaryRuntimeDefaultConfig keeps CLI boundary coverage on a runtime-default fixture without candle subscription state', () => {
    const config = createCliBoundaryRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createRootBotFactoryBoundaryRuntimeDefaultConfig keeps root BotFactory boundary coverage on the runtime-default fixture', () => {
    const config = createRootBotFactoryBoundaryRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig keeps validation/error coverage on the runtime-default fixture', () => {
    const config = createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createCoreEntrypointCandleRuntimeConfig reuses the legacy entrypoint candle fixture for wrapper-level core entrypoint coverage', () => {
    const config = createCoreEntrypointCandleRuntimeConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });
});

