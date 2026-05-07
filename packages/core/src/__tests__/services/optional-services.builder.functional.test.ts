import { createAdvancedOrderFlowConfig } from '../helpers/advanced-order-flow-test.utils';
import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { initializeAdvancedOrderFlowService } from '../../services/factories/builders/advanced-order-flow-service.builder';
import { initializeCompoundInterestService } from '../../services/factories/builders/compound-interest-service.builder';
import { initializeDeltaAnalyzerService } from '../../services/factories/builders/delta-analyzer-service.builder';
import { initializeDynamicPositionSizerService } from '../../services/factories/builders/dynamic-position-sizer-service.builder';
import { initializeLadderExitDetectorService } from '../../services/factories/builders/ladder-exit-detector-service.builder';
import { createDynamicPositionSizingConfig } from '../../services/factories/builders/dynamic-position-sizing-config.builder';
import { initializeOrderbookImbalanceService } from '../../services/factories/builders/orderbook-imbalance-service.builder';
import { createOrderStateMachineConfig } from '../../services/factories/builders/order-state-machine-config.builder';
import { initializeOrderStateMachineService } from '../../services/factories/builders/order-state-machine-service.builder';
import { initializePositionScalingService } from '../../services/factories/builders/position-scaling-service.builder';
import { createPositionScalingConfig } from '../../services/factories/builders/position-scaling-config.builder';
import { createPrometheusMetricsConfig } from '../../services/factories/builders/prometheus-metrics-config.builder';
import { initializePrometheusMetricsService } from '../../services/factories/builders/prometheus-metrics-service.builder';
import { initializeRetestEntryService } from '../../services/factories/builders/retest-entry-service.builder';
import { initializeSmartOrderExecutionService } from '../../services/factories/builders/smart-order-execution-service.builder';
import { createSmartOrderExecutionConfig } from '../../services/factories/builders/smart-order-execution-config.builder';
import { initializeWallTrackerService } from '../../services/factories/builders/wall-tracker-service.builder';
import { createDynamicPositionSizerConfig as createDynamicPositionSizerServiceConfig } from '../helpers/dynamic-position-sizer-test.utils';
import { createLadderExitBybitService } from '../helpers/ladder-exit-detector-test.utils';
import { createPositionScalingConfig as createPositionScalingServiceConfig } from '../helpers/position-scaling-test.utils';
import { createSmartOrderExecutionConfig as createSmartOrderExecutionServiceConfig } from '../helpers/smart-order-execution-test.utils';
import {
  createBotFactoryRuntimeTestConfig,
  createTrackedBotFactoryRuntimeServices,
} from '../helpers/bot-factory-runtime-test.utils';
import { createCompoundInterestConfig } from '../helpers/compound-interest-calculator-test.utils';
import { createDeltaAnalyzerConfig } from '../helpers/delta-analyzer-test.utils';
import { createOrderbookImbalanceConfig } from '../helpers/orderbook-imbalance-test.utils';
import { createRetestEntryConfig } from '../helpers/retest-entry-test.utils';
import {
  createManagedTrackedServicesContext,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';
import { createWallTrackerConfig } from '../helpers/wall-tracker-test.utils';

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
    const config = createBotFactoryRuntimeTestConfig();

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

  test('creates state-machine and metrics builders outside the composition root body', async () => {
    const config = createBotFactoryRuntimeTestConfig();
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
    } as unknown as BotServiceState;

    (
      config as typeof config & {
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
    const monitoring = (
      config as typeof config & {
        monitoring?: {
          metricsEnabled: boolean;
          metricsPrefix: string;
          collectInterval: number;
          defaultLabels: Record<string, string>;
        };
      }
    ).monitoring;

    initializeOrderStateMachineService(state, config);
    initializePrometheusMetricsService(state, monitoring);

    expect(state.orderStateMachine).toBeDefined();
    expect(state.metricsService).toBeDefined();
    expect(await state.metricsService?.getMetrics()).toContain('edison_');
  });

  test('creates early optional service builders outside the composition root body', () => {
    const config = createBotFactoryRuntimeTestConfig();
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
      bybitService: {
        getBalance: jest.fn(async () => ({ walletBalance: 1250 })),
      },
      journal: {
        getVirtualBalance: jest.fn(() => 900),
      },
    } as unknown as BotServiceState;

    config.compoundInterest = createCompoundInterestConfig();
    config.retestEntry = createRetestEntryConfig();
    config.delta = createDeltaAnalyzerConfig();
    config.orderbookImbalance = createOrderbookImbalanceConfig();
    config.wallTracking = createWallTrackerConfig();

    initializeCompoundInterestService(state, config);
    initializeRetestEntryService(state, config);
    initializeDeltaAnalyzerService(state, config);
    initializeOrderbookImbalanceService(state, config);
    initializeWallTrackerService(state, config);

    expect(state.compoundInterestCalculator).toBeDefined();
    expect(state.retestEntryService).toBeDefined();
    expect(state.deltaAnalyzerService).toBeDefined();
    expect(state.orderbookImbalanceService).toBeDefined();
    expect(state.wallTrackerService).toBeDefined();
  });

  test('creates execution-oriented optional service builders outside the composition root body', () => {
    const config = createBotFactoryRuntimeTestConfig();
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
      bybitService: createLadderExitBybitService(),
    } as unknown as BotServiceState;

    (
      config as typeof config & {
        advancedOrderFlow?: ReturnType<typeof createAdvancedOrderFlowConfig> & {
          enabled: boolean;
        };
      }
    ).advancedOrderFlow = {
      ...createAdvancedOrderFlowConfig(),
      enabled: true,
    };
    (
      config as typeof config & {
        dynamicPositionSizing?: ReturnType<typeof createDynamicPositionSizerServiceConfig> & {
          enabled: boolean;
        };
        positionScaling?: ReturnType<typeof createPositionScalingServiceConfig> & {
          enabled: boolean;
        };
        smartOrderExecution?: ReturnType<typeof createSmartOrderExecutionServiceConfig> & {
          enabled: boolean;
        };
      }
    ).dynamicPositionSizing = {
      ...createDynamicPositionSizerServiceConfig(),
      enabled: true,
    };
    (
      config as typeof config & {
        positionScaling?: ReturnType<typeof createPositionScalingServiceConfig> & {
          enabled: boolean;
        };
      }
    ).positionScaling = {
      ...createPositionScalingServiceConfig(),
      enabled: true,
    };
    (
      config as typeof config & {
        smartOrderExecution?: ReturnType<typeof createSmartOrderExecutionServiceConfig> & {
          enabled: boolean;
        };
      }
    ).smartOrderExecution = {
      ...createSmartOrderExecutionServiceConfig(),
      enabled: true,
    };

    initializeAdvancedOrderFlowService(state, config);
    initializeDynamicPositionSizerService(state, config);
    initializePositionScalingService(state, config);
    initializeSmartOrderExecutionService(state, config);
    initializeLadderExitDetectorService(state);

    expect(state.advancedOrderFlowService).toBeDefined();
    expect(state.dynamicPositionSizer).toBeDefined();
    expect(state.positionScalingService).toBeDefined();
    expect(state.smartOrderExecution).toBeDefined();
    expect(state.ladderExitDetector).toBeDefined();
  });

  test('factory path wires extracted optional service builders through service creation', async () => {
    const config = createBotFactoryRuntimeTestConfig();

    config.compoundInterest = createCompoundInterestConfig();
    config.retestEntry = createRetestEntryConfig();
    config.delta = createDeltaAnalyzerConfig();
    config.orderbookImbalance = createOrderbookImbalanceConfig();
    config.wallTracking = createWallTrackerConfig();

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
    (
      config as typeof config & {
        advancedOrderFlow?: ReturnType<typeof createAdvancedOrderFlowConfig> & {
          enabled: boolean;
        };
      }
    ).advancedOrderFlow = {
      ...createAdvancedOrderFlowConfig(),
      enabled: true,
    };

    const services = createTrackedBotFactoryRuntimeServices(trackedServices, config) as BotServiceState;

    expect(services.compoundInterestCalculator).toBeDefined();
    expect(services.retestEntryService).toBeDefined();
    expect(services.deltaAnalyzerService).toBeDefined();
    expect(services.orderbookImbalanceService).toBeDefined();
    expect(services.wallTrackerService).toBeDefined();
    expect(services.advancedOrderFlowService).toBeDefined();
    expect(services.dynamicPositionSizer).toBeDefined();
    expect(services.positionScalingService).toBeDefined();
    expect(services.smartOrderExecution).toBeDefined();
    expect(services.orderStateMachine).toBeDefined();
    expect(services.metricsService).toBeDefined();
    expect(services.ladderExitDetector).toBeDefined();
    expect(services.executionServices.dynamicPositionSizer).toBe(services.dynamicPositionSizer);
    expect(services.executionServices.positionScalingService).toBe(services.positionScalingService);
    expect(services.executionServices.smartOrderExecution).toBe(services.smartOrderExecution);
    expect(services.executionServices.orderStateMachine).toBe(services.orderStateMachine);
    expect(services.executionServices.ladderExitDetector).toBe(services.ladderExitDetector);
    expect(await services.metricsService?.getMetrics()).toContain('edison_');
  });
});
