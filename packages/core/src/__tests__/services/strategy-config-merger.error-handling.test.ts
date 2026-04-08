/**
 * StrategyConfigMergerService Error Handling Tests
 * Phase 8.9.77: THROW (input validation) + GRACEFUL_DEGRADE (merge failures) + SKIP (logging)
 */

import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createStrategyConfigMergerLogger,
  createStrategyConfigMergerMainConfig as createMockConfig,
  createManagedStrategyConfigMergerContext,
  createStrategyConfigMergerStrategy as createMockStrategy,
} from '../helpers/strategy-config-merger-test.utils';

type ManagedStrategyConfigMergerFixtures = ReturnType<typeof createManagedStrategyConfigMergerContext>;
type StrategyConfigMergerFixtures = Pick<
  ManagedStrategyConfigMergerFixtures,
  never
> & {
  runtime: Pick<ManagedStrategyConfigMergerFixtures, 'logger' | 'service' | 'errorHandler'>;
  factories: Pick<ManagedStrategyConfigMergerFixtures, 'createService'>;
};

function bindStrategyConfigMergerFixtures() {
  let cleanup: ManagedStrategyConfigMergerFixtures['cleanup'];
  let fixtures: StrategyConfigMergerFixtures;

  beforeEach(() => {
    const managedContext = createManagedStrategyConfigMergerContext({
      logger: createStrategyConfigMergerLogger(),
    });
    cleanup = managedContext.cleanup;
    fixtures = {
      runtime: {
        logger: managedContext.logger,
        service: managedContext.service,
        errorHandler: managedContext.errorHandler,
      },
      factories: {
        createService: managedContext.createService,
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('StrategyConfigMergerService - Error Handling', () => {
  let service: StrategyConfigMergerService;
  let errorHandler: ErrorHandler;
  type MainConfigInput = Parameters<StrategyConfigMergerService['mergeConfigs']>[0];
  type ConfigValueMainInput = Parameters<StrategyConfigMergerService['getConfigValue']>[0];
  type StrategyInput = Parameters<StrategyConfigMergerService['mergeConfigs']>[1];
  type PathInput = Parameters<StrategyConfigMergerService['getConfigValue']>[2];
  const asMainConfig = (value: unknown): MainConfigInput => value as MainConfigInput;
  const asConfigValueMain = (value: unknown): ConfigValueMainInput => value as ConfigValueMainInput;
  const asStrategy = (value: unknown): StrategyInput => value as StrategyInput;
  const asPath = (value: unknown): PathInput => value as PathInput;
  const viewMerged = (value: ReturnType<StrategyConfigMergerService['mergeConfigs']>) =>
    value as unknown as {
      version: number;
      meta: unknown;
      exchange: unknown;
      indicators: { ema: { fast: number; slow: number; enabled?: boolean }; rsi: { period: number } };
      riskManagement: { stopLoss: { percent?: number; multiplier?: number } };
    };
  const viewMain = (value: MainConfigInput) =>
    value as unknown as {
      version: number;
      meta: unknown;
      exchange: unknown;
      indicators: { ema: { enabled?: boolean } };
    };
  let mockLogger: ReturnType<typeof createStrategyConfigMergerLogger>;
  let createService: StrategyConfigMergerFixtures['factories']['createService'];
  const getFixtures = bindStrategyConfigMergerFixtures();

  beforeEach(() => {
    const { runtime, factories }: StrategyConfigMergerFixtures = getFixtures();
    ({ logger: mockLogger, service, errorHandler } = runtime);
    ({ createService } = factories);
  });

  // ===== THROW: Input Validation =====
  describe('THROW: Input Validation', () => {
    it('should throw when mainConfig is null', () => {
      expect(() => {
        service.mergeConfigs(asMainConfig(null), asStrategy(createMockStrategy()));
      }).toThrow('mainConfig must be a non-null object');
    });

    it('should throw when strategy is null', () => {
      expect(() => {
        service.mergeConfigs(asMainConfig(createMockConfig()), asStrategy(null));
      }).toThrow('strategy must be a non-null object');
    });

    it('should throw when mainConfig is undefined', () => {
      expect(() => {
        service.mergeConfigs(asMainConfig(undefined), asStrategy(createMockStrategy()));
      }).toThrow('mainConfig must be a non-null object');
    });

    it('should throw when strategy is undefined', () => {
      expect(() => {
        service.mergeConfigs(asMainConfig(createMockConfig()), asStrategy(undefined));
      }).toThrow('strategy must be a non-null object');
    });

    it('should handle null path gracefully', () => {
      // When path is null, the method should return undefined (GRACEFUL_DEGRADE)
      const result = service.getConfigValue(
        asConfigValueMain(createMockConfig()),
        asStrategy(createMockStrategy()),
        asPath(null),
      );
      expect(result).toBeUndefined();
    });
  });

  // ===== GRACEFUL_DEGRADE: Merge Failures =====
  describe('GRACEFUL_DEGRADE: Merge Failures', () => {
    it('should handle merge with null riskManagement', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = { ...asStrategy(createMockStrategy()), riskManagement: null };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      // Should still return a valid config
      expect(viewMerged(result).version).toBe(viewMain(mainConfig).version);
      expect(viewMerged(result).meta).toBe(viewMain(mainConfig).meta);
      expect(viewMerged(result).exchange).toBe(viewMain(mainConfig).exchange);
      expect(result).toBeDefined();
    });

    it('should return undefined on getConfigValue failure with invalid path', () => {
      const result = service.getConfigValue(
        asConfigValueMain(createMockConfig()),
        asStrategy(createMockStrategy()),
        'invalid.deeply.nested.path.that.does.not.exist'
      );

      expect(result).toBeUndefined();
    });

    it('should return empty change report on getChangeReport failure', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        metadata: null,
      };

      const result = service.getChangeReport(mainConfig, asStrategy(strategy));

      expect(result.changesCount).toBe(0);
      expect(result.changes).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should continue with partial merge on nested failure', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        indicators: { ema: { fast: 15, slow: 30 } },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(viewMerged(result).indicators.ema.fast).toBe(15);
      expect(viewMerged(result).indicators.ema.slow).toBe(30);
    });

    it('should handle merge with missing optional fields', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        metadata: { name: 'simple' },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(result).toBeDefined();
      expect(viewMerged(result).version).toBe(viewMain(mainConfig).version);
    });
  });

  // ===== SKIP: Logging Failures =====
  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors silently', () => {
      const loggerWithError = {
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = createService({ logger: loggerWithError, errorHandler });

      expect(() => {
        serviceWithBadLogger.mergeConfigs(asMainConfig(createMockConfig()), asStrategy(createMockStrategy()));
      }).not.toThrow();
    });

    it('should continue operation when logger.warn fails', () => {
      const loggerWithError = {
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = createService({ logger: loggerWithError, errorHandler });

      const result = serviceWithBadLogger.getConfigValue(
        asConfigValueMain(createMockConfig()),
        asStrategy(createMockStrategy()),
        'invalid.path'
      );

      expect(result).toBeUndefined();
    });

    it('should handle missing logger gracefully', () => {
      const serviceNoLogger = createService({ logger: undefined, errorHandler });

      const result = serviceNoLogger.mergeConfigs(asMainConfig(createMockConfig()), asStrategy(createMockStrategy()));

      expect(result).toBeDefined();
    });

    it('should handle missing errorHandler in SKIP operations', () => {
      const serviceNoHandler = createService({ logger: mockLogger, withErrorHandler: false });

      const result = serviceNoHandler.getConfigValue(
        asConfigValueMain(createMockConfig()),
        asStrategy(createMockStrategy()),
        'invalid.path'
      );

      expect(result).toBeUndefined();
    });
  });

  // ===== Integration Tests =====
  describe('Integration: Config Merging', () => {
    it('should merge indicators correctly', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        indicators: {
          rsi: { period: 20 },
        },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(viewMerged(result).indicators.rsi.period).toBe(20);
      expect(viewMerged(result).indicators.ema.enabled).toBe(viewMain(mainConfig).indicators.ema.enabled);
    });

    it('should merge risk management overrides', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        riskManagement: {
          stopLoss: { type: 'PERCENT', percent: 3 },
        },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(viewMerged(result).riskManagement.stopLoss.percent).toBe(3);
    });

    it('should get nested config value with overrides', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        indicators: {
          ema: { fast: 15 },
        },
      };

      const result = service.getConfigValue(asConfigValueMain(mainConfig), asStrategy(strategy), 'indicators.ema.fast');

      expect(result).toBe(15);
    });

    it('should generate change report correctly', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        ...asStrategy(createMockStrategy()),
        indicators: {
          ema: { fast: 15 },
        },
      };

      const report = service.getChangeReport(mainConfig, asStrategy(strategy));

      expect(report.strategyName).toBe('test-strategy');
      expect(report.changesCount).toBeGreaterThan(0);
      expect(report.changes).toContainEqual(
        expect.objectContaining({
          path: expect.stringContaining('ema'),
        })
      );
    });

    it('should handle multiple levels of nested overrides', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        metadata: { name: 'complex-strategy' },
        indicators: {
          ema: { fast: 10, slow: 25 },
          rsi: { period: 16 },
        },
        riskManagement: {
          stopLoss: { type: 'ATR', multiplier: 3 },
          takeProfits: [{ percent: 0.5 }, { percent: 1 }, { percent: 2 }],
        },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(viewMerged(result).indicators.ema.fast).toBe(10);
      expect(viewMerged(result).indicators.rsi.period).toBe(16);
      expect(viewMerged(result).riskManagement.stopLoss.multiplier).toBe(3);
    });
  });

  // ===== Backward Compatibility =====
  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      const serviceNoHandler = createService({ logger: mockLogger, withErrorHandler: false });

      const result = serviceNoHandler.mergeConfigs(
        asMainConfig(createMockConfig()),
        asStrategy(createMockStrategy())
      );

      expect(result).toBeDefined();
    });

    it('should work without logger', () => {
      const result = service.mergeConfigs(
        asMainConfig(createMockConfig()),
        asStrategy(createMockStrategy())
      );

      expect(result).toBeDefined();
    });

    it('should throw on validation errors even without ErrorHandler', () => {
      const serviceNoHandler = createService({ logger: undefined, withErrorHandler: false });

      expect(() => {
        serviceNoHandler.mergeConfigs(asMainConfig(null), asStrategy(createMockStrategy()));
      }).toThrow();
    });
  });

  // ===== Edge Cases =====
  describe('Edge Cases', () => {
    it('should handle empty strategy overrides', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = {
        metadata: { name: 'empty-strategy' },
      };

      const result = service.mergeConfigs(mainConfig, asStrategy(strategy));

      expect(result).toEqual(mainConfig);
    });

    it('should handle strategy with empty metadata', () => {
      const strategy = {
        metadata: { name: '' },
      };

      expect(() => {
        service.getChangeReport(asMainConfig(createMockConfig()), asStrategy(strategy));
      }).not.toThrow();
    });

    it('should handle deeply nested path lookups', () => {
      const mainConfig = asMainConfig(createMockConfig());
      const strategy = asStrategy(createMockStrategy());

      const result = service.getConfigValue(
        asConfigValueMain(mainConfig),
        strategy,
        'indicators.ema.fast'
      );

      expect(result).toBeDefined();
    });

    it('should return undefined for non-existent paths without throwing', () => {
      const result = service.getConfigValue(
        asConfigValueMain(createMockConfig()),
        asStrategy(createMockStrategy()),
        'nonexistent.deeply.nested.path'
      );

      expect(result).toBeUndefined();
    });
  });
});

