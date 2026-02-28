/**
 * Delta Analyzer Service - Error Handling Tests
 * Phase 8.9.62
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { DeltaAnalyzerService } from '../../services/delta-analyzer.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import { DeltaConfig, DeltaTick, Signal, SignalDirection } from '../../types/legacy';

// ============================================================================
// FIXTURES
// ============================================================================

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogs: jest.fn(() => []),
  getLogsByLevel: jest.fn(() => []),
  clear: jest.fn(),
  disableConsoleOutput: jest.fn(),
  enableConsoleOutputMode: jest.fn(),
});

const createMockErrorHandler = () => {
  return new ErrorHandler(createMockLogger() as any);
};

const createMockConfig = (): DeltaConfig => ({
  enabled: true,
  windowSizeMs: 60000, // 60 seconds
  minDeltaThreshold: 100,
});

const createMockTick = (): DeltaTick => ({
  side: 'BUY',
  quantity: 10.5,
  price: 1000.0,
  timestamp: Date.now(),
});

const createMockSignal = (direction: SignalDirection = SignalDirection.LONG): Signal => ({
  timestamp: Date.now(),
  type: 'ENTRY' as any,
  direction,
  price: 1000.0,
  stopLoss: 990,
  takeProfits: [{ level: 1, price: 1010, percent: 1, sizePercent: 50, hit: false }],
  confidence: 0.75,
  reason: 'Test signal',
});

// ============================================================================
// TESTS
// ============================================================================

describe('DeltaAnalyzerService - Error Handling (Phase 8.9.62)', () => {
  let service: DeltaAnalyzerService;
  let errorHandler: ErrorHandler;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = createMockErrorHandler();
  });

  // ==========================================================================
  // GROUP 1: THROW Config Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        new DeltaAnalyzerService(null as any, mockLogger, errorHandler);
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on undefined config', () => {
      expect(() => {
        new DeltaAnalyzerService(undefined as any, mockLogger, errorHandler);
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on invalid windowSizeMs (zero)', () => {
      const config = createMockConfig();
      config.windowSizeMs = 0;

      expect(() => {
        new DeltaAnalyzerService(config, mockLogger, errorHandler);
      }).toThrow('windowSizeMs must be > 0');
    });

    it('should throw on invalid minDeltaThreshold (negative)', () => {
      const config = createMockConfig();
      config.minDeltaThreshold = -50;

      expect(() => {
        new DeltaAnalyzerService(config, mockLogger, errorHandler);
      }).toThrow('minDeltaThreshold must be >= 0');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Tick Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Tick Validation', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should throw on null tick', () => {
      expect(() => {
        service.addTick(null as any);
      }).toThrow('DeltaTick cannot be null or undefined');
    });

    it('should throw on invalid tick side', () => {
      const tick = createMockTick();
      tick.side = 'NEUTRAL' as any;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick side must be BUY or SELL');
    });

    it('should throw on NaN quantity', () => {
      const tick = createMockTick();
      tick.quantity = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick quantity must be >= 0 and finite');
    });

    it('should throw on NaN price', () => {
      const tick = createMockTick();
      tick.price = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick price must be >= 0 and finite');
    });
  });

  // ==========================================================================
  // GROUP 3: THROW Signal Validation Tests (2 tests)
  // ==========================================================================

  describe('THROW: Signal Validation', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should throw on null signal', () => {
      expect(() => {
        service.confirmSignal(null as any);
      }).toThrow('Signal cannot be null or undefined');
    });

    it('should throw on invalid signal direction', () => {
      const signal = createMockSignal();
      signal.direction = 'MIDDLE' as any;

      expect(() => {
        service.confirmSignal(signal);
      }).toThrow('Signal direction must be LONG or SHORT');
    });
  });

  // ==========================================================================
  // GROUP 4: GRACEFUL_DEGRADE Calculation Failure Tests (3 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should throw on Infinity quantity (validation prevents accumulation)', () => {
      const tick = createMockTick();
      tick.quantity = Infinity;

      // Adding Infinity should throw during validation
      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick quantity must be >= 0 and finite');
    });

    it('should handle extreme volume values', () => {
      const tick = createMockTick();
      tick.quantity = 1e308; // Very large number

      service.addTick(createMockTick());
      service.addTick(tick);

      const analysis = service.analyze();

      expect(analysis).toBeDefined();
      expect(Number.isFinite(analysis.strength)).toBe(true);
    });

    it('should return neutral on empty tick window', () => {
      const analysis = service.analyze();

      expect(analysis.trend).toBe('NEUTRAL');
      expect(analysis.delta).toBe(0);
      expect(analysis.strength).toBe(0);
    });
  });

  // ==========================================================================
  // GROUP 5: SKIP Logger Error Tests (2 tests)
  // ==========================================================================

  describe('SKIP: Logger Errors', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should skip logger errors during initialization', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
      }).not.toThrow();
    });

    it('should skip logger errors during analysis', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const tick = createMockTick();
      service.addTick(tick);

      expect(() => {
        service.analyze();
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP 6: Integration Tests (2 tests)
  // ==========================================================================

  describe('Integration: Complex Scenarios', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle multiple ticks and analyze correctly', () => {
      // Need delta >= 100 to be BULLISH (threshold is 100)
      const buyTick = { ...createMockTick(), side: 'BUY' as const, quantity: 200 };
      const sellTick = { ...createMockTick(), side: 'SELL' as const, quantity: 50 };

      service.addTick(buyTick);
      service.addTick(sellTick);

      const analysis = service.analyze();

      expect(analysis.buyVolume).toBe(200);
      expect(analysis.sellVolume).toBe(50);
      expect(analysis.delta).toBe(150);
      expect(analysis.trend).toBe('BULLISH');
    });

    it('should confirm and reject signals correctly', () => {
      const buyTick = { ...createMockTick(), side: 'BUY' as const, quantity: 200 };

      service.addTick(buyTick);

      const longSignal = createMockSignal(SignalDirection.LONG);
      const shortSignal = createMockSignal(SignalDirection.SHORT);

      expect(service.confirmSignal(longSignal)).toBe(true);
      expect(service.confirmSignal(shortSignal)).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 7: Backward Compatibility Tests (2 tests)
  // ==========================================================================

  describe('Backward Compatibility: No ErrorHandler', () => {
    it('should throw on null config without ErrorHandler', () => {
      expect(() => {
        new DeltaAnalyzerService(null as any, mockLogger);
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on null tick without ErrorHandler', () => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger);

      expect(() => {
        service.addTick(null as any);
      }).toThrow('DeltaTick cannot be null or undefined');
    });
  });

  // ==========================================================================
  // GROUP 8: Edge Cases (3 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = new DeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle zero quantity ticks', () => {
      const tick = createMockTick();
      tick.quantity = 0;

      expect(() => {
        service.addTick(tick);
      }).not.toThrow();

      const analysis = service.analyze();
      expect(analysis).toBeDefined();
    });

    it('should handle exactly matching buy and sell volumes', () => {
      const buyTick = { ...createMockTick(), side: 'BUY' as const, quantity: 100 };
      const sellTick = { ...createMockTick(), side: 'SELL' as const, quantity: 100 };

      service.addTick(buyTick);
      service.addTick(sellTick);

      const analysis = service.analyze();

      expect(analysis.delta).toBe(0);
      expect(analysis.trend).toBe('NEUTRAL');
      expect(analysis.deltaPercent).toBe(0);
    });

    it('should reset ticks without error', () => {
      service.addTick(createMockTick());

      expect(service.getTickCount()).toBeGreaterThan(0);

      service.reset();

      expect(service.getTickCount()).toBe(0);
      expect(service.analyze().trend).toBe('NEUTRAL');
    });
  });
});
