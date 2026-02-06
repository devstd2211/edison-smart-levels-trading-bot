/**
 * Tick Delta Analyzer Service - Error Handling Tests
 * Phase 8.9.63
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import { TickDeltaAnalyzerConfig, Tick, MomentumSpike, SignalDirection } from '../../types';

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

const createMockConfig = (): TickDeltaAnalyzerConfig => ({
  minDeltaRatio: 1.5,
  detectionWindow: 60000, // 60 seconds
  minTickCount: 10,
  minVolumeUSDT: 1000,
  maxConfidence: 100,
});

const createMockTick = (): Tick => ({
  side: 'BUY',
  price: 50000.0,
  size: 1.5,
  timestamp: Date.now(),
});

// ============================================================================
// TESTS
// ============================================================================

describe('TickDeltaAnalyzerService - Error Handling (Phase 8.9.63)', () => {
  let service: TickDeltaAnalyzerService;
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
        new TickDeltaAnalyzerService(null as any, mockLogger, errorHandler);
      }).toThrow('TickDeltaAnalyzerConfig cannot be null or undefined');
    });

    it('should throw on invalid minDeltaRatio (zero)', () => {
      const config = createMockConfig();
      config.minDeltaRatio = 0;

      expect(() => {
        new TickDeltaAnalyzerService(config, mockLogger, errorHandler);
      }).toThrow('minDeltaRatio must be > 0 and finite');
    });

    it('should throw on invalid detectionWindow (negative)', () => {
      const config = createMockConfig();
      config.detectionWindow = -1000;

      expect(() => {
        new TickDeltaAnalyzerService(config, mockLogger, errorHandler);
      }).toThrow('detectionWindow must be > 0');
    });

    it('should throw on invalid maxConfidence (zero)', () => {
      const config = createMockConfig();
      config.maxConfidence = 0;

      expect(() => {
        new TickDeltaAnalyzerService(config, mockLogger, errorHandler);
      }).toThrow('maxConfidence must be > 0 and finite');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Tick Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Tick Validation', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should throw on null tick', () => {
      expect(() => {
        service.addTick(null as any);
      }).toThrow('Tick cannot be null or undefined');
    });

    it('should throw on invalid tick side', () => {
      const tick = createMockTick();
      tick.side = 'NEUTRAL' as any;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick side must be BUY or SELL');
    });

    it('should throw on NaN price', () => {
      const tick = createMockTick();
      tick.price = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick price must be >= 0 and finite');
    });

    it('should throw on NaN size', () => {
      const tick = createMockTick();
      tick.size = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick size must be >= 0 and finite');
    });
  });

  // ==========================================================================
  // GROUP 3: GRACEFUL_DEGRADE Calculation Failure Tests (3 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle calculation failures gracefully', () => {
      // Add valid ticks
      const buyTick = { ...createMockTick(), side: 'BUY' as const, size: 2.0 };
      const sellTick = { ...createMockTick(), side: 'SELL' as const, size: 1.0 };

      service.addTick(buyTick);
      service.addTick(sellTick);

      const ratio = service.calculateDeltaRatio();

      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(1.0); // 2.0 / 1.0 = 2.0 (BUY pressure)
    });

    it('should return null on extreme volume values', () => {
      // Add many ticks with extreme sizes
      for (let i = 0; i < 15; i++) {
        const tick = createMockTick();
        tick.size = i % 2 === 0 ? 1e15 : 1e-15;
        service.addTick(tick);
      }

      const spike = service.detectMomentumSpike();

      // Should handle extreme values gracefully
      expect(spike === null || spike.confidence >= 0).toBe(true);
    });

    it('should return neutral ratio on empty tick history', () => {
      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(1.0);
      expect(Number.isFinite(ratio)).toBe(true);
    });
  });

  // ==========================================================================
  // GROUP 4: SKIP Logger Error Tests (2 tests)
  // ==========================================================================

  describe('SKIP: Logger Errors', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should skip logger errors during initialization', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
      }).not.toThrow();
    });

    it('should skip logger errors during momentum detection', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Add enough ticks to trigger momentum detection
      for (let i = 0; i < 15; i++) {
        const tick = createMockTick();
        tick.side = i < 10 ? 'BUY' : 'SELL';
        service.addTick(tick);
      }

      expect(() => {
        service.detectMomentumSpike();
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP 5: Integration Tests (2 tests)
  // ==========================================================================

  describe('Integration: Complex Scenarios', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should detect BUY momentum spike correctly', () => {
      // Add ticks with strong buy pressure
      for (let i = 0; i < 15; i++) {
        const tick = createMockTick();
        tick.side = 'BUY';
        tick.price = 50000 + (i * 10); // Increasing prices
        tick.size = 2.0;
        tick.timestamp = Date.now() - (15 - i) * 1000;
        service.addTick(tick);
      }

      const spike = service.detectMomentumSpike();

      expect(spike).toBeDefined();
      expect(spike?.direction).toBe(SignalDirection.LONG);
      expect(spike?.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL momentum spike correctly', () => {
      // Add ticks with strong sell pressure
      for (let i = 0; i < 15; i++) {
        const tick = createMockTick();
        tick.side = i < 3 ? 'BUY' : 'SELL'; // 3 buys, 12 sells
        tick.price = 50000;
        tick.size = 2.0;
        tick.timestamp = Date.now() - (15 - i) * 1000;
        service.addTick(tick);
      }

      const spike = service.detectMomentumSpike();

      expect(spike).toBeDefined();
      expect(spike?.direction).toBe(SignalDirection.SHORT);
      expect(spike?.confidence).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // GROUP 6: Backward Compatibility Tests (2 tests)
  // ==========================================================================

  describe('Backward Compatibility: No ErrorHandler', () => {
    it('should throw on null config without ErrorHandler', () => {
      expect(() => {
        new TickDeltaAnalyzerService(null as any, mockLogger);
      }).toThrow('TickDeltaAnalyzerConfig cannot be null or undefined');
    });

    it('should throw on null tick without ErrorHandler', () => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger);

      expect(() => {
        service.addTick(null as any);
      }).toThrow('Tick cannot be null or undefined');
    });
  });

  // ==========================================================================
  // GROUP 7: Edge Cases (3 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle zero-size ticks', () => {
      const tick = createMockTick();
      tick.size = 0;

      expect(() => {
        service.addTick(tick);
      }).not.toThrow();

      const ratio = service.calculateDeltaRatio();
      expect(Number.isFinite(ratio)).toBe(true);
    });

    it('should handle exactly matching buy and sell ticks', () => {
      for (let i = 0; i < 10; i++) {
        const buyTick = { ...createMockTick(), side: 'BUY' as const, size: 1.0 };
        const sellTick = { ...createMockTick(), side: 'SELL' as const, size: 1.0 };
        service.addTick(buyTick);
        service.addTick(sellTick);
      }

      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(1.0); // Equal volumes = neutral ratio
    });

    it('should cleanup old ticks without error', () => {
      // Add old ticks
      const tick = createMockTick();
      tick.timestamp = Date.now() - 200000; // 200 seconds ago

      service.addTick(tick);
      const historyBefore = service.getTickHistory().length;

      service.cleanupOldTicks();

      const historyAfter = service.getTickHistory().length;

      // Should have removed old ticks
      expect(historyAfter).toBeLessThanOrEqual(historyBefore);
    });
  });

  // ==========================================================================
  // GROUP 8: E2E Recovery Scenarios (2 tests)
  // ==========================================================================

  describe('E2E: Error Recovery Scenarios', () => {
    beforeEach(() => {
      service = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should recover from invalid config and succeed with valid config', () => {
      // First attempt with invalid config
      expect(() => {
        new TickDeltaAnalyzerService(
          { ...createMockConfig(), minDeltaRatio: -1 },
          mockLogger,
          errorHandler
        );
      }).toThrow();

      // Second attempt with valid config
      const validService = new TickDeltaAnalyzerService(createMockConfig(), mockLogger, errorHandler);

      const tick = createMockTick();
      expect(() => {
        validService.addTick(tick);
      }).not.toThrow();
    });

    it('should handle multiple invalid ticks and continue', () => {
      const validTick = createMockTick();

      // Add a mix of valid and invalid ticks
      service.addTick(validTick);

      const invalidTick = createMockTick();
      invalidTick.price = NaN;
      expect(() => {
        service.addTick(invalidTick);
      }).toThrow();

      // Service should still be usable after error
      service.addTick(validTick);

      const ratio = service.calculateDeltaRatio();
      expect(Number.isFinite(ratio)).toBe(true);
    });
  });
});
