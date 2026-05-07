import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { createRiskManagerConfig } from '../../services/factories/builders/risk-manager-config.builder';
import { initializeRiskManager } from '../../services/factories/builders/risk-manager-service.builder';
import {
  createBotFactoryRuntimeTestConfig,
  createTrackedBotFactoryRuntimeServices,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesContext,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Risk manager builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates the extracted risk manager builder outside the composition root body', () => {
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

    initializeRiskManager(state);

    const riskManager = state.riskManager as unknown as {
      positionSizingConfig: unknown;
      concurrentRiskConfig: unknown;
      maxDailyLossPercent: number;
    };

    expect(state.riskManager).toBeDefined();
    expect(riskManager.maxDailyLossPercent).toBe(createRiskManagerConfig().dailyLimits.maxDailyLossPercent);
    expect(riskManager.positionSizingConfig).toEqual({
      riskPerTradePercent: 1,
      minPositionSizeUsdt: 5,
      maxPositionSizeUsdt: 100,
      maxLeverageMultiplier: 2,
    });
    expect(riskManager.concurrentRiskConfig).toEqual({
      enabled: false,
      maxPositions: 1,
      maxRiskPerPosition: 2,
      maxTotalExposurePercent: 5,
    });
  });

  test('factory path reuses the extracted risk manager across orchestrator and grouped risk services', () => {
    const services = createTrackedBotFactoryRuntimeServices(
      trackedServices,
      createBotFactoryRuntimeTestConfig(),
    ) as BotServiceState;
    const orchestrator = services.tradingOrchestrator as unknown as { riskManager: unknown };

    expect(services.riskManager).toBeDefined();
    expect(services.riskServices.riskManager).toBe(services.riskManager);
    expect(orchestrator.riskManager).toBe(services.riskManager);
  });
});
