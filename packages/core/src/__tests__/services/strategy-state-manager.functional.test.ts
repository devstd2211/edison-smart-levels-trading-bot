import { StrategyStateManagerService } from '../../services/multi-strategy/strategy-state-manager.service';
import type { IsolatedStrategyContext, StrategyStateSnapshot } from '../../types/legacy';

function createSnapshot(strategyId: string): StrategyStateSnapshot {
  return {
    strategyId,
    strategyName: `${strategyId}-name`,
    positions: [{ id: `${strategyId}-pos`, pnl: 1 }],
    journal: [{ id: `${strategyId}-journal`, action: 'enter' }],
    metrics: {
      totalPnL: 10,
      winRate: 0.5,
      profitFactor: 1.2,
      maxDrawdown: 0.1,
      sharpeRatio: 1,
    },
    timestamp: new Date('2026-05-08T10:00:00.000Z'),
    lastCandleTime: new Date('2026-05-08T10:05:00.000Z'),
    riskMonitorState: { state: 'ok' },
  };
}

function createContext(strategyId: string): IsolatedStrategyContext {
  const snapshot = createSnapshot(strategyId);
  return {
    strategyId,
    strategyName: snapshot.strategyName,
    symbol: 'BTCUSDT',
    config: {} as never,
    strategy: {} as never,
    exchange: {} as never,
    analyzers: [],
    createdAt: new Date(),
    isActive: false,
    getStateSnapshot: jest.fn(() => ({
      ...snapshot,
      positions: snapshot.positions.map((position) => ({ ...position })),
      journal: snapshot.journal.map((entry) => ({ ...entry })),
      metrics: { ...snapshot.metrics },
      timestamp: new Date(snapshot.timestamp),
      lastCandleTime: snapshot.lastCandleTime ? new Date(snapshot.lastCandleTime) : undefined,
      riskMonitorState: snapshot.riskMonitorState ? { ...snapshot.riskMonitorState } : undefined,
    })),
    restoreFromSnapshot: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };
}

describe('StrategyStateManagerService functional', () => {
  it('returns detached saved snapshots during strategy switching', async () => {
    const manager = new StrategyStateManagerService();
    const currentContext = createContext('alpha');
    const targetContext = createContext('beta');

    const result = await manager.switchStrategy(currentContext, targetContext);
    result.savedState!.positions[0].id = 'mutated';

    expect(currentContext.getStateSnapshot().positions[0].id).toBe('alpha-pos');
    expect(result.success).toBe(true);
    expect(targetContext.isActive).toBe(true);
  });

  it('captures detached snapshots when snapshotting all strategies', async () => {
    const manager = new StrategyStateManagerService();
    const contexts = [createContext('alpha'), createContext('beta')];

    const snapshots = await manager.snapshotAllStrategies(contexts);
    snapshots[0].journal[0].id = 'mutated';

    expect(contexts[0].getStateSnapshot().journal[0].id).toBe('alpha-journal');
    expect(snapshots).toHaveLength(2);
  });

  it('exposes only snapshot-specific persistence methods', () => {
    const manager = new StrategyStateManagerService() as StrategyStateManagerService & {
      persistState?: unknown;
      restoreState?: unknown;
    };

    expect(manager.persistState).toBeUndefined();
    expect(manager.restoreState).toBeUndefined();
    expect(manager.persistStateSnapshot).toBeInstanceOf(Function);
    expect(manager.restoreStateSnapshot).toBeInstanceOf(Function);
  });
});
