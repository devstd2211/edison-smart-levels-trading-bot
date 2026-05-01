import {
  buildStrategyMetadata,
  buildStrategyStats,
  buildSystemStatsBase,
  getConfigVersion,
} from '../../services/multi-strategy/strategy-orchestrator-state.utils';
import type { IsolatedStrategyContext } from '../../types/legacy';

function createContext(
  overrides: Partial<IsolatedStrategyContext> = {},
): IsolatedStrategyContext {
  return {
    strategyId: 'strategy-1',
    strategyName: 'mean-revert',
    symbol: 'BTCUSDT',
    config: { version: '2.0.0' } as never,
    strategy: { metadata: { version: '2.0.0' } } as never,
    exchange: {} as never,
    analyzers: [] as never,
    createdAt: new Date(Date.now() - 60_000),
    isActive: true,
    getSnapshot: jest.fn(),
    restoreFromSnapshot: jest.fn(),
    cleanup: jest.fn(),
    ...overrides,
  };
}

describe('strategy-orchestrator-state.utils', () => {
  it('builds strategy metadata and stats', () => {
    const context = createContext();
    const metadata = buildStrategyMetadata(context, true);
    const stats = buildStrategyStats(context.strategyId, context, metadata);

    expect(metadata.name).toBe('mean-revert');
    expect(stats.strategyId).toBe('strategy-1');
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });

  it('builds system stats base and resolves config version', () => {
    const context = createContext();
    const stats = buildSystemStatsBase([context], context);

    expect(stats.totalStrategies).toBe(1);
    expect(stats.activeStrategies).toBe(1);
    expect(getConfigVersion(context.config)).toBe('2.0.0');
  });
});
