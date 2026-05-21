import {
  createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig,
  createBotFactoryServiceRuntimeDefaultConfig,
  createBotServiceStateRuntimeDefaultConfig,
  createCliBoundaryRuntimeDefaultConfig,
  createCoreEntrypointCandleRuntimeConfig,
  createGroupedServicesRuntimeDefaultConfig,
  createMonitoringResilienceBuilderRuntimeDefaultConfig,
  createOptionalServicesBuilderRuntimeDefaultConfig,
  createOrchestratorHandlersBuilderCandleEnabledConfig,
  createRiskManagerBuilderRuntimeDefaultConfig,
  createRootBotFactoryBoundaryRuntimeDefaultConfig,
  createWebSocketMonitoringBuilderCandleEnabledConfig,
} from './bot-factory-runtime-test.utils';

describe('bot factory runtime test utils', () => {
  test('createMonitoringResilienceBuilderRuntimeDefaultConfig enables only the monitoring and resilience runtime families that boundary suite needs', () => {
    const config = createMonitoringResilienceBuilderRuntimeDefaultConfig() as {
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

  test('createWebSocketMonitoringBuilderCandleEnabledConfig keeps websocket-monitoring coverage on a candle-enabled fixture', () => {
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });

  test('createRiskManagerBuilderRuntimeDefaultConfig keeps risk-manager coverage on the runtime-default fixture', () => {
    const config = createRiskManagerBuilderRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createOrchestratorHandlersBuilderCandleEnabledConfig keeps orchestrator handler coverage on a candle-enabled fixture', () => {
    const config = createOrchestratorHandlersBuilderCandleEnabledConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });

  test('createOptionalServicesBuilderRuntimeDefaultConfig keeps optional-services coverage on the runtime-default fixture', () => {
    const config = createOptionalServicesBuilderRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
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

