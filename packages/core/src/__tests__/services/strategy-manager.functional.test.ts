import { StrategyManagerService } from '../../services/strategy-manager.service';
import {
  createManagedStrategyManagerContext,
  type StrategyManagerErrorHandlingState,
} from '../helpers/strategy-manager-test.utils';

describe('StrategyManagerService functional behavior', () => {
  let manager: StrategyManagerService;
  let createManager: StrategyManagerErrorHandlingState['createManager'];
  let mockLoader: StrategyManagerErrorHandlingState['mockLoader'];
  let mockMerger: StrategyManagerErrorHandlingState['mockMerger'];
  let mockStrategy: StrategyManagerErrorHandlingState['mockStrategy'];
  let mockMainConfig: StrategyManagerErrorHandlingState['mockMainConfig'];
  let consoleLogSpy: StrategyManagerErrorHandlingState['consoleLogSpy'];
  let cleanup: StrategyManagerErrorHandlingState['cleanup'];

  beforeEach(() => {
    ({
      createManager,
      mockLoader,
      mockMerger,
      mockStrategy,
      mockMainConfig,
      consoleLogSpy,
      cleanup,
    } = createManagedStrategyManagerContext());
    manager = createManager();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads a strategy, merges overrides, and logs readable override diffs', async () => {
    const mergedConfig = {
      ...mockMainConfig,
      risk: { maxSize: 200 },
    } as typeof mockMainConfig;
    const changeReport = {
      strategyName: 'test-strategy',
      changesCount: 2,
      changes: [
        { path: 'risk.maxSize', original: 100, overridden: 200 },
        { path: 'exchange.symbols', original: ['BTCUSDT'], overridden: ['BTCUSDT', 'ETHUSDT'] },
      ],
    };

    mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
    mockMerger.mergeConfigs.mockReturnValue(mergedConfig);
    mockMerger.getChangeReport.mockReturnValue(changeReport);

    await manager.initialize('test-strategy', mockMainConfig);

    expect(manager.isReady()).toBe(true);
    expect(manager.getStrategyName()).toBe('test-strategy');
    expect(manager.getMergedConfig()).toEqual(mergedConfig);
    expect(consoleLogSpy).toHaveBeenCalledWith('  - risk.maxSize: 100 -> 200');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '  - exchange.symbols: ["BTCUSDT"] -> ["BTCUSDT","ETHUSDT"]',
    );
  });
});
