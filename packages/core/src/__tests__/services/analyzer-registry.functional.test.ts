import { StrategyAnalyzerConfig } from '../../types/strategy-config';
import { IndicatorType } from '../../types/indicator';
import type { IIndicator } from '../../types/legacy';
import {
  createAnalyzerRegistryAnalyzerConfigs,
  createAnalyzerRegistryBaseConfig,
  createManagedAnalyzerRegistryContext,
} from '../helpers/analyzer-registry-test.utils';

describe('AnalyzerRegistryService functional behavior', () => {
  it('merges config, injects indicators, skips unknown analyzers, and reuses cached instances', async () => {
    const { registry, cleanup } = createManagedAnalyzerRegistryContext();

    class FakeAnalyzer {
      constructor(
        readonly config: Record<string, unknown>,
        readonly logger: unknown,
        readonly indicator?: unknown,
      ) {}
    }

    const analyzerClasses = new Map<string, () => Promise<unknown>>([
      ['EMA_ANALYZER_NEW', async () => FakeAnalyzer],
    ]);

    (registry as unknown as { analyzerClasses: Map<string, () => Promise<unknown>> }).analyzerClasses = analyzerClasses;

    const emaIndicator = {
      calculate: jest.fn(),
      getValue: jest.fn(),
      getType: jest.fn().mockReturnValue('EMA'),
      isReady: jest.fn().mockReturnValue(true),
      getMinCandlesRequired: jest.fn().mockReturnValue(14),
    } as unknown as IIndicator;

    registry.setIndicators(new Map([
      [IndicatorType.EMA, emaIndicator],
    ]));

    const config = createAnalyzerRegistryBaseConfig();
    const analyzers: StrategyAnalyzerConfig[] = createAnalyzerRegistryAnalyzerConfigs([
      {
        name: 'EMA_ANALYZER_NEW',
        priority: 9,
        weight: 1.5,
        params: { smoothing: 3 },
      },
    ]);

    const enabled = await registry.getEnabledAnalyzers(analyzers, config);
    const cached = await registry.getAnalyzerInstance(config, analyzers[0]);

    expect(enabled.size).toBe(1);
    expect(enabled.get('EMA_ANALYZER_NEW')).toEqual(
      expect.objectContaining({
        weight: 1.5,
        priority: 9,
      }),
    );

    const instance = enabled.get('EMA_ANALYZER_NEW')?.instance as FakeAnalyzer;
    expect(instance).toBeInstanceOf(FakeAnalyzer);
    expect(instance.config).toEqual(
      expect.objectContaining({
        enabled: true,
        weight: 1.5,
        priority: 9,
        minConfidence: 0.5,
        period: 20,
        smoothing: 3,
      }),
    );
    expect((instance.indicator as IIndicator).getType()).toBe('EMA');
    expect(cached).toBe(instance);

    cleanup();
  });
});
