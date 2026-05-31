import { createRiskManagerConfig } from '../../services/factories/builders/risk-manager-config.builder';
import { createRiskMonitoringConfig } from '../../services/factories/builders/risk-monitoring-config.builder';
import type { BotServiceState } from '../../services/bot-services.builder';
import { createPositionManagementConfig } from '../../services/factories/builders/position-management.builder';
import {
  createPositionManagementBuilderRiskMonitoringDisabledConfig,
  createPositionManagementBuilderRiskMonitoringEnabledConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Position management builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates default risk manager config outside the composition root body', () => {
    expect(createRiskManagerConfig()).toEqual({
      dailyLimits: {
        maxDailyLossPercent: 5,
        maxDailyProfitPercent: undefined,
        emergencyStopOnLimit: true,
      },
      lossStreak: {
        stopAfterLosses: 4,
        reductions: {
          after2Losses: 0.75,
          after3Losses: 0.5,
          after4Losses: 0.25,
        },
      },
      concurrentRisk: {
        enabled: false,
        maxPositions: 1,
        maxRiskPerPosition: 2,
        maxTotalExposurePercent: 5,
      },
      positionSizing: {
        riskPerTradePercent: 1,
        minPositionSizeUsdt: 5,
        maxPositionSizeUsdt: 100,
        maxLeverageMultiplier: 2,
      },
    });
  });

  test('creates risk monitoring config from defaults and live trading overrides', () => {
    const config = createPositionManagementBuilderRiskMonitoringDisabledConfig();

    expect(createRiskMonitoringConfig(config)).toEqual({
      enabled: false,
      checkIntervalCandles: 3,
      healthScoreThreshold: 45,
      emergencyCloseOnCritical: false,
    });
  });

  test('creates position-management config outside the composition root body', () => {
    const config = createPositionManagementBuilderRiskMonitoringEnabledConfig();

    expect(createPositionManagementConfig(config)).toMatchObject({
      trading: config.trading,
      riskManagement: config.riskManagement,
      entryConfirmation: config.entryConfirmation,
      liveTrading: (config as Partial<{ liveTrading: unknown }>).liveTrading,
    });
  });

  test('factory path wires extracted position-management builders through service creation', () => {
    const config = createPositionManagementBuilderRiskMonitoringEnabledConfig();

    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config);
    const executionServices = services.executionServices as typeof services.executionServices & {
      positionExitingService: NonNullable<BotServiceState['positionExitingService']>;
      realTimeRiskMonitor: NonNullable<BotServiceState['realTimeRiskMonitor']>;
    };

    expect(executionServices.positionManager).toBeDefined();
    expect(executionServices.positionExitingService).toBeDefined();
    expect(executionServices.realTimeRiskMonitor).toBeDefined();
    expect(executionServices.realTimeRiskMonitor.getStatistics()).toEqual({
      positionsMonitored: 0,
      lastCheckTime: 0,
      cachedScores: 0,
      generatedAlerts: 0,
    });
  });
});
