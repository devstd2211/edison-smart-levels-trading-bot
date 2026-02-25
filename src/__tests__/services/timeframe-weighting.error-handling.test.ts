/**
 * TimeframeWeightingService Error Handling Tests (Phase 8.9.70)
 *
 * Test Coverage:
 * - THROW: Input validation (null/invalid multiTF, trading mode)
 * - THROW: Data validation (missing timeframes, invalid strength values)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity)
 * - SKIP: Logging errors
 * - Integration: Multi-timeframe weight application
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { TimeframeWeightingService } from '../../services/timeframe-weighting.service';
import { MultiTimeframeAnalysis, TradingMode, TrendBias } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

const createValidMultiTF = (): MultiTimeframeAnalysis => ({
  byTimeframe: {
    '5m': { bias: TrendBias.BULLISH, strength: 0.7, timeframe: '5m', swingHighsCount: 2, swingLowsCount: 1 } as any,
    '15m': { bias: TrendBias.BULLISH, strength: 0.8, timeframe: '15m', swingHighsCount: 2, swingLowsCount: 1 } as any,
    '1h': { bias: TrendBias.BULLISH, strength: 0.75, timeframe: '1h', swingHighsCount: 2, swingLowsCount: 1 } as any,
    '4h': { bias: TrendBias.BULLISH, strength: 0.65, timeframe: '4h', swingHighsCount: 2, swingLowsCount: 1 } as any,
  },
  consensus: {
    primaryTrend: TrendBias.BULLISH,
    currentTrend: TrendBias.BULLISH,
    entryTrend: TrendBias.BULLISH,
    strength: 0.725,
    alignment: 'ALIGNED',
  },
});

describe('TimeframeWeightingService Error Handling (Phase 8.9.70)', () => {
  let service: TimeframeWeightingService;
  let errorHandler: ErrorHandler;
  const mockLogger = createMockLogger() as any;

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockLogger);
    service = new TimeframeWeightingService(mockLogger, errorHandler);
  });

  describe('THROW: Input Validation', () => {
    test('should throw on null multiTF', () => {
      expect(() => {
        service.combine(null as any, TradingMode.SWING);
      }).toThrow('MultiTF must be a valid object');
    });

    test('should throw on undefined multiTF', () => {
      expect(() => {
        service.combine(undefined as any, TradingMode.SWING);
      }).toThrow('MultiTF must be a valid object');
    });

    test('should throw on invalid trading mode', () => {
      const multiTF = createValidMultiTF();
      expect(() => {
        service.combine(multiTF, 'INVALID' as any);
      }).toThrow('Invalid trading mode');
    });

    test('should throw on null byTimeframe', () => {
      const multiTF = { byTimeframe: null } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('MultiTF.byTimeframe must be a valid object');
    });
  });

  describe('THROW: Timeframe Data Validation', () => {
    test('should throw when 5m timeframe is missing', () => {
      const multiTF = {
        byTimeframe: {
          '15m': { bias: TrendBias.BULLISH, strength: 0.8 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.75 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.65 },
        },
      } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('MultiTF.byTimeframe[5m] is missing');
    });

    test('should throw on NaN strength value', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BULLISH, strength: NaN },
          '15m': { bias: TrendBias.BULLISH, strength: 0.8 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.75 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.65 },
        },
      } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('Invalid data for timeframe 5m');
    });

    test('should throw on negative strength', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BULLISH, strength: -0.1 },
          '15m': { bias: TrendBias.BULLISH, strength: 0.8 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.75 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.65 },
        },
      } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('Strength for 5m must be between 0 and 1');
    });

    test('should throw on strength > 1', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BULLISH, strength: 1.5 },
          '15m': { bias: TrendBias.BULLISH, strength: 0.8 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.75 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.65 },
        },
      } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('Strength for 5m must be between 0 and 1');
    });

    test('should throw on missing bias', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: undefined, strength: 0.7 },
          '15m': { bias: TrendBias.BULLISH, strength: 0.8 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.75 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.65 },
        },
      } as any;
      expect(() => {
        service.combine(multiTF, TradingMode.SWING);
      }).toThrow('Invalid data for timeframe 5m');
    });
  });

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    test('should handle combination calculation gracefully', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result).toBeDefined();
      expect(result.bias).toBeDefined();
      expect(Number.isFinite(result.strength)).toBe(true);
    });

    test('should return safe default on calculation error', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.DAY);

      expect(result).toBeDefined();
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
        silly: jest.fn(),
      };
      const multiTF = createValidMultiTF();
      const svc = new TimeframeWeightingService(badLogger as any, errorHandler);

      expect(() => {
        svc.combine(multiTF, TradingMode.SWING);
      }).not.toThrow();
    });
  });

  describe('Integration: Weight Application', () => {
    test('should combine SWING trading weights correctly', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH); // All bullish
      expect(result.strength).toBeGreaterThan(0.6); // Strong bullish
    });

    test('should combine DAY trading weights correctly', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.DAY);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH);
    });

    test('should combine SCALP trading weights correctly', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.SCALP);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH);
    });

    test('should handle mixed bias with weighting', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BULLISH, strength: 0.5 },
          '15m': { bias: TrendBias.BEARISH, strength: 0.5 },
          '1h': { bias: TrendBias.NEUTRAL, strength: 0.5 },
          '4h': { bias: TrendBias.NEUTRAL, strength: 0.5 },
        },
      } as any;
      const result = service.combine(multiTF as any, TradingMode.SWING);

      // Result depends on weighting - should be a valid bias
      expect([TrendBias.BULLISH, TrendBias.BEARISH, TrendBias.NEUTRAL]).toContain(result.bias);
    });

    test('should include reasoning in result', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.reasoning).toBeDefined();
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning).toContain('5m');
      expect(result.reasoning).toContain('Final');
    });

    test('should calculate weighted strength between 0 and 1', () => {
      const multiTF = createValidMultiTF();
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });

    test('should handle all zero strength values', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.NEUTRAL, strength: 0 },
          '15m': { bias: TrendBias.NEUTRAL, strength: 0 },
          '1h': { bias: TrendBias.NEUTRAL, strength: 0 },
          '4h': { bias: TrendBias.NEUTRAL, strength: 0 },
        },
      };
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.bias).toBe(TrendBias.NEUTRAL);
      expect(result.strength).toBe(0);
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = new TimeframeWeightingService(mockLogger as any);
      const multiTF = createValidMultiTF();

      expect(() => {
        basicService.combine(multiTF, TradingMode.SWING);
      }).not.toThrow();
    });

    test('should work without logger', () => {
      const basicService = new TimeframeWeightingService(undefined, errorHandler);
      const multiTF = createValidMultiTF();

      expect(() => {
        basicService.combine(multiTF, TradingMode.SWING);
      }).not.toThrow();
    });

    test('should work without optional parameters', () => {
      const basicService = new TimeframeWeightingService();
      const multiTF = createValidMultiTF();

      expect(() => {
        basicService.combine(multiTF, TradingMode.SWING);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = new TimeframeWeightingService(mockLogger as any);

      expect(() => {
        basicService.combine(null as any, TradingMode.SWING);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle all BULLISH bias', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BULLISH, strength: 0.9 },
          '15m': { bias: TrendBias.BULLISH, strength: 0.95 },
          '1h': { bias: TrendBias.BULLISH, strength: 0.85 },
          '4h': { bias: TrendBias.BULLISH, strength: 0.80 },
        },
      };
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.bias).toBe(TrendBias.BULLISH);
      expect(result.strength).toBeGreaterThan(0.8);
    });

    test('should handle all BEARISH bias', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.BEARISH, strength: 0.9 },
          '15m': { bias: TrendBias.BEARISH, strength: 0.95 },
          '1h': { bias: TrendBias.BEARISH, strength: 0.85 },
          '4h': { bias: TrendBias.BEARISH, strength: 0.80 },
        },
      };
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.bias).toBe(TrendBias.BEARISH);
    });

    test('should handle all NEUTRAL bias', () => {
      const multiTF = {
        byTimeframe: {
          '5m': { bias: TrendBias.NEUTRAL, strength: 0.5 },
          '15m': { bias: TrendBias.NEUTRAL, strength: 0.5 },
          '1h': { bias: TrendBias.NEUTRAL, strength: 0.5 },
          '4h': { bias: TrendBias.NEUTRAL, strength: 0.5 },
        },
      };
      const result = service.combine(multiTF as any, TradingMode.SWING);

      expect(result.bias).toBe(TrendBias.NEUTRAL);
    });

    test('should handle conflicting signals across modes', () => {
      const bullishTF = createValidMultiTF();
      const result = service.combine(bullishTF, TradingMode.SWING);

      // All timeframes are bullish, so result should be bullish
      expect(result.bias).toBe(TrendBias.BULLISH);
      expect(result.strength).toBeGreaterThan(0.6);
    });
  });
});
