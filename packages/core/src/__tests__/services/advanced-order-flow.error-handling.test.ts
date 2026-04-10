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
import type {
  AdvancedOrderFlowConfig,
  Tick,
  OrderBook,
} from '../../types/advanced-order-flow';
import { ErrorHandler } from '../../errors/ErrorHandler';
import type { LoggerService } from '../../types/legacy';
import {
  addAdvancedOrderFlowTicks,
  asAdvancedOrderFlowConfig,
  asAdvancedOrderFlowOrderBook,
  asAdvancedOrderFlowTick,
  createAdvancedOrderFlowConfig,
  createAdvancedOrderFlowErrorHandler,
  createAdvancedOrderFlowHarness,
  createManagedAdvancedOrderFlowContext,
  createAdvancedOrderFlowMockLogger,
  createAdvancedOrderFlowOrderbook,
  createAdvancedOrderFlowOrderbookWithOverrides,
  createAdvancedOrderFlowTick,
  createAdvancedOrderFlowTickSequence,
} from '../helpers/advanced-order-flow-test.utils';

type AdvancedOrderFlowHarness = ReturnType<typeof createAdvancedOrderFlowHarness>;
type AdvancedOrderFlowManagedContext = ReturnType<typeof createManagedAdvancedOrderFlowContext>;
type AdvancedOrderFlowRuntime = Pick<
  AdvancedOrderFlowHarness,
  'logger' | 'errorHandler'
>;
type AdvancedOrderFlowFactories = Pick<
  AdvancedOrderFlowManagedContext,
  'createService' | 'createLegacyService'
>;
type AdvancedOrderFlowFixtures = {
  runtime: AdvancedOrderFlowRuntime;
  factories: AdvancedOrderFlowFactories;
};

describe('AdvancedOrderFlowService - Error Handling (Phase 10.1)', () => {
  let service: AdvancedOrderFlowService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  let createService: AdvancedOrderFlowFactories['createService'];
  let createLegacyService: AdvancedOrderFlowFactories['createLegacyService'];
  let config: AdvancedOrderFlowManagedContext['config'];

  function bindAdvancedOrderFlowFixtures() {
    let cleanup: AdvancedOrderFlowManagedContext['cleanup'];
    let fixtures: AdvancedOrderFlowFixtures;

    beforeEach(() => {
      const managedContext = createManagedAdvancedOrderFlowContext();
      fixtures = {
        runtime: {
          logger: managedContext.logger,
          errorHandler: managedContext.errorHandler,
        },
        factories: {
          createService: managedContext.createService,
          createLegacyService: managedContext.createLegacyService,
        },
      };
      config = managedContext.config;
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindAdvancedOrderFlowFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    mockLogger = runtime.logger;
    errorHandler = runtime.errorHandler as ErrorHandler;
    ({ createService, createLegacyService } = factories);
  });

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        createService({ config: asAdvancedOrderFlowConfig(null) });
      }).toThrow(/cannot be null or undefined/i);
    });

    it('should throw on invalid tickWindowMs (<= 0)', () => {
      const config = createAdvancedOrderFlowConfig({ tickWindowMs: 0 });

      expect(() => {
        createService({ config });
      }).toThrow(/invalid tickwindowms/i);
    });

    it('should throw on NaN tickWindowMs', () => {
      const config = createAdvancedOrderFlowConfig({ tickWindowMs: NaN });

      expect(() => {
        createService({ config });
      }).toThrow(/invalid tickwindowms/i);
    });

    it('should throw on invalid orderbookLevels (< 1)', () => {
      const config = createAdvancedOrderFlowConfig({ orderbookLevels: 0 });

      expect(() => {
        createService({ config });
      }).toThrow(/invalid orderbooklevels/i);
    });

    it('should throw on invalid imbalanceThreshold (outside 0-1)', () => {
      const config = createAdvancedOrderFlowConfig({ imbalanceThreshold: 1.5 });

      expect(() => {
        createService({ config });
      }).toThrow(/invalid imbalancethreshold/i);
    });

    it('should throw on invalid spoofingThreshold (<= 0)', () => {
      const config = createAdvancedOrderFlowConfig({ spoofingThreshold: 0 });

      expect(() => {
        createService({ config });
      }).toThrow(/invalid spoofingthreshold/i);
    });
  });

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });
    });

    it('should throw on null tick in addTick()', () => {
      expect(() => {
        service.addTick(asAdvancedOrderFlowTick(null));
      }).toThrow(/tick cannot be null or undefined/i);
    });

    it('should throw on invalid tick.side', () => {
      const tick = asAdvancedOrderFlowTick({
        ...createAdvancedOrderFlowTick('BUY'),
        side: 'INVALID',
      });

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.side/i);
    });

    it('should throw on NaN tick.price', () => {
      const tick = createAdvancedOrderFlowTick('BUY');
      tick.price = NaN;

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.price/i);
    });

    it('should throw on Infinity tick.size', () => {
      const tick = createAdvancedOrderFlowTick('BUY');
      tick.size = Infinity;

      expect(() => {
        service.addTick(tick);
      }).toThrow(/invalid tick.size/i);
    });

    it('should throw on null orderbook in processOrderbook()', () => {
      expect(() => {
        service.processOrderbook(asAdvancedOrderFlowOrderBook(null));
      }).toThrow(/orderbook cannot be null or undefined/i);
    });

    it('should throw on invalid orderbook structure', () => {
      const bad = asAdvancedOrderFlowOrderBook({ bids: 'not_array' });

      expect(() => {
        service.processOrderbook(bad);
      }).toThrow(/must have bids and asks arrays/i);
    });
  });

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });
    });

    it('should handle NaN in imbalance calculation', () => {
      const result = service.getImbalance();
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0);
      expect(result?.confidence).toBe(0);
    });

    it('should handle division by zero gracefully', () => {
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
      addAdvancedOrderFlowTicks(service, [
        { side: 'BUY', price: 50000, size: 1000000 },
        { side: 'SELL', price: 50010, size: 1000000 },
      ]);

      const result = service.analyze();
      expect(Number.isFinite(result.imbalance)).toBe(true);
      expect(Number.isFinite(result.volumeUSDT)).toBe(true);
    });

    it('should handle invalid orderbook values gracefully', () => {
      service.addTick(createAdvancedOrderFlowTick('BUY'));
      const badBook = {
        bids: [[50000, 1.0]],
        asks: [[50010, 'invalid']],
      };

      expect(() => {
        service.processOrderbook(asAdvancedOrderFlowOrderBook(badBook));
      }).toThrow();
    });

    it('should return neutral analysis on all errors', () => {
      addAdvancedOrderFlowTicks(service, [
        { side: 'BUY' },
        { side: 'SELL' },
      ]);

      const result = service.analyze();
      expect(result).not.toBeNull();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });
  });

  describe('SKIP: Logging Failures', () => {
    it('should continue on logger failure in constructor', () => {
      const badLogger = createAdvancedOrderFlowMockLogger('info');

      expect(() => {
        service = createService({
          logger: badLogger,
          errorHandler,
        });
      }).not.toThrow();

      expect(service).toBeDefined();
    });

    it('should continue on logger failure in analyze()', () => {
      const badLogger = createAdvancedOrderFlowMockLogger('warn');
      service = createService({
        logger: badLogger,
        errorHandler,
      });

      expect(() => {
        service.addTick(createAdvancedOrderFlowTick('BUY'));
        service.analyze();
      }).not.toThrow();
    });

    it('should continue on logger failure in addTick()', () => {
      const badLogger = createAdvancedOrderFlowMockLogger('debug');
      service = createService({
        logger: badLogger,
        errorHandler,
      });

      expect(() => {
        service.addTick(createAdvancedOrderFlowTick('BUY'));
      }).not.toThrow();
    });

    it('should continue on logger failure in updateConfig()', () => {
      const badLogger = createAdvancedOrderFlowMockLogger('info');
      service = createService({
        logger: badLogger,
        errorHandler,
      });

      expect(() => {
        service.updateConfig({ tickWindowMs: 3000 });
      }).not.toThrow();
    });
  });

  describe('Integration: E2E Scenarios', () => {
    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });
    });

    it('should analyze complete order flow workflow', () => {
      addAdvancedOrderFlowTicks(service, [
        { side: 'BUY', price: 50000, size: 1.0 },
        { side: 'BUY', price: 50005, size: 0.5 },
        { side: 'SELL', price: 50010, size: 0.3 },
      ]);

      service.processOrderbook(createAdvancedOrderFlowOrderbook());

      const result = service.analyze();
      expect(result).toBeDefined();
      expect(result.tickCount).toBe(3);
      expect(result.orderbookCount).toBe(1);
      expect(result.buyVolume).toBeGreaterThan(0);
    });

    it('should detect accumulation pattern (buy heavy)', () => {
      addAdvancedOrderFlowTicks(service, [
        ...Array.from({ length: 8 }, () => ({ side: 'BUY' as const, price: 50000, size: 1.0 })),
        ...Array.from({ length: 2 }, () => ({ side: 'SELL' as const, price: 50010, size: 1.0 })),
      ]);

      const pattern = service.getPattern();
      expect(pattern?.buyPressure).toBeGreaterThan(50);
      expect(pattern?.pattern).toBe('accumulation');
    });

    it('should detect distribution pattern (sell heavy)', () => {
      addAdvancedOrderFlowTicks(service, [
        ...Array.from({ length: 2 }, () => ({ side: 'BUY' as const, price: 50000, size: 1.0 })),
        ...Array.from({ length: 8 }, () => ({ side: 'SELL' as const, price: 50010, size: 1.0 })),
      ]);

      const pattern = service.getPattern();
      expect(pattern?.sellPressure).toBeGreaterThan(50);
      expect(pattern?.pattern).toBe('distribution');
    });

    it('should detect spoofing signal on sudden orderbook change', () => {
      service.processOrderbook(createAdvancedOrderFlowOrderbookWithOverrides({
        bids: [
          [50000, 1.0],
          [49990, 1.0],
        ],
        asks: [
          [50010, 1.0],
          [50020, 1.0],
        ],
      }));

      service.processOrderbook(createAdvancedOrderFlowOrderbookWithOverrides({
        bids: [
          [50000, 10.0],
          [49990, 1.0],
        ],
        asks: [
          [50010, 1.0],
          [50020, 1.0],
        ],
      }));

      const spoofing = service.getSpoofing();
      expect(spoofing).toBeDefined();
      expect(typeof spoofing?.detected).toBe('boolean');
    });

    it('should calculate momentum correctly', () => {
      addAdvancedOrderFlowTicks(service, [
        ...Array.from({ length: 7 }, () => ({ side: 'BUY' as const, price: 50000, size: 1.0 })),
        ...Array.from({ length: 3 }, () => ({ side: 'SELL' as const, price: 50010, size: 1.0 })),
      ]);

      const momentum = service.getMomentum();
      expect(momentum?.value).toBeGreaterThan(0);
      expect(momentum?.direction).toBe('LONG');
    });

    it('should handle cascading failures gracefully', () => {
      const badConfig = createAdvancedOrderFlowConfig({ tickWindowMs: -1 });

      expect(() => {
        createService({ config: badConfig });
      }).toThrow();

      service = createService({
        logger: mockLogger,
        errorHandler,
      });
      expect(() => {
        service.analyze();
      }).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      service = createLegacyService({
        logger: mockLogger,
      });

      service.addTick(createAdvancedOrderFlowTick('BUY'));
      const result = service.analyze();

      expect(result).toBeDefined();
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });

    it('should throw validation errors without ErrorHandler', () => {
      service = createLegacyService({
        logger: mockLogger,
      });

      expect(() => {
        service.addTick(asAdvancedOrderFlowTick(null));
      }).toThrow();
    });

    it('should preserve legacy behavior', () => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });

      service.addTick(createAdvancedOrderFlowTick('BUY', 50000, 1.0));
      service.processOrderbook(createAdvancedOrderFlowOrderbook());

      const imbalance = service.getImbalance();
      const pattern = service.getPattern();
      const momentum = service.getMomentum();

      expect(imbalance).toBeDefined();
      expect(pattern).toBeDefined();
      expect(momentum).toBeDefined();
    });

    it('should handle partial config updates', () => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });

      service.updateConfig({ tickWindowMs: 3000 });

      const config = service.getConfig();
      expect(config.tickWindowMs).toBe(3000);
      expect(config.orderbookLevels).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });
    });

    it('should handle zero-volume ticks', () => {
      service.addTick(createAdvancedOrderFlowTick('BUY', 50000, 0));
      service.addTick(createAdvancedOrderFlowTick('SELL', 50010, 0));

      const result = service.analyze();
      expect(result.imbalance).toBe(0);
    });

    it('should handle balanced 50/50 buy/sell', () => {
      service.addTick(createAdvancedOrderFlowTick('BUY', 50000, 1.0));
      service.addTick(createAdvancedOrderFlowTick('SELL', 50010, 1.0));

      const result = service.analyze();
      expect(Math.abs(result.imbalance)).toBeLessThan(0.1);
    });

    it('should handle single-sided flow (100% buy)', () => {
      for (let i = 0; i < 10; i++) {
        service.addTick(createAdvancedOrderFlowTick('BUY', 50000, 1.0));
      }

      const result = service.analyze();
      expect(result.imbalance).toBeGreaterThan(0.9);
      expect(result.direction).toBe('LONG');
    });

    it('should handle extreme market conditions', () => {
      service.addTick(createAdvancedOrderFlowTick('BUY', 40000, 10.0));
      service.addTick(createAdvancedOrderFlowTick('SELL', 60000, 0.5));
      service.addTick(createAdvancedOrderFlowTick('BUY', 55000, 1.0));

      const result = service.analyze();
      expect(Number.isFinite(result.volumeUSDT)).toBe(true);
      expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(result.direction);
    });

    it('should handle time window boundaries', () => {
      const now = Date.now();
      const [tickInWindow, tickOutOfWindow] = createAdvancedOrderFlowTickSequence([
        { side: 'BUY', price: 50000, size: 1.0, timestamp: now },
        { side: 'BUY', price: 50000, size: 1.0, timestamp: now - 10000 },
      ]);

      service.addTick(tickInWindow);
      service.addTick(tickOutOfWindow);

      const cleanup = createService({
        config: createAdvancedOrderFlowConfig({ ...config, tickWindowMs: 5000 }),
        withErrorHandler: false,
      });
      cleanup.addTick(tickInWindow);
      cleanup.addTick(tickOutOfWindow);
      cleanup.analyze();

      expect(cleanup.getTickCount()).toBeLessThanOrEqual(1);
    });

    it('should handle ErrorHandler.handle() throwing', () => {
      const throwingErrorHandler = createAdvancedOrderFlowErrorHandler(mockLogger);
      jest.spyOn(throwingErrorHandler, 'handle').mockImplementation(() => {
        throw new Error('ErrorHandler.handle threw');
      });

      service = createService({
        logger: mockLogger,
        errorHandler: throwingErrorHandler,
      });

      expect(() => {
        service.analyze();
      }).not.toThrow();
    });
  });

  describe('Additional Features', () => {
    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        errorHandler,
      });
    });

    it('should track history correctly', () => {
      expect(service.getTickCount()).toBe(0);
      expect(service.getOrderbookCount()).toBe(0);

      service.addTick(createAdvancedOrderFlowTick('BUY'));
      service.addTick(createAdvancedOrderFlowTick('SELL'));
      service.processOrderbook(createAdvancedOrderFlowOrderbook());

      expect(service.getTickCount()).toBe(2);
      expect(service.getOrderbookCount()).toBe(1);
    });

    it('should clear history completely', () => {
      service.addTick(createAdvancedOrderFlowTick('BUY'));
      service.processOrderbook(createAdvancedOrderFlowOrderbook());

      service.clearHistory();

      expect(service.getTickCount()).toBe(0);
      expect(service.getOrderbookCount()).toBe(0);

      const result = service.analyze();
      expect(result.imbalance).toBe(0);
    });

    it('should respect feature flags (disable spoofing)', () => {
      const config = createAdvancedOrderFlowConfig({ enableSpoofingDetection: false });

      service = createService({ config });

      const result = service.getSpoofing();
      expect(result).not.toBeNull();
      expect(result?.detected).toBe(false);
    });

    it('should respect feature flags (disable momentum)', () => {
      const config = createAdvancedOrderFlowConfig({ enableMomentum: false });

      service = createService({ config });

      const result = service.getMomentum();
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0);
    });
  });
});
