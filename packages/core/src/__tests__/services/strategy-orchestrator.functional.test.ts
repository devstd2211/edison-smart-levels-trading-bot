import { StrategyRegistryService } from '../../services/multi-strategy/strategy-registry.service';
import { StrategyOrchestratorService } from '../../services/multi-strategy/strategy-orchestrator.service';

describe('StrategyOrchestratorService functional', () => {
  it('loads, switches, and reports strategy stats through the public API', async () => {
    const registry = new StrategyRegistryService();
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const eventBus = { publishSync: jest.fn(), publish: jest.fn(), subscribe: jest.fn() };

    const firstContext = {
      strategyId: 's1',
      strategyName: 'alpha',
      symbol: 'BTCUSDT',
      config: { version: '1.0.0' },
      strategy: { metadata: { version: '1.0.0' } },
      exchange: {},
      analyzers: [],
      createdAt: new Date(),
      isActive: false,
      getStateSnapshot: jest.fn(),
      getSnapshot: jest.fn(),
      restoreFromSnapshot: jest.fn(),
      cleanup: jest.fn(),
    };
    const secondContext = {
      ...firstContext,
      strategyId: 's2',
      strategyName: 'beta',
    };

    const factory = {
      createContext: jest
        .fn()
        .mockResolvedValueOnce(firstContext)
        .mockResolvedValueOnce(secondContext),
      destroyContext: jest.fn().mockResolvedValue(undefined),
    };
    const stateManager = {
      switchStrategy: jest.fn().mockResolvedValue({ success: true }),
      snapshotAll: jest.fn().mockResolvedValue(undefined),
    };

    const service = new StrategyOrchestratorService(
      registry,
      factory as never,
      stateManager as never,
      logger as never,
      eventBus as never,
    );

    await service.loadStrategy('alpha');
    const secondId = await service.addStrategy('beta');
    await service.switchTradingStrategy(secondId);

    expect(service.getActiveContext()?.strategyId).toBe('s2');
    expect(service.getStrategyStats('s1')?.strategyName).toBe('alpha');
    expect(service.getOverallStats().totalStrategies).toBe(2);
  });
});
