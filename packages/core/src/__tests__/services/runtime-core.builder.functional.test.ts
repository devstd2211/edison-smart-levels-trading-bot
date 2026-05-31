import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createRuntimeCoreConfig,
  initializeRuntimeCoreServices,
} from '../../services/factories/builders/runtime-core.builder';
import {
  createBotFactoryServiceBoundaryRuntimeDefaultConfig,
  createTrackedBotFactoryBuilderState,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Runtime core builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates runtime core config outside the composition root body', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();
    delete config.telegram;

    expect(createRuntimeCoreConfig(config)).toEqual({
      telegram: { enabled: false },
      timeSyncIntervalMs: config.system.timeSyncIntervalMs,
      timeSyncMaxFailures: config.system.timeSyncMaxFailures,
    });
  });

  test('creates telegram and time services outside the composition root body', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();
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

    initializeRuntimeCoreServices(state, config);

    expect(state.telegram).toBeDefined();
    expect(state.timeService).toBeDefined();
    expect(state.timeService.getSyncInfo().offset).toBe(0);
  });

  test('builder path wires extracted runtime core builder through service creation', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();
    const state = createTrackedBotFactoryBuilderState(trackedServices, config);

    expect(state.telegram).toBeDefined();
    expect(state.timeService).toBeDefined();
    expect(state.coreServices.telegram).toBe(state.telegram);
    expect(state.coreServices.timeService).toBe(state.timeService);
  });
});
