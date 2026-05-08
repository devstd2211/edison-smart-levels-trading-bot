import { StrategyFactoryService } from '../../services/multi-strategy/strategy-factory.service';
import type { StrategyFactoryConfig } from '../../types/legacy';

function createFactoryConfig(): StrategyFactoryConfig {
  return {
    baseConfig: { exchange: { symbol: 'BTCUSDT' } } as never,
    persistence: {
      stateDir: './tmp',
      autoPersist: false,
      persistInterval: 0,
      maxSnapshots: 5,
      compressSnapshots: false,
    },
    registry: {
      maxStrategies: 5,
      trackHistory: false,
      validateOnRegister: false,
    },
    validationRules: {
      minConfidenceRange: [0, 100],
      analyzerWeightRange: [0, 1],
      reservedFields: [],
      requiredFields: [],
    },
    autoRestorePreviousState: false,
  };
}

describe('StrategyFactoryService functional', () => {
  it('creates contexts whose state snapshots are detached from subsequent mutations', async () => {
    const loader = {
      loadStrategy: jest.fn().mockResolvedValue({ metadata: { version: '1.0.0' } }),
    };
    const merger = {
      mergeConfigs: jest.fn((base) => base),
    };

    const factory = new StrategyFactoryService(createFactoryConfig(), loader as never, merger as never);
    jest.spyOn(factory as never, 'createExchangeInstance').mockReturnValue({} as never);
    jest.spyOn(factory as never, 'createAnalyzerInstances').mockReturnValue([] as never);

    const context = await factory.createContext('alpha', 'BTCUSDT');
    context.lastCandleTime = new Date('2026-05-08T10:00:00.000Z');

    const snapshot = context.getStateSnapshot();
    snapshot.lastCandleTime?.setUTCFullYear(2030);

    expect(context.getStateSnapshot().lastCandleTime?.toISOString()).toBe('2026-05-08T10:00:00.000Z');
  });
});
