import {
  createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig,
  createBotFactoryServiceBoundaryRuntimeDefaultConfig,
  createBotServiceStateBoundaryRuntimeDefaultConfig,
  createCliBoundaryRuntimeDefaultConfig,
  createCoreEntrypointBoundaryLegacyCandleRuntimeConfig,
  createGroupedServicesBuilderRuntimeDefaultConfig,
  createMonitoringResilienceBuilderRuntimeDefaultConfig,
  createOptionalServicesBuilderRuntimeDefaultConfig,
  createOrchestratorHandlersBuilderCandleEnabledConfig,
  createPositionManagementBuilderRiskMonitoringDisabledConfig,
  createPositionManagementBuilderRiskMonitoringEnabledConfig,
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

  test('createGroupedServicesBuilderRuntimeDefaultConfig keeps grouped-service boundary coverage on the narrow runtime fixture', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createPositionManagementBuilderRiskMonitoringEnabledConfig enables the runtime-default risk-monitoring fixture needed by the builder suite', () => {
    const config = createPositionManagementBuilderRiskMonitoringEnabledConfig() as {
      liveTrading?: {
        riskMonitoring?: {
          enabled?: boolean;
          checkIntervalCandles?: number;
          healthScoreThreshold?: number;
          emergencyCloseOnCritical?: boolean;
        };
      };
    };

    expect(config.liveTrading?.riskMonitoring).toEqual({
      enabled: true,
      checkIntervalCandles: 7,
      healthScoreThreshold: 55,
      emergencyCloseOnCritical: false,
    });
  });

  test('createPositionManagementBuilderRiskMonitoringDisabledConfig keeps the same builder fixture while disabling risk monitoring overrides', () => {
    const config = createPositionManagementBuilderRiskMonitoringDisabledConfig() as {
      liveTrading?: {
        riskMonitoring?: {
          enabled?: boolean;
          checkIntervalCandles?: number;
          healthScoreThreshold?: number;
          emergencyCloseOnCritical?: boolean;
        };
      };
    };

    expect(config.liveTrading?.riskMonitoring).toEqual({
      enabled: false,
      checkIntervalCandles: 3,
      healthScoreThreshold: 45,
      emergencyCloseOnCritical: false,
    });
  });

  test('createBotServiceStateBoundaryRuntimeDefaultConfig keeps bot-service-state bootstrap coverage on the runtime fixture', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: false,
      calculateIndicators: false,
    });
  });

  test('createBotFactoryServiceBoundaryRuntimeDefaultConfig keeps bot-factory service coverage on the narrow runtime fixture', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();

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

  test('createCoreEntrypointBoundaryLegacyCandleRuntimeConfig reuses the legacy entrypoint candle fixture for wrapper-level core entrypoint coverage', () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });
});

