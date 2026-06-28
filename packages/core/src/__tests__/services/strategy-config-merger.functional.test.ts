import { StrategyConfigMergerService, ChangeReport } from '../../services/strategy-config-merger.service';
import { ConfigNew } from '../../types/legacy';
import { StrategyConfigV2 as StrategyConfig } from '../../types/legacy';
import {
  createManagedStrategyConfigMergerContext,
  createStrategyConfigMergerMainConfig,
  createStrategyConfigMergerStrategy,
} from '../helpers/strategy-config-merger-test.utils';

type AnyConfig = Parameters<StrategyConfigMergerService['mergeConfigs']>[0];
type AnyStrategy = Parameters<StrategyConfigMergerService['mergeConfigs']>[1];

const asConfig = (v: unknown): AnyConfig => v as AnyConfig;
const asStrategy = (v: unknown): AnyStrategy => v as AnyStrategy;

describe('StrategyConfigMergerService functional', () => {
  describe('mergeConfigs()', () => {
    it('returns a merged config that preserves unchanged fields', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        const result = service.mergeConfigs(
          asConfig(createStrategyConfigMergerMainConfig()),
          asStrategy(createStrategyConfigMergerStrategy()),
        ) as unknown as ReturnType<typeof createStrategyConfigMergerMainConfig>;
        expect(result.exchange.symbol).toBe('BTCUSDT');
        expect(result.trading.leverage).toBe(1);
      } finally {
        cleanup();
      }
    });

    it('merges indicator overrides from strategy', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        const result = service.mergeConfigs(
          asConfig(createStrategyConfigMergerMainConfig()),
          asStrategy(createStrategyConfigMergerStrategy()),
        ) as unknown as ReturnType<typeof createStrategyConfigMergerMainConfig>;
        const ema = result.indicators.ema as { enabled: boolean; fast: number; slow: number };
        expect(ema.fast).toBe(10);
        expect(ema.enabled).toBe(true);
        expect(ema.slow).toBe(26);
      } finally {
        cleanup();
      }
    });

    it('replaces takeProfits array entirely with strategy value', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        const strategy = asStrategy({
          ...createStrategyConfigMergerStrategy(),
          riskManagement: { takeProfits: [{ percent: 2 }, { percent: 4 }] },
        });
        const result = service.mergeConfigs(
          asConfig(createStrategyConfigMergerMainConfig()),
          strategy,
        ) as { riskManagement: { takeProfits: unknown[] } };
        expect(result.riskManagement.takeProfits).toHaveLength(2);
      } finally {
        cleanup();
      }
    });

    it('throws when mainConfig is null', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        expect(() =>
          service.mergeConfigs(null as unknown as AnyConfig, asStrategy(createStrategyConfigMergerStrategy())),
        ).toThrow('mainConfig must be a non-null object');
      } finally {
        cleanup();
      }
    });
  });

  describe('getChangeReport()', () => {
    it('returns zero changes when strategy has no overrides', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        const strategy = asStrategy({ version: 1, metadata: { name: 'no-overrides', version: '1.0' }, analyzers: [] });
        const report: ChangeReport = service.getChangeReport(
          asConfig(createStrategyConfigMergerMainConfig()),
          strategy,
        );
        expect(report.strategyName).toBe('no-overrides');
        expect(report.changesCount).toBe(0);
      } finally {
        cleanup();
      }
    });

    it('reports indicator changes from strategy overrides', () => {
      const { service, cleanup } = createManagedStrategyConfigMergerContext();
      try {
        const report: ChangeReport = service.getChangeReport(
          asConfig(createStrategyConfigMergerMainConfig()),
          asStrategy(createStrategyConfigMergerStrategy()),
        );
        expect(report.changesCount).toBeGreaterThan(0);
        const indicatorChange = report.changes.find((c) => c.path.startsWith('indicators'));
        expect(indicatorChange).toBeDefined();
      } finally {
        cleanup();
      }
    });
  });

  describe('export boundary', () => {
    it('StrategyConfigMergerService is a constructible class', () => {
      expect(typeof StrategyConfigMergerService).toBe('function');
    });
  });
});
