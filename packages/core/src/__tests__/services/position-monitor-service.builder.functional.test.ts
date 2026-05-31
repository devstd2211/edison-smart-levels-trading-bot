import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createPositionMonitorConfig,
  createPositionMonitorService,
  createPositionMonitorServiceDependencies,
  initializePositionMonitor,
} from '../../services/factories/builders/position-monitor-service.builder';
import { PositionMonitorService } from '../../services/position-monitor.service';
import type { PositionMonitorDependencies } from '../../services/factories/builders/position-monitoring-support.builder';
import { createWebSocketMonitoringBuilderCandleEnabledConfig } from '../helpers/bot-factory-runtime-test.utils';

describe('Position monitor service builder boundaries', () => {
  test('creates position monitor config outside the composition root body', () => {
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(createPositionMonitorConfig(config)).toEqual({
      riskManagement: config.riskManagement,
    });
  });

  test('creates position monitor dependencies and runtime service outside the composition root body', () => {
    const state = {
      bybitService: { getPosition: jest.fn() },
      positionManager: { getCurrentPosition: jest.fn(), clearPosition: jest.fn() },
      telegram: { sendAlert: jest.fn() },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      positionExitingService: { closeFullPosition: jest.fn() },
    } as unknown as BotServiceState;
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();
    const dependencies: PositionMonitorDependencies = {
      exitTypeDetectorService: {} as PositionMonitorDependencies['exitTypeDetectorService'],
      pnlCalculatorService: {} as PositionMonitorDependencies['pnlCalculatorService'],
      positionSyncService: {} as PositionMonitorDependencies['positionSyncService'],
    };

    expect(createPositionMonitorServiceDependencies(state)).toEqual({
      bybitService: state.bybitService,
      positionManager: state.positionManager,
      telegram: state.telegram,
      logger: state.logger,
      positionExitingService: state.positionExitingService,
    });

    const service = createPositionMonitorService(state, config, dependencies);

    expect(service).toBeInstanceOf(PositionMonitorService);

    initializePositionMonitor(state, config, dependencies);

    expect(state.positionMonitor).toBeInstanceOf(PositionMonitorService);
  });
});
