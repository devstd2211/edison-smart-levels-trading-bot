import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createPositionMonitorDependencies,
  createPositionMonitorRuntimeServices,
  createPositionMonitoringSupportDependencies,
} from '../../services/factories/builders/position-monitoring-support.builder';

describe('Position monitoring support builder boundaries', () => {
  test('creates support dependencies and runtime services outside the composition root body', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      bybitService: { getPosition: jest.fn() },
      positionManager: { getCurrentPosition: jest.fn(), clearPosition: jest.fn() },
      telegram: { sendAlert: jest.fn() },
      positionExitingService: { closeFullPosition: jest.fn() },
    } as unknown as BotServiceState;

    const dependencies = createPositionMonitoringSupportDependencies(state);

    expect(dependencies).toEqual({
      logger,
      bybitService: state.bybitService,
      positionManager: state.positionManager,
      telegram: state.telegram,
      positionExitingService: state.positionExitingService,
    });

    expect(createPositionMonitorRuntimeServices(dependencies)).toEqual({
      exitTypeDetectorService: expect.anything(),
      pnlCalculatorService: expect.anything(),
      positionSyncService: expect.anything(),
    });

    expect(createPositionMonitorDependencies(state)).toEqual({
      exitTypeDetectorService: expect.anything(),
      pnlCalculatorService: expect.anything(),
      positionSyncService: expect.anything(),
    });
  });
});
