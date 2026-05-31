import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createCoreInfrastructureConfig,
  initializeCoreInfrastructure,
} from '../../services/factories/builders/core-infrastructure.builder';
import {
  createCoreInfrastructureBuilderDashboardEnabledConfig,
  createTrackedBotFactoryBuilderState,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Core infrastructure builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates core infrastructure config outside the composition root body', () => {
    const config = createCoreInfrastructureBuilderDashboardEnabledConfig();

    expect(createCoreInfrastructureConfig(config)).toEqual({
      logging: config.logging,
      dashboard: {
        enabled: true,
        updateInterval: 2500,
        theme: 'light',
      },
      strategyMeta: {
        strategy: 'breakout',
        strategyFile: 'strategies/json/breakout.strategy.json',
        notes: 'builder boundary fixture',
      },
      analyzers: config.analyzers,
      indicators: config.indicators,
    });
  });

  test('creates dashboard, logger, repositories, and monitoring primitives outside the composition root body', () => {
    const config = createCoreInfrastructureBuilderDashboardEnabledConfig();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const state = {} as BotServiceState;

      initializeCoreInfrastructure(state, config);

      expect(state.dashboard).toBeDefined();
      expect(state.logger).toBeDefined();
      expect(state.errorHandler).toBeDefined();
      expect(state.eventBus).toBeDefined();
      expect(state.metrics).toBeDefined();
      expect(state.positionRepository).toBeDefined();
      expect(state.journalRepository).toBeDefined();
      expect(state.marketDataRepository).toBeDefined();
      expect(state.logger.getLogFilePath()).toContain('trading-bot-');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Console Dashboard ENABLED'));
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('builder path wires extracted core infrastructure builder through state creation', () => {
    const config = createCoreInfrastructureBuilderDashboardEnabledConfig();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const state = createTrackedBotFactoryBuilderState(trackedServices, config);

      expect(state.dashboard).toBeDefined();
      expect(state.logger).toBeDefined();
      expect(state.errorHandler).toBeDefined();
      expect(state.eventBus).toBeDefined();
      expect(state.metrics).toBeDefined();
      expect(state.positionRepository).toBeDefined();
      expect(state.journalRepository).toBeDefined();
      expect(state.marketDataRepository).toBeDefined();
      expect(state.coreServices.logger).toBe(state.logger);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
