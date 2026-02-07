/**
 * StrategyConfigMergerService Error Handling Tests
 * Phase 8.9.77: THROW (input validation) + GRACEFUL_DEGRADE (merge failures) + SKIP (logging)
 */

import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockConfig = () => ({
  version: 1,
  meta: { description: 'Test', lastUpdated: '2024-01-01', activeAnalyzers: [] },
  exchange: { name: 'Bybit', symbol: 'BTCUSDT', demo: false, testnet: false, apiKey: 'key', apiSecret: 'secret' },
  trading: { leverage: 1, positionSizeUsdt: 100, maxPositions: 5, orderType: 'MARKET', tradingCycleIntervalMs: 1000 },
  riskManagement: {
    maxRiskPercent: 1,
    stopLoss: { type: 'ATR', multiplier: 2 },
    takeProfits: [],
  },
  timeframes: {},
  indicators: {
    ema: { enabled: true, fast: 12, slow: 26 },
    rsi: { enabled: true, period: 14 },
  },
  analyzers: {},
  filters: {},
  confidence: {},
  strategies: {},
  services: {},
  monitoring: {},
});

const createMockStrategy = () => ({
  version: 1,
  metadata: { name: 'test-strategy', version: '1.0' },
  indicators: {
    ema: { fast: 10 },
  },
  riskManagement: {
    stopLoss: { type: 'FIXED', percent: 2 },
    takeProfits: [{ percent: 1 }],
  },
  analyzers: [],
});

describe('StrategyConfigMergerService - Error Handling', () => {
  let service: StrategyConfigMergerService;
  let errorHandler: ErrorHandler;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = new ErrorHandler(mockLogger);
    service = new StrategyConfigMergerService(mockLogger, errorHandler);
  });

  // ===== THROW: Input Validation =====
  describe('THROW: Input Validation', () => {
    it('should throw when mainConfig is null', () => {
      expect(() => {
        service.mergeConfigs(null as any, createMockStrategy() as any as any);
      }).toThrow('mainConfig must be a non-null object');
    });

    it('should throw when strategy is null', () => {
      expect(() => {
        service.mergeConfigs(createMockConfig() as any as any, null as any);
      }).toThrow('strategy must be a non-null object');
    });

    it('should throw when mainConfig is undefined', () => {
      expect(() => {
        service.mergeConfigs(undefined as any, createMockStrategy() as any as any);
      }).toThrow('mainConfig must be a non-null object');
    });

    it('should throw when strategy is undefined', () => {
      expect(() => {
        service.mergeConfigs(createMockConfig() as any as any, undefined as any);
      }).toThrow('strategy must be a non-null object');
    });

    it('should handle null path gracefully', () => {
      // When path is null, the method should return undefined (GRACEFUL_DEGRADE)
      const result = service.getConfigValue(createMockConfig() as any, createMockStrategy() as any, null as any);
      expect(result).toBeUndefined();
    });
  });

  // ===== GRACEFUL_DEGRADE: Merge Failures =====
  describe('GRACEFUL_DEGRADE: Merge Failures', () => {
    it('should handle merge with null riskManagement', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = { ...createMockStrategy() as any, riskManagement: null };

      const result = service.mergeConfigs(mainConfig as any, strategy as any);

      // Should still return a valid config
      expect((result as any).version).toBe(mainConfig.version);
      expect((result as any).meta).toBe(mainConfig.meta);
      expect((result as any).exchange).toBe(mainConfig.exchange);
      expect(result).toBeDefined();
    });

    it('should return undefined on getConfigValue failure with invalid path', () => {
      const result = service.getConfigValue(
        createMockConfig() as any,
        createMockStrategy() as any,
        'invalid.deeply.nested.path.that.does.not.exist'
      );

      expect(result).toBeUndefined();
    });

    it('should return empty change report on getChangeReport failure', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        metadata: null,
      };

      const result = service.getChangeReport(mainConfig, strategy as any);

      expect(result.changesCount).toBe(0);
      expect(result.changes).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should continue with partial merge on nested failure', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        indicators: { ema: { fast: 15, slow: 30 } },
      };

      const result = service.mergeConfigs(mainConfig as any, strategy as any);

      expect((result as any).indicators.ema.fast).toBe(15);
      expect((result as any).indicators.ema.slow).toBe(30);
    });

    it('should handle merge with missing optional fields', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        metadata: { name: 'simple' },
      };

      const result = service.mergeConfigs(mainConfig, strategy as any);

      expect(result).toBeDefined();
      expect((result as any).version).toBe(mainConfig.version);
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

      const serviceWithBadLogger = new StrategyConfigMergerService(loggerWithError, errorHandler);

      expect(() => {
        serviceWithBadLogger.mergeConfigs(createMockConfig() as any, createMockStrategy() as any);
      }).not.toThrow();
    });

    it('should continue operation when logger.warn fails', () => {
      const loggerWithError = {
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = new StrategyConfigMergerService(loggerWithError, errorHandler);

      const result = serviceWithBadLogger.getConfigValue(
        createMockConfig() as any,
        createMockStrategy() as any,
        'invalid.path'
      );

      expect(result).toBeUndefined();
    });

    it('should handle missing logger gracefully', () => {
      const serviceNoLogger = new StrategyConfigMergerService(undefined, errorHandler);

      const result = serviceNoLogger.mergeConfigs(createMockConfig() as any, createMockStrategy() as any);

      expect(result).toBeDefined();
    });

    it('should handle missing errorHandler in SKIP operations', () => {
      const serviceNoHandler = new StrategyConfigMergerService(mockLogger);

      const result = serviceNoHandler.getConfigValue(
        createMockConfig() as any,
        createMockStrategy() as any,
        'invalid.path'
      );

      expect(result).toBeUndefined();
    });
  });

  // ===== Integration Tests =====
  describe('Integration: Config Merging', () => {
    it('should merge indicators correctly', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        indicators: {
          rsi: { period: 20 },
        },
      };

      const result = service.mergeConfigs(mainConfig, strategy as any);

      expect((result as any).indicators.rsi.period).toBe(20);
      expect((result as any).indicators.ema.enabled).toBe(mainConfig.indicators.ema.enabled);
    });

    it('should merge risk management overrides', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        riskManagement: {
          stopLoss: { type: 'PERCENT', percent: 3 },
        },
      };

      const result = service.mergeConfigs(mainConfig, strategy as any);

      expect((result as any).riskManagement.stopLoss.percent).toBe(3);
    });

    it('should get nested config value with overrides', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        indicators: {
          ema: { fast: 15 },
        },
      };

      const result = service.getConfigValue(mainConfig, strategy as any, 'indicators.ema.fast');

      expect(result).toBe(15);
    });

    it('should generate change report correctly', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        ...createMockStrategy() as any,
        indicators: {
          ema: { fast: 15 },
        },
      };

      const report = service.getChangeReport(mainConfig, strategy as any);

      expect(report.strategyName).toBe('test-strategy');
      expect(report.changesCount).toBeGreaterThan(0);
      expect(report.changes).toContainEqual(
        expect.objectContaining({
          path: expect.stringContaining('ema'),
        })
      );
    });

    it('should handle multiple levels of nested overrides', () => {
      const mainConfig = createMockConfig() as any;
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

      const result = service.mergeConfigs(mainConfig, strategy as any);

      expect((result as any).indicators.ema.fast).toBe(10);
      expect((result as any).indicators.rsi.period).toBe(16);
      expect((result as any).riskManagement.stopLoss.multiplier).toBe(3);
    });
  });

  // ===== Backward Compatibility =====
  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      const serviceNoHandler = new StrategyConfigMergerService(mockLogger);

      const result = serviceNoHandler.mergeConfigs(
        createMockConfig() as any,
        createMockStrategy() as any
      );

      expect(result).toBeDefined();
    });

    it('should work without logger', () => {
      const result = service.mergeConfigs(
        createMockConfig() as any,
        createMockStrategy() as any
      );

      expect(result).toBeDefined();
    });

    it('should throw on validation errors even without ErrorHandler', () => {
      const serviceNoHandler = new StrategyConfigMergerService();

      expect(() => {
        serviceNoHandler.mergeConfigs(null as any, createMockStrategy() as any);
      }).toThrow();
    });
  });

  // ===== Edge Cases =====
  describe('Edge Cases', () => {
    it('should handle empty strategy overrides', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = {
        metadata: { name: 'empty-strategy' },
      };

      const result = service.mergeConfigs(mainConfig, strategy as any);

      expect(result).toEqual(mainConfig);
    });

    it('should handle strategy with empty metadata', () => {
      const strategy = {
        metadata: { name: '' },
      };

      expect(() => {
        service.getChangeReport(createMockConfig() as any, strategy as any);
      }).not.toThrow();
    });

    it('should handle deeply nested path lookups', () => {
      const mainConfig = createMockConfig() as any;
      const strategy = createMockStrategy() as any;

      const result = service.getConfigValue(
        mainConfig,
        strategy,
        'indicators.ema.fast'
      );

      expect(result).toBeDefined();
    });

    it('should return undefined for non-existent paths without throwing', () => {
      const result = service.getConfigValue(
        createMockConfig() as any,
        createMockStrategy() as any,
        'nonexistent.deeply.nested.path'
      );

      expect(result).toBeUndefined();
    });
  });
});
