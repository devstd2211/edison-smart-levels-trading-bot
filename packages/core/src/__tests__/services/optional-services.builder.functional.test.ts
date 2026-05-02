import type { BotServicesState } from '../../services/bot-services.builder';
import { createDynamicPositionSizingConfig } from '../../services/factories/builders/dynamic-position-sizing-config.builder';
import { createOrderStateMachineConfig } from '../../services/factories/builders/order-state-machine-config.builder';
import { createPositionScalingConfig } from '../../services/factories/builders/position-scaling-config.builder';
import { createPrometheusMetricsConfig } from '../../services/factories/builders/prometheus-metrics-config.builder';
import { createSmartOrderExecutionConfig } from '../../services/factories/builders/smart-order-execution-config.builder';
import {
  createBotFactoryTestConfig,
  createTrackedBotFactoryServices,
} from '../helpers/bot-factory-test.utils';
import {
  createManagedTrackedServicesContext,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Optional services builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates optional service config selectors outside the composition root body', () => {
    const config = createBotFactoryTestConfig();

    (
      config as typeof config & {
        dynamicPositionSizing?: {
          enabled: boolean;
          baseRiskPercent: number;
          maxRiskPercent: number;
          minPositionSize: number;
          maxPositionSize: number;
          volatilityMultiplier: number;
          confidenceThreshold: number;
        };
        positionScaling?: {
          enabled: boolean;
          scaleInThreshold: number;
          maxScales: number;
          scaleReduction: number;
          breakevenThreshold: number;
        };
        smartOrderExecution?: {
          enabled: boolean;
          maxSlippagePercent: number;
          maxOrderSplits: number;
          minFillProbability: number;
          adaptiveExecution: boolean;
          executionStrategy: 'adaptive';
          twapInterval: number;
          vwapLookback: number;
          executionTimeout: number;
        };
        orderStateMachine?: {
          enabled: boolean;
        };
      }
    ).dynamicPositionSizing = {
      enabled: true,
      baseRiskPercent: 1,
      maxRiskPercent: 2,
      minPositionSize: 25,
      maxPositionSize: 250,
      volatilityMultiplier: 1.4,
      confidenceThreshold: 0.55,
    };
    (
      config as typeof config & {
        positionScaling?: {
          enabled: boolean;
          scaleInThreshold: number;
          maxScales: number;
          scaleReduction: number;
          breakevenThreshold: number;
        };
      }
    ).positionScaling = {
      enabled: true,
      scaleInThreshold: 0.6,
      maxScales: 3,
      scaleReduction: 0.5,
      breakevenThreshold: 0.4,
    };
    (
      config as typeof config & {
        smartOrderExecution?: {
          enabled: boolean;
          maxSlippagePercent: number;
          maxOrderSplits: number;
          minFillProbability: number;
          adaptiveExecution: boolean;
          executionStrategy: 'adaptive';
          twapInterval: number;
          vwapLookback: number;
          executionTimeout: number;
        };
      }
    ).smartOrderExecution = {
      enabled: true,
      maxSlippagePercent: 0.25,
      maxOrderSplits: 4,
      minFillProbability: 0.7,
      adaptiveExecution: true,
      executionStrategy: 'adaptive',
      twapInterval: 5000,
      vwapLookback: 20,
      executionTimeout: 30000,
    };
    (
      config as typeof config & {
        orderStateMachine?: {
          enabled: boolean;
        };
      }
    ).orderStateMachine = {
      enabled: true,
    };

    expect(createDynamicPositionSizingConfig(config)).toMatchObject({
      enabled: true,
      maxRiskPercent: 2,
      volatilityMultiplier: 1.4,
    });
    expect(createPositionScalingConfig(config)).toMatchObject({
      enabled: true,
      maxScales: 3,
      breakevenThreshold: 0.4,
    });
    expect(createSmartOrderExecutionConfig(config)).toMatchObject({
      enabled: true,
      maxOrderSplits: 4,
      executionStrategy: 'adaptive',
    });
    expect(createOrderStateMachineConfig(config)).toEqual({
      enabled: true,
    });
  });

  test('creates metrics config defaults outside the composition root body', () => {
    expect(createPrometheusMetricsConfig()).toEqual({
      enabled: true,
      prefix: 'trading_bot_',
      collectInterval: 10000,
      defaultLabels: undefined,
    });

    expect(
      createPrometheusMetricsConfig({
        metricsEnabled: true,
        metricsPrefix: 'edison_',
        collectInterval: 2500,
        defaultLabels: { env: 'test' },
      }),
    ).toEqual({
      enabled: true,
      prefix: 'edison_',
      collectInterval: 2500,
      defaultLabels: { env: 'test' },
    });
  });

  test('factory path wires extracted optional service builders through service creation', async () => {
    const config = createBotFactoryTestConfig();

    (
      config as typeof config & {
        dynamicPositionSizing?: {
          enabled: boolean;
          baseRiskPercent: number;
          maxRiskPercent: number;
          minPositionSize: number;
          maxPositionSize: number;
          volatilityMultiplier: number;
          confidenceThreshold: number;
        };
        positionScaling?: {
          enabled: boolean;
          scaleInThreshold: number;
          maxScales: number;
          scaleReduction: number;
          breakevenThreshold: number;
        };
        smartOrderExecution?: {
          enabled: boolean;
          maxSlippagePercent: number;
          maxOrderSplits: number;
          minFillProbability: number;
          adaptiveExecution: boolean;
          executionStrategy: 'adaptive';
          twapInterval: number;
          vwapLookback: number;
          executionTimeout: number;
        };
        orderStateMachine?: {
          enabled: boolean;
        };
        monitoring?: {
          metricsEnabled: boolean;
          metricsPrefix: string;
          collectInterval: number;
          defaultLabels: Record<string, string>;
        };
      }
    ).dynamicPositionSizing = {
      enabled: true,
      baseRiskPercent: 1,
      maxRiskPercent: 2,
      minPositionSize: 25,
      maxPositionSize: 250,
      volatilityMultiplier: 1.4,
      confidenceThreshold: 0.55,
    };
    (
      config as typeof config & {
        positionScaling?: {
          enabled: boolean;
          scaleInThreshold: number;
          maxScales: number;
          scaleReduction: number;
          breakevenThreshold: number;
        };
      }
    ).positionScaling = {
      enabled: true,
      scaleInThreshold: 0.6,
      maxScales: 3,
      scaleReduction: 0.5,
      breakevenThreshold: 0.4,
    };
    (
      config as typeof config & {
        smartOrderExecution?: {
          enabled: boolean;
          maxSlippagePercent: number;
          maxOrderSplits: number;
          minFillProbability: number;
          adaptiveExecution: boolean;
          executionStrategy: 'adaptive';
          twapInterval: number;
          vwapLookback: number;
          executionTimeout: number;
        };
      }
    ).smartOrderExecution = {
      enabled: true,
      maxSlippagePercent: 0.25,
      maxOrderSplits: 4,
      minFillProbability: 0.7,
      adaptiveExecution: true,
      executionStrategy: 'adaptive',
      twapInterval: 5000,
      vwapLookback: 20,
      executionTimeout: 30000,
    };
    (
      config as typeof config & {
        orderStateMachine?: {
          enabled: boolean;
        };
      }
    ).orderStateMachine = {
      enabled: true,
    };
    (
      config as typeof config & {
        monitoring?: {
          metricsEnabled: boolean;
          metricsPrefix: string;
          collectInterval: number;
          defaultLabels: Record<string, string>;
        };
      }
    ).monitoring = {
      metricsEnabled: true,
      metricsPrefix: 'edison_',
      collectInterval: 2500,
      defaultLabels: { env: 'test' },
    };

    const services = createTrackedBotFactoryServices(trackedServices, config) as BotServicesState;

    expect(services.dynamicPositionSizer).toBeDefined();
    expect(services.positionScalingService).toBeDefined();
    expect(services.smartOrderExecution).toBeDefined();
    expect(services.orderStateMachine).toBeDefined();
    expect(services.metricsService).toBeDefined();
    expect(services.executionServices.dynamicPositionSizer).toBe(services.dynamicPositionSizer);
    expect(services.executionServices.positionScalingService).toBe(services.positionScalingService);
    expect(services.executionServices.smartOrderExecution).toBe(services.smartOrderExecution);
    expect(services.executionServices.orderStateMachine).toBe(services.orderStateMachine);
    expect(await services.metricsService?.getMetrics()).toContain('edison_');
  });
});
