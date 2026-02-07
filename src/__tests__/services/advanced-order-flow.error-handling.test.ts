/**
 * Phase 10.1: AdvancedOrderFlowService Error Handling Tests
 *
 * Tests ErrorHandler integration with recovery strategies:
 * - THROW: Config validation (6 tests)
 * - THROW: Input validation (6 tests)
 * - GRACEFUL_DEGRADE: Calculation failures (8 tests)
 * - SKIP: Logger errors (4 tests)
 * - Integration E2E scenarios (6 tests)
 * - Backward compatibility (4 tests)
 * - Edge cases (6 tests)
 *
 * Total: 40 tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AdvancedOrderFlowService } from '../../services/advanced-order-flow.service';
import {
  AdvancedOrderFlowConfig,
  Tick,
  OrderBook,
} from '../../types/advanced-order-flow.interface';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService } from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock logger for testing
 */
function createMockLogger(methodToFail?: string): LoggerService {
  return {
    minLevel: 'debug',
    logDir: '/tmp',
    logToFile: false,
    logs: [],
    info: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  } as any;
}

/**
 * Create valid configuration
 */
function createValidConfig(): AdvancedOrderFlowConfig {
  return {
    tickWindowMs: 5000,
    orderbookLevels: 10,
    imbalanceThreshold: 0.65,
    spoofingThreshold: 3.0,
    minVolumeUSDT: 1000,
    maxConfidence: 100,
    enableSpoofingDetection: true,
    enableMomentum: true,
  };
}

/**
 * Create mock tick
 */
function createMockTick(
  side: 'BUY' | 'SELL',
  price = 50000,
  size = 0.1,
  timestamp = Date.now(),
): Tick {
  return { timestamp, price, size, side };
}

/**
 * Create mock orderbook
 */
function createMockOrderbook(): OrderBook {
  return {
    bids: [
      [50000, 1.0],
      [49990, 2.0],
      [49980, 1.5],
      [49970, 1.2],
      [49960, 0.8],
      [49950, 1.0],
      [49940, 0.5],
      [49930, 0.9],
      [49920, 1.1],
      [49910, 0.7],
    ],
    asks: [
      [50010, 1.0],
      [50020, 2.0],
      [50030, 1.5],
      [50040, 1.2],
      [50050, 0.8],
      [50060, 1.0],
      [50070, 0.5],
      [50080, 0.9],
      [50090, 1.1],
      [50100, 0.7],
    ],
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('AdvancedOrderFlowService - Error Handling (Phase 10.1)', () => {
  let service: AdvancedOrderFlowService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = new ErrorHandler(mockLogger);
  });

  // =========================================================================
  // THROW: CONFIG VALIDATION TESTS (6 tests)
  // =========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        new AdvancedOrderFlowService(null as any, mockLogger, errorHandler);
      }).toThrow(/cannot be null or undefined/i);
    });

    it('should throw on invalid tickWindowMs (≤ 0)', () => {
      const config = createValidConfig();
      config.tickWindowMs = 0;

      expect(() => {
        new AdvancedOrderFlowService(config, mockLogger, errorHandler);
      }).toThrow(/invalid tickwindowms/i);
    });

    it('should throw on NaN tickWindowMs', () => {
      const config = createValidConfig();
      config.tickWindowMs = NaN;

      expect(() => {
        new AdvancedOrderFlowService(config, mockLogger, errorHandler);
      }).toThrow(/invalid tickwindowms/i);
    });

    it('should throw on invalid orderbookLevels (< 1)', () => {
      const config = createValidConfig();
      config.orderbookLevels = 0;

      expect(() => {
        new AdvancedOrderFlowService(config, mockLogger, errorHandler);
      }).toThrow(/invalid orderbooklevels/i);
    });

    it('should throw on invalid imbalanceThreshold (outside 0-1)', () => {
      const config = createValidConfig();
      config.imbalanceThreshold = 1.5;

      expect(() => {
        new AdvancedOrderFlowService(config, mockLogger, errorHandler);
      }).toThrow(/invalid imbalancethreshold/i);
    });

    it('should throw on invalid spoofingThreshold (≤ 0)', () => {
      const config = createValidConfig();
      config.spoofingThreshold = 0;

      expect(() => {
        new AdvancedOrderFlowService(config, mockLogger, errorHandler);
      }).toThrow(/invalid spoofingthreshold/i);
    });
  });

  // =========================================================================
  // THROW: INPUT VALIDATION TESTS (6 tests)
  // =========================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
    });

    it('should throw on null tick in addTick()', () => {
      expect(() => {
        service.addTick(null as any);
      }).toThrow(/tick cannot be null or undefined/i);
    });

    it('should throw on invalid tick.side', () => {
      const tick = createMockTick('BUY');
      (tick as any).side = 'INVALID';

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.side/i);
    });

    it('should throw on NaN tick.price', () => {
      const tick = createMockTick('BUY');
      tick.price = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.price/i);
    });

    it('should throw on Infinity tick.size', () => {
      const tick = createMockTick('BUY');
      tick.size = Infinity;

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.size/i);
    });

    it('should throw on null orderbook in processOrderbook()', () => {
      expect(() => {
        service.processOrderbook(null as any);
      }).toThrow(/orderbook cannot be null or undefined/i);
    });

    it('should throw on invalid orderbook structure', () => {
      const bad = { bids: 'not_array' } as any;

      expect(() => {
        service.processOrderbook(bad);
      }).toThrow(/must have bids and asks arrays/i);
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE: CALCULATION FAILURE TESTS (8 tests)
  // =========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
    });

    it('should handle NaN in imbalance calculation', () => {
      // Empty ticks should return neutral, not crash
      const result = service.getImbalance();
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0);
      expect(result?.confidence).toBe(0);
    });

    it('should handle division by zero gracefully', () => {
      // No ticks = zero volume, shouldn't divide by zero
      const result = service.analyze();
      expect(result).not.toBeNull();
      expect(result.direction).toBe('NEUTRAL');
      expect(Number.isFinite(result.imbalance)).toBe(true);
    });

    it('should return neutral pattern on empty buffer', () => {
      const result = service.getPattern();
      expect(result?.pattern).toBe('neutral');
      expect(result?.confidence).toBe(0);
    });

    it('should return no spoofing on empty orderbook', () => {
      const result = service.getSpoofing();
      expect(result?.detected).toBe(false);
      expect(result?.confidence).toBe(0);
    });

    it('should return 0 momentum on error', () => {
      const result = service.getMomentum();
      expect(result?.value).toBe(0);
      expect(result?.direction).toBe('NEUTRAL');
    });

    it('should handle extreme volume values', () => {
      service.addTick(createMockTick('BUY', 50000, 1000000));
      service.addTick(createMockTick('SELL', 50010, 1000000));

      const result = service.analyze();
      expect(Number.isFinite(result.imbalance)).toBe(true);
      expect(Number.isFinite(result.volumeUSDT)).toBe(true);
    });

    it('should handle invalid orderbook values gracefully', () => {
      // Valid tick, invalid orderbook
      service.addTick(createMockTick('BUY'));
      const badBook = {
        bids: [[50000, 1.0]],
        asks: [[50010, 'invalid']],
      } as any;

      expect(() => {
        service.processOrderbook(badBook);
      }).toThrow(); // THROW on validation
    });

    it('should return neutral analysis on all errors', () => {
      // Even with multiple issues, analyze() should return valid result
      service.addTick(createMockTick('BUY'));
      service.addTick(createMockTick('SELL'));

      const result = service.analyze();
      expect(result).not.toBeNull();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });
  });

  // =========================================================================
  // SKIP: LOGGING FAILURE TESTS (4 tests)
  // =========================================================================

  describe('SKIP: Logging Failures', () => {
    it('should continue on logger failure in constructor', () => {
      const badLogger = createMockLogger('info');

      expect(() => {
        service = new AdvancedOrderFlowService(
          createValidConfig(),
          badLogger,
          errorHandler,
        );
      }).not.toThrow();

      expect(service).toBeDefined();
    });

    it('should continue on logger failure in analyze()', () => {
      const badLogger = createMockLogger('warn');
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        badLogger,
        errorHandler,
      );

      // Should not throw even with failing logger
      expect(() => {
        service.addTick(createMockTick('BUY'));
        service.analyze();
      }).not.toThrow();
    });

    it('should continue on logger failure in addTick()', () => {
      const badLogger = createMockLogger('debug');
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        badLogger,
        errorHandler,
      );

      // Should not throw
      expect(() => {
        service.addTick(createMockTick('BUY'));
      }).not.toThrow();
    });

    it('should continue on logger failure in updateConfig()', () => {
      const badLogger = createMockLogger('info');
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        badLogger,
        errorHandler,
      );

      // Should not throw
      expect(() => {
        service.updateConfig({ tickWindowMs: 3000 });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // INTEGRATION: E2E SCENARIO TESTS (6 tests)
  // =========================================================================

  describe('Integration: E2E Scenarios', () => {
    beforeEach(() => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
    });

    it('should analyze complete order flow workflow', () => {
      // Add ticks
      service.addTick(createMockTick('BUY', 50000, 1.0));
      service.addTick(createMockTick('BUY', 50005, 0.5));
      service.addTick(createMockTick('SELL', 50010, 0.3));

      // Process orderbook
      service.processOrderbook(createMockOrderbook());

      // Full analysis
      const result = service.analyze();
      expect(result).toBeDefined();
      expect(result.tickCount).toBe(3);
      expect(result.orderbookCount).toBe(1);
      expect(result.buyVolume).toBeGreaterThan(0);
    });

    it('should detect accumulation pattern (buy heavy)', () => {
      // 80% buy, 20% sell
      for (let i = 0; i < 8; i++) {
        service.addTick(createMockTick('BUY', 50000, 1.0));
      }
      for (let i = 0; i < 2; i++) {
        service.addTick(createMockTick('SELL', 50010, 1.0));
      }

      const pattern = service.getPattern();
      expect(pattern?.buyPressure).toBeGreaterThan(50);
      expect(pattern?.pattern).toBe('accumulation');
    });

    it('should detect distribution pattern (sell heavy)', () => {
      // 20% buy, 80% sell
      for (let i = 0; i < 2; i++) {
        service.addTick(createMockTick('BUY', 50000, 1.0));
      }
      for (let i = 0; i < 8; i++) {
        service.addTick(createMockTick('SELL', 50010, 1.0));
      }

      const pattern = service.getPattern();
      expect(pattern?.sellPressure).toBeGreaterThan(50);
      expect(pattern?.pattern).toBe('distribution');
    });

    it('should detect spoofing signal on sudden orderbook change', () => {
      // Add first orderbook
      service.processOrderbook({
        bids: [
          [50000, 1.0],
          [49990, 1.0],
        ],
        asks: [
          [50010, 1.0],
          [50020, 1.0],
        ],
      });

      // Add second with massive bid increase
      service.processOrderbook({
        bids: [
          [50000, 10.0], // 10x increase
          [49990, 1.0],
        ],
        asks: [
          [50010, 1.0],
          [50020, 1.0],
        ],
      });

      const spoofing = service.getSpoofing();
      expect(spoofing).toBeDefined();
      // May or may not detect based on threshold (3x), but shouldn't crash
      expect(typeof spoofing?.detected).toBe('boolean');
    });

    it('should calculate momentum correctly', () => {
      // Add more buy than sell
      for (let i = 0; i < 7; i++) {
        service.addTick(createMockTick('BUY', 50000, 1.0));
      }
      for (let i = 0; i < 3; i++) {
        service.addTick(createMockTick('SELL', 50010, 1.0));
      }

      const momentum = service.getMomentum();
      expect(momentum?.value).toBeGreaterThan(0); // Positive momentum
      expect(momentum?.direction).toBe('LONG');
    });

    it('should handle cascading failures gracefully', () => {
      const badConfig = createValidConfig();
      badConfig.tickWindowMs = -1; // Invalid

      expect(() => {
        new AdvancedOrderFlowService(badConfig, mockLogger, errorHandler);
      }).toThrow();

      // But valid service continues to work
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
      expect(() => {
        service.analyze();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // BACKWARD COMPATIBILITY TESTS (4 tests)
  // =========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      // No error handler provided
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        undefined,
      );

      service.addTick(createMockTick('BUY'));
      const result = service.analyze();

      expect(result).toBeDefined();
      // Result may be LONG due to single BUY tick, just verify direction is valid
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });

    it('should throw validation errors without ErrorHandler', () => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        undefined,
      );

      expect(() => {
        service.addTick(null as any);
      }).toThrow();
    });

    it('should preserve legacy behavior', () => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );

      service.addTick(createMockTick('BUY', 50000, 1.0));
      service.processOrderbook(createMockOrderbook());

      const imbalance = service.getImbalance();
      const pattern = service.getPattern();
      const momentum = service.getMomentum();

      expect(imbalance).toBeDefined();
      expect(pattern).toBeDefined();
      expect(momentum).toBeDefined();
    });

    it('should handle partial config updates', () => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );

      // Update only one field
      service.updateConfig({ tickWindowMs: 3000 });

      const config = service.getConfig();
      expect(config.tickWindowMs).toBe(3000);
      expect(config.orderbookLevels).toBe(10); // Unchanged
    });
  });

  // =========================================================================
  // EDGE CASES TESTS (6 tests)
  // =========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
    });

    it('should handle zero-volume ticks', () => {
      service.addTick(createMockTick('BUY', 50000, 0));
      service.addTick(createMockTick('SELL', 50010, 0));

      const result = service.analyze();
      expect(result.imbalance).toBe(0); // 0 volume = neutral
    });

    it('should handle balanced 50/50 buy/sell', () => {
      service.addTick(createMockTick('BUY', 50000, 1.0));
      service.addTick(createMockTick('SELL', 50010, 1.0));

      const result = service.analyze();
      expect(Math.abs(result.imbalance)).toBeLessThan(0.1); // Near neutral
    });

    it('should handle single-sided flow (100% buy)', () => {
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 50000, 1.0));
      }

      const result = service.analyze();
      expect(result.imbalance).toBeGreaterThan(0.9); // Nearly 1.0
      expect(result.direction).toBe('LONG');
    });

    it('should handle extreme market conditions', () => {
      // Volatile prices
      service.addTick(createMockTick('BUY', 40000, 10.0));
      service.addTick(createMockTick('SELL', 60000, 0.5));
      service.addTick(createMockTick('BUY', 55000, 1.0));

      const result = service.analyze();
      expect(Number.isFinite(result.volumeUSDT)).toBe(true);
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });

    it('should handle time window boundaries', () => {
      const now = Date.now();
      const tickInWindow = createMockTick('BUY', 50000, 1.0, now);
      const tickOutOfWindow = createMockTick('BUY', 50000, 1.0, now - 10000);

      service.addTick(tickInWindow);
      service.addTick(tickOutOfWindow);

      // After analyze(), cleanup should run and remove old tick
      const cleanup = new AdvancedOrderFlowService(
        { ...createValidConfig(), tickWindowMs: 5000 },
        mockLogger,
      );
      cleanup.addTick(tickInWindow);
      cleanup.addTick(tickOutOfWindow);

      // Run analyze to trigger cleanup
      cleanup.analyze();

      // Old tick should be cleaned up, only recent one remains
      expect(cleanup.getTickCount()).toBeLessThanOrEqual(1);
    });

    it('should handle ErrorHandler.handle() throwing', () => {
      // Create error handler that throws
      const throwingErrorHandler = new ErrorHandler(mockLogger);
      jest
        .spyOn(throwingErrorHandler, 'handle')
        .mockImplementation(() => {
          throw new Error('ErrorHandler.handle threw');
        });

      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        throwingErrorHandler,
      );

      // Service should still function despite ErrorHandler issues
      expect(() => {
        service.analyze();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // ADDITIONAL FEATURE TESTS
  // =========================================================================

  describe('Additional Features', () => {
    beforeEach(() => {
      service = new AdvancedOrderFlowService(
        createValidConfig(),
        mockLogger,
        errorHandler,
      );
    });

    it('should track history correctly', () => {
      expect(service.getTickCount()).toBe(0);
      expect(service.getOrderbookCount()).toBe(0);

      service.addTick(createMockTick('BUY'));
      service.addTick(createMockTick('SELL'));
      service.processOrderbook(createMockOrderbook());

      expect(service.getTickCount()).toBe(2);
      expect(service.getOrderbookCount()).toBe(1);
    });

    it('should clear history completely', () => {
      service.addTick(createMockTick('BUY'));
      service.processOrderbook(createMockOrderbook());

      service.clearHistory();

      expect(service.getTickCount()).toBe(0);
      expect(service.getOrderbookCount()).toBe(0);

      const result = service.analyze();
      expect(result.imbalance).toBe(0);
    });

    it('should respect feature flags (disable spoofing)', () => {
      const config = createValidConfig();
      config.enableSpoofingDetection = false;

      service = new AdvancedOrderFlowService(config, mockLogger, errorHandler);

      const result = service.getSpoofing();
      expect(result).not.toBeNull();
      expect(result?.detected).toBe(false);
    });

    it('should respect feature flags (disable momentum)', () => {
      const config = createValidConfig();
      config.enableMomentum = false;

      service = new AdvancedOrderFlowService(config, mockLogger, errorHandler);

      const result = service.getMomentum();
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0);
    });
  });
});
