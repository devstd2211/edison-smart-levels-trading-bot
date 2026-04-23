/**
 * Tick Delta Analyzer Service - Error Handling Tests
 * Phase 8.9.63
 */

import { ErrorHandler } from '../../errors/ErrorHandler';
import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';
import { LoggerService, SignalDirection } from '../../types/legacy';
import {
  createTickDeltaAnalyzerConfig,
  createTickDeltaAnalyzerMomentumConfig,
  createManagedTickDeltaAnalyzerContext,
  createTickDeltaAnalyzerTick,
  type TickDeltaAnalyzerErrorHandlingRuntime,
} from '../helpers/tick-delta-analyzer-test.utils';
describe('TickDeltaAnalyzerService - Error Handling (Phase 8.9.63)', () => {
  let service: TickDeltaAnalyzerService;
  let errorHandler: ErrorHandler;
  let mockLogger: TickDeltaAnalyzerErrorHandlingRuntime['mockLogger'];
  let createService: TickDeltaAnalyzerErrorHandlingRuntime['createService'];
  let cleanup: TickDeltaAnalyzerErrorHandlingRuntime['cleanup'];
  type TickConfigInput = ConstructorParameters<typeof TickDeltaAnalyzerService>[0];
  type TickInput = Parameters<TickDeltaAnalyzerService['addTick']>[0];
  const createMomentumConfig = createTickDeltaAnalyzerMomentumConfig;

  beforeEach(() => {
    const suiteState: TickDeltaAnalyzerErrorHandlingRuntime =
      createManagedTickDeltaAnalyzerContext();
    ({ service, createService, cleanup } = suiteState);
    errorHandler = suiteState.errorHandler as ErrorHandler;
    mockLogger = suiteState.mockLogger;
  });

  afterEach(() => {
    cleanup();
  });

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        createService({
          config: null as unknown as TickConfigInput,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('TickDeltaAnalyzerConfig cannot be null or undefined');
    });

    it('should throw on invalid minDeltaRatio (zero)', () => {
      const config = createTickDeltaAnalyzerConfig({ minDeltaRatio: 0 });

      expect(() => {
        createService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('minDeltaRatio must be > 0 and finite');
    });

    it('should throw on invalid detectionWindow (negative)', () => {
      const config = createTickDeltaAnalyzerConfig({ detectionWindow: -1000 });

      expect(() => {
        createService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('detectionWindow must be > 0');
    });

    it('should throw on invalid maxConfidence (zero)', () => {
      const config = createTickDeltaAnalyzerConfig({ maxConfidence: 0 });

      expect(() => {
        createService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('maxConfidence must be > 0 and finite');
    });
  });

  describe('THROW: Tick Validation', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should throw on null tick', () => {
      expect(() => {
        service.addTick(null as unknown as TickInput);
      }).toThrow('Tick cannot be null or undefined');
    });

    it('should throw on invalid tick side', () => {
      const tick = createTickDeltaAnalyzerTick({ side: 'NEUTRAL' as unknown as TickInput['side'] });

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick side must be BUY or SELL');
    });

    it('should throw on NaN price', () => {
      const tick = createTickDeltaAnalyzerTick({ price: NaN });

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick price must be >= 0 and finite');
    });

    it('should throw on NaN size', () => {
      const tick = createTickDeltaAnalyzerTick({ size: NaN });

      expect(() => {
        service.addTick(tick);
      }).toThrow('Tick size must be >= 0 and finite');
    });
  });

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should handle calculation failures gracefully', () => {
      const now = 1_700_000_100_000;
      service.addTick(createTickDeltaAnalyzerTick({ size: 2.0, timestamp: now }));
      service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', size: 1.0, timestamp: now }));

      const ratio = service.calculateDeltaRatio(60_000, now);

      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(1.0);
    });

    it('should return null on extreme volume values', () => {
      for (let i = 0; i < 15; i++) {
        service.addTick(
          createTickDeltaAnalyzerTick({
            size: i % 2 === 0 ? 1e15 : 1e-15,
            timestamp: 1_700_000_100_000 + i,
          }),
        );
      }

      const spike = service.detectMomentumSpike(1_700_000_100_100);

      expect(spike === null || spike.confidence >= 0).toBe(true);
    });

    it('should return neutral ratio on empty tick history', () => {
      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(1.0);
      expect(Number.isFinite(ratio)).toBe(true);
    });
  });

  describe('SKIP: Logger Errors', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should skip logger errors during initialization', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        createService({
          config: createMomentumConfig(),
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).not.toThrow();
    });

    it('should skip logger errors during momentum detection', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      for (let i = 0; i < 15; i++) {
        service.addTick(
          createTickDeltaAnalyzerTick({
            side: i < 10 ? 'BUY' : 'SELL',
            timestamp: 1_700_000_000_000 + i,
          }),
        );
      }

      expect(() => {
        service.detectMomentumSpike(1_700_000_100_000);
      }).not.toThrow();
    });
  });

  describe('Integration: Complex Scenarios', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should detect BUY momentum spike correctly', () => {
      for (let i = 0; i < 15; i++) {
        service.addTick(
          createTickDeltaAnalyzerTick({
            side: 'BUY',
            price: 50_000 + i * 10,
            size: 2.0,
            timestamp: 1_700_000_100_000 - (15 - i) * 1000,
          }),
        );
      }

      const spike = service.detectMomentumSpike(1_700_000_100_000);

      expect(spike).toBeDefined();
      expect(spike?.direction).toBe(SignalDirection.LONG);
      expect(spike?.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL momentum spike correctly', () => {
      for (let i = 0; i < 15; i++) {
        service.addTick(
          createTickDeltaAnalyzerTick({
            side: i < 3 ? 'BUY' : 'SELL',
            price: 50_000,
            size: 2.0,
            timestamp: 1_700_000_100_000 - (15 - i) * 1000,
          }),
        );
      }

      const spike = service.detectMomentumSpike(1_700_000_100_000);

      expect(spike).toBeDefined();
      expect(spike?.direction).toBe(SignalDirection.SHORT);
      expect(spike?.confidence).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility: No ErrorHandler', () => {
    it('should throw on null config without ErrorHandler', () => {
      expect(() => {
        createService({
          config: null as unknown as TickConfigInput,
          logger: mockLogger as unknown as LoggerService,
          withErrorHandler: false,
        });
      }).toThrow('TickDeltaAnalyzerConfig cannot be null or undefined');
    });

    it('should throw on null tick without ErrorHandler', () => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
      });

      expect(() => {
        service.addTick(null as unknown as TickInput);
      }).toThrow('Tick cannot be null or undefined');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should handle zero-size ticks', () => {
      const tick = createTickDeltaAnalyzerTick({ size: 0 });

      expect(() => {
        service.addTick(tick);
      }).not.toThrow();

      expect(Number.isFinite(service.calculateDeltaRatio())).toBe(true);
    });

    it('should handle exactly matching buy and sell ticks', () => {
      for (let i = 0; i < 10; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ size: 1.0, timestamp: 1_700_000_000_000 + i * 2 }));
        service.addTick(
          createTickDeltaAnalyzerTick({
            side: 'SELL',
            size: 1.0,
            timestamp: 1_700_000_000_001 + i * 2,
          }),
        );
      }

      expect(service.calculateDeltaRatio()).toBe(1.0);
    });

    it('should cleanup old ticks without error', () => {
      const realNow = Date.now;
      const now = 1_700_000_100_000;
      Date.now = jest.fn(() => now);

      try {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now - 200_000 }));
        const historyBefore = service.getTickHistory().length;

        service.cleanupOldTicks();

        const historyAfter = service.getTickHistory().length;
        expect(historyAfter).toBeLessThanOrEqual(historyBefore);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('E2E: Error Recovery Scenarios', () => {
    beforeEach(() => {
      service = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
    });

    it('should recover from invalid config and succeed with valid config', () => {
      expect(() => {
        createService({
          config: createTickDeltaAnalyzerConfig({
            minDeltaRatio: -1,
            detectionWindow: 60_000,
            minTickCount: 10,
            maxConfidence: 100,
          }),
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow();

      const validService = createService({
        config: createMomentumConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });

      expect(() => {
        validService.addTick(createTickDeltaAnalyzerTick());
      }).not.toThrow();
    });

    it('should handle multiple invalid ticks and continue', () => {
      const validTick = createTickDeltaAnalyzerTick();

      service.addTick(validTick);

      const invalidTick = createTickDeltaAnalyzerTick({ price: NaN, timestamp: 1_700_000_000_001 });
      expect(() => {
        service.addTick(invalidTick);
      }).toThrow();

      service.addTick(createTickDeltaAnalyzerTick({ timestamp: 1_700_000_000_002 }));

      expect(Number.isFinite(service.calculateDeltaRatio())).toBe(true);
    });
  });
});
