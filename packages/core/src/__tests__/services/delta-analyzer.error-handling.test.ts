/**
 * Delta Analyzer Service - Error Handling Tests
 * Phase 8.9.62
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { DeltaAnalyzerService } from '../../services/delta-analyzer.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { DeltaConfig, DeltaTick, Signal, SignalDirection } from '../../types/legacy';
import {
  asDeltaAnalyzerLogger,
  createDeltaAnalyzerConfig,
  createManagedDeltaAnalyzerContext,
  createDeltaAnalyzerSignal,
  createDeltaAnalyzerTick,
  type ManagedDeltaAnalyzerErrorHandlingRuntime,
  type DeltaAnalyzerMockLogger,
} from '../helpers/delta-analyzer-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('DeltaAnalyzerService - Error Handling (Phase 8.9.62)', () => {
  let service: DeltaAnalyzerService;
  let errorHandler: ErrorHandler;
  let mockLogger: DeltaAnalyzerMockLogger;
  let createHarness: ManagedDeltaAnalyzerErrorHandlingRuntime['createHarness'];
  let createService: ManagedDeltaAnalyzerErrorHandlingRuntime['createService'];
  let cleanup: ManagedDeltaAnalyzerErrorHandlingRuntime['cleanup'];

  beforeEach(() => {
    ({
      logger: mockLogger,
      errorHandler,
      createHarness,
      createService,
      cleanup,
    } = createManagedDeltaAnalyzerContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // GROUP 1: THROW Config Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        createService({
          config: null as unknown as DeltaConfig,
          logger: asDeltaAnalyzerLogger(mockLogger),
          errorHandler,
        });
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on undefined config', () => {
      expect(() => {
        createService({
          config: undefined as unknown as DeltaConfig,
          logger: asDeltaAnalyzerLogger(mockLogger),
          errorHandler,
        });
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on invalid windowSizeMs (zero)', () => {
      const config = createDeltaAnalyzerConfig({ minDeltaThreshold: 100, windowSizeMs: 0 });

      expect(() => {
        createService({
          config,
          logger: asDeltaAnalyzerLogger(mockLogger),
          errorHandler,
        });
      }).toThrow('windowSizeMs must be > 0');
    });

    it('should throw on invalid minDeltaThreshold (negative)', () => {
      const config = createDeltaAnalyzerConfig({ minDeltaThreshold: -50 });

      expect(() => {
        createService({
          config,
          logger: asDeltaAnalyzerLogger(mockLogger),
          errorHandler,
        });
      }).toThrow('minDeltaThreshold must be >= 0');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Tick Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Tick Validation', () => {
    beforeEach(() => {
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should throw on null tick', () => {
      expect(() => {
        service.addTick(null as unknown as DeltaTick);
      }).toThrow('DeltaTick cannot be null or undefined');
    });

    it('should throw on invalid tick side', () => {
      const tick = createDeltaAnalyzerTick();
      tick.side = 'NEUTRAL' as unknown as DeltaTick['side'];

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick side must be BUY or SELL');
    });

    it('should throw on NaN quantity', () => {
      const tick = createDeltaAnalyzerTick();
      tick.quantity = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick quantity must be >= 0 and finite');
    });

    it('should throw on NaN price', () => {
      const tick = createDeltaAnalyzerTick();
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
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should throw on null signal', () => {
      expect(() => {
        service.confirmSignal(null as unknown as Signal);
      }).toThrow('Signal cannot be null or undefined');
    });

    it('should throw on invalid signal direction', () => {
      const signal = createDeltaAnalyzerSignal();
      signal.direction = 'MIDDLE' as unknown as Signal['direction'];

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
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should throw on Infinity quantity (validation prevents accumulation)', () => {
      const tick = createDeltaAnalyzerTick({ price: 1000, quantity: Infinity });

      // Adding Infinity should throw during validation
      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick quantity must be >= 0 and finite');
    });

    it('should handle extreme volume values', () => {
      const tick = createDeltaAnalyzerTick({ price: 1000, quantity: 1e308 });

      service.addTick(createDeltaAnalyzerTick({ price: 1000, quantity: 10.5 }));
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
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should skip logger errors during initialization', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        createService({
          config: createDeltaAnalyzerConfig({ minDeltaThreshold: 100 }),
          logger: asDeltaAnalyzerLogger(mockLogger),
          errorHandler,
        });
      }).not.toThrow();
    });

    it('should skip logger errors during analysis', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const tick = createDeltaAnalyzerTick({ price: 1000, quantity: 10.5 });
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
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should handle multiple ticks and analyze correctly', () => {
      // Need delta >= 100 to be BULLISH (threshold is 100)
      const buyTick = createDeltaAnalyzerTick({ price: 1000, quantity: 200, side: 'BUY' });
      const sellTick = createDeltaAnalyzerTick({ price: 1000, quantity: 50, side: 'SELL' });

      service.addTick(buyTick);
      service.addTick(sellTick);

      const analysis = service.analyze();

      expect(analysis.buyVolume).toBe(200);
      expect(analysis.sellVolume).toBe(50);
      expect(analysis.delta).toBe(150);
      expect(analysis.trend).toBe('BULLISH');
    });

    it('should confirm and reject signals correctly', () => {
      const buyTick = createDeltaAnalyzerTick({ price: 1000, quantity: 200, side: 'BUY' });

      service.addTick(buyTick);

      const longSignal = createDeltaAnalyzerSignal(SignalDirection.LONG, {
        price: 1000,
        stopLoss: 990,
        takeProfits: [{ level: 1, price: 1010, percent: 1, sizePercent: 50, hit: false }],
        confidence: 0.75,
      });
      const shortSignal = createDeltaAnalyzerSignal(SignalDirection.SHORT, {
        price: 1000,
        stopLoss: 990,
        takeProfits: [{ level: 1, price: 1010, percent: 1, sizePercent: 50, hit: false }],
        confidence: 0.75,
      });

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
        createService({
          config: null as unknown as DeltaConfig,
          logger: asDeltaAnalyzerLogger(mockLogger),
        });
      }).toThrow('DeltaConfig cannot be null or undefined');
    });

    it('should throw on null tick without ErrorHandler', () => {
      service = createService({
        config: createDeltaAnalyzerConfig({ minDeltaThreshold: 100 }),
        logger: asDeltaAnalyzerLogger(mockLogger),
        errorHandler: undefined,
      });

      expect(() => {
        service.addTick(null as unknown as DeltaTick);
      }).toThrow('DeltaTick cannot be null or undefined');
    });
  });

  // ==========================================================================
  // GROUP 8: Edge Cases (3 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      ({ service } = createHarness({
        logger: mockLogger,
        errorHandler,
        configOverrides: { minDeltaThreshold: 100 },
      }));
    });

    it('should handle zero quantity ticks', () => {
      const tick = createDeltaAnalyzerTick({ price: 1000, quantity: 0 });

      expect(() => {
        service.addTick(tick);
      }).not.toThrow();

      const analysis = service.analyze();
      expect(analysis).toBeDefined();
    });

    it('should handle exactly matching buy and sell volumes', () => {
      const buyTick = createDeltaAnalyzerTick({ price: 1000, quantity: 100, side: 'BUY' });
      const sellTick = createDeltaAnalyzerTick({ price: 1000, quantity: 100, side: 'SELL' });

      service.addTick(buyTick);
      service.addTick(sellTick);

      const analysis = service.analyze();

      expect(analysis.delta).toBe(0);
      expect(analysis.trend).toBe('NEUTRAL');
      expect(analysis.deltaPercent).toBe(0);
    });

    it('should reset ticks without error', () => {
      service.addTick(createDeltaAnalyzerTick({ price: 1000, quantity: 10.5 }));

      expect(service.getTickCount()).toBeGreaterThan(0);

      service.reset();

      expect(service.getTickCount()).toBe(0);
      expect(service.analyze().trend).toBe('NEUTRAL');
    });
  });
});
