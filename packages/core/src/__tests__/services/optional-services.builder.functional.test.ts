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
import { createLadderExitBybitService } from '../helpers/ladder-exit-detector-test.utils';
import {
  createOptionalServicesBuilderConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Optional services builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates optional service config selectors outside the composition root body', () => {
    const config = createOptionalServicesBuilderConfig();

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
    const config = createOptionalServicesBuilderConfig();
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
    const config = createOptionalServicesBuilderConfig();
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
    const config = createOptionalServicesBuilderConfig();
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
    const config = createOptionalServicesBuilderConfig();

    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

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
