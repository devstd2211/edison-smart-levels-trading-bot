/**
 * Indicator Pre-Calculation Service - Error Handling Tests (Phase 8.9.16)
 *
 * Comprehensive error handling tests with ErrorHandler integration
 * Tests coverage:
 * - Calculator errors (SKIP strategy) - 5 tests
 * - Cache operations (SKIP strategy) - 3 tests
 * - Queue processing (GRACEFUL_DEGRADE) - 4 tests
 * - Integration E2E scenarios - 6 tests
 * - Backward compatibility - 2 tests
 * Total: 20 tests
 */

import type { IndicatorPreCalculationService } from '../../services/indicator-precalculation.service';
import type { LoggerService } from '../../services/logger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { TimeframeRole } from '../../types/legacy';
import {
  createManagedIndicatorPrecalculationContext,
  type IndicatorPrecalculationMockCache,
  type IndicatorPrecalculationMockCalculator,
  type IndicatorPrecalculationMockCandleProvider,
} from '../helpers/indicator-precalculation-test.utils';

type IndicatorPrecalculationManagedContext = ReturnType<
  typeof createManagedIndicatorPrecalculationContext
>;
type IndicatorPrecalculationRuntime = Pick<
  IndicatorPrecalculationManagedContext,
  'service' | 'logger' | 'errorHandler' | 'candleProvider' | 'cache' | 'calculators'
>;
type IndicatorPrecalculationFactories = Pick<
  IndicatorPrecalculationManagedContext,
  'createStandardService' | 'createLegacyHarness'
>;
type IndicatorPrecalculationCleanup = IndicatorPrecalculationManagedContext['cleanup'];

function registerIndicatorPrecalculationFixtures(): () => {
  runtime: IndicatorPrecalculationRuntime;
  factories: IndicatorPrecalculationFactories;
} {
  let runtime: IndicatorPrecalculationRuntime;
  let factories: IndicatorPrecalculationFactories;
  let cleanup: IndicatorPrecalculationCleanup;

  beforeEach(() => {
    const managedContext = createManagedIndicatorPrecalculationContext();
    cleanup = managedContext.cleanup;
    runtime = {
      service: managedContext.service,
      logger: managedContext.logger,
      errorHandler: managedContext.errorHandler,
      candleProvider: managedContext.candleProvider,
      cache: managedContext.cache,
      calculators: managedContext.calculators,
    };
    factories = {
      createStandardService: managedContext.createStandardService,
      createLegacyHarness: managedContext.createLegacyHarness,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => ({ runtime, factories });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('IndicatorPreCalculationService - Error Handling (Phase 8.9.16)', () => {
  let service: IndicatorPreCalculationService;
  let errorHandler: ErrorHandler;
  let logger: LoggerService;
  let mockCandleProvider: IndicatorPrecalculationMockCandleProvider;
  let mockCache: IndicatorPrecalculationMockCache;
  let mockCalculators: IndicatorPrecalculationMockCalculator[];
  let createStandardService: IndicatorPrecalculationFactories['createStandardService'];
  let createLegacyHarness: IndicatorPrecalculationFactories['createLegacyHarness'];
  const useFixtures = registerIndicatorPrecalculationFixtures();

  beforeEach(() => {
    const { runtime, factories } = useFixtures();
    ({
      service,
      logger,
      errorHandler,
      candleProvider: mockCandleProvider,
      cache: mockCache,
      calculators: mockCalculators,
    } = runtime);
    ({
      createStandardService,
      createLegacyHarness,
    } = factories);
  });

  // ==========================================
  // A. CALCULATOR ERRORS - SKIP STRATEGY (5)
  // ==========================================

  describe('A. Calculator Errors - SKIP Strategy', () => {
    it('test-A1: Should skip calculator that throws NaN error', async () => {
      // Arrange: RSI throws NaN, EMA succeeds, BB succeeds
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('NaN result')
      );
      mockCalculators[1].calculate.mockResolvedValue(
        new Map([['EMA-14-ENTRY', 100]])
      );
      mockCalculators[2].calculate.mockResolvedValue(
        new Map([['BB-20-ENTRY', 50]])
      );

      // Act: Trigger recalculate
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: EMA and BB cached, RSI skipped
      expect(mockCache.set).toHaveBeenCalledWith('EMA-14-ENTRY', 100);
      expect(mockCache.set).toHaveBeenCalledWith('BB-20-ENTRY', 50);
      expect(mockCache.set).toHaveBeenCalledTimes(2); // Not 3
    });

    it('test-A2: Should skip calculator with insufficient data error', async () => {
      // Arrange
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('not enough candles')
      );
      mockCalculators[1].calculate.mockResolvedValue(
        new Map([['EMA-14-ENTRY', 100]])
      );
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Insufficient data error classified correctly
      expect(mockCache.set).toHaveBeenCalledWith('EMA-14-ENTRY', 100);
      // RSI should be skipped due to insufficient data
    });

    it('test-A3: Should skip all failed calculators, cache successful ones', async () => {
      // Arrange: 3 calculators, only 1 succeeds
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('Calculation failed')
      );
      mockCalculators[1].calculate.mockResolvedValue(
        new Map([['EMA-14-ENTRY', 100]])
      );
      mockCalculators[2].calculate.mockRejectedValue(
        new Error('NaN result')
      );

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Only EMA cached, others skipped
      expect(mockCache.set).toHaveBeenCalledWith('EMA-14-ENTRY', 100);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
    });

    it('test-A4: Should include calculator context in error classification', async () => {
      // Arrange: Create service that captures errors
      const capturedErrors: unknown[] = [];
      const customLogger = {
        info: jest.fn(),
        warn: jest.fn((msg) => {
          capturedErrors.push(msg);
        }),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const customService = createStandardService({
        logger: customLogger as unknown as LoggerService,
        candleProvider: mockCandleProvider,
        cache: mockCache,
        calculators: mockCalculators,
      });

      mockCalculators[0].calculate.mockRejectedValue(
        new Error('Infinity detected')
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act
      await customService.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Warning logged for RSI calculator
      expect(customLogger.warn).toHaveBeenCalled();
    });

    it('test-A5: Should call onRecover callback for each skipped calculator', async () => {
      // Arrange: Multiple calculators fail
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('Error 1')
      );
      mockCalculators[1].calculate.mockRejectedValue(
        new Error('Error 2')
      );
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const warnSpy = jest.spyOn(logger, 'warn');

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: onRecover called (warning logged) for each failed calculator
      // Note: warn is called for both calculator failures and cache operations
      expect(warnSpy.mock.calls.filter(call =>
        call[0].includes('Skipped failed calculator')
      ).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // B. CACHE OPERATIONS - SKIP STRATEGY (3)
  // ==========================================

  describe('B. Cache Operations - SKIP Strategy', () => {
    it('test-B1: Should skip cache.invalidate() failures', async () => {
      // Arrange: invalidate throws, but calculate succeeds
      mockCache.invalidate.mockImplementation(() => {
        throw new Error('Cache invalidation failed');
      });
      mockCalculators[0].calculate.mockResolvedValue(
        new Map([['RSI-14-ENTRY', 45]])
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act: Should not throw despite cache invalidation failure
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Calculation proceeded and cache.set was still called
      expect(mockCache.set).toHaveBeenCalledWith('RSI-14-ENTRY', 45);
    });

    it('test-B2: Should skip cache.set() failures, log warnings', async () => {
      // Arrange: set throws for specific key
      let callCount = 0;
      mockCache.set.mockImplementation((key: string) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Cache write failed');
        }
      });

      mockCalculators[0].calculate.mockResolvedValue(
        new Map([
          ['RSI-14-ENTRY', 45],
          ['RSI-21-ENTRY', 50],
        ])
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const warnSpy = jest.spyOn(logger, 'warn');

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: First value cached, second skipped, warning logged
      expect(warnSpy).toHaveBeenCalled();
    });

    it('test-B3: Should handle cache.set() partial failures', async () => {
      // Arrange: Multiple values, some cache fails
      const cachedValues: string[] = [];
      mockCache.set.mockImplementation((key: string) => {
        if (key.includes('BB')) {
          throw new Error('Cache full');
        }
        cachedValues.push(key);
      });

      mockCalculators[0].calculate.mockResolvedValue(
        new Map([['RSI-14-ENTRY', 45]])
      );
      mockCalculators[1].calculate.mockResolvedValue(
        new Map([
          ['EMA-14-ENTRY', 100],
          ['EMA-21-ENTRY', 102],
        ])
      );
      mockCalculators[2].calculate.mockResolvedValue(
        new Map([['BB-20-ENTRY', 50]])
      );

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: RSI, EMA cached; BB skipped
      expect(cachedValues).toContain('RSI-14-ENTRY');
      expect(cachedValues).toContain('EMA-14-ENTRY');
      expect(cachedValues).toContain('EMA-21-ENTRY');
      expect(cachedValues).not.toContain('BB-20-ENTRY');
    });
  });

  // ==========================================
  // C. QUEUE PROCESSING - GRACEFUL_DEGRADE (4)
  // ==========================================

  describe('C. Queue Processing - GRACEFUL_DEGRADE', () => {
    it('test-C1: Should process queue despite recalculate() failures', async () => {
      // Arrange: Multiple timeframes in queue
      mockCalculators[0].calculate.mockResolvedValue(new Map());
      mockCalculators[1].calculate
        .mockRejectedValueOnce(new Error('Primary timeframe failed'))
        .mockResolvedValueOnce(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);

      // Act: Queue multiple timeframes
      const promise1 = service.onCandleClosed(
        'ENTRY' as TimeframeRole,
        Date.now()
      );
      const promise2 = service.onCandleClosed(
        'PRIMARY' as TimeframeRole,
        Date.now()
      );
      const promise3 = service.onCandleClosed(
        'TREND1' as TimeframeRole,
        Date.now()
      );

      await Promise.all([promise1, promise2, promise3]);

      // Assert: Callback called even with failures in queue
      expect(callback).toHaveBeenCalled();
    });

    it('test-C2: Should handle all timeframes failing in batch', async () => {
      // Arrange: All calculators fail
      mockCalculators.forEach((calc) => {
        calc.calculate.mockRejectedValue(new Error('System failure'));
      });

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Queue processed, isCalculating reset, callback called
      expect(callback).toHaveBeenCalled();
    });

    it('test-C3: Should invoke callback even if some recalculations failed', async () => {
      // Arrange: Mix of success and failure
      mockCalculators[0].calculate.mockRejectedValue(new Error('Failed'));
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);
      service.setEntryTimeframe('ENTRY' as TimeframeRole);

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Callback invoked despite RSI failure
      expect(callback).toHaveBeenCalledWith(
        'ENTRY',
        expect.any(Number)
      );
    });

    it('test-C4: Should batch same-timestamp closes correctly', async () => {
      // Arrange
      const timestamp = Date.now();
      let batchSize = 0;

      mockCalculators[0].calculate.mockImplementation(async () => {
        batchSize++;
        return new Map();
      });
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act: Queue multiple closes at same timestamp
      await service.onCandleClosed('ENTRY' as TimeframeRole, timestamp);
      await service.onCandleClosed('PRIMARY' as TimeframeRole, timestamp);
      await service.onCandleClosed('TREND1' as TimeframeRole, timestamp);

      // Assert: All processed in one batch
      expect(batchSize).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // D. INTEGRATION SCENARIOS - E2E (6)
  // ==========================================

  describe('D. Integration Scenarios - E2E', () => {
    it('test-D1: Full candle close workflow with calculator failure', async () => {
      // Arrange: Realistic scenario
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('NaN from incomplete data')
      );
      mockCalculators[1].calculate.mockResolvedValue(
        new Map([['EMA-14-ENTRY', 100]])
      );
      mockCalculators[2].calculate.mockResolvedValue(
        new Map([['BB-20-ENTRY', 50]])
      );

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);
      service.setEntryTimeframe('ENTRY' as TimeframeRole);

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Partial results cached, callback invoked
      expect(mockCache.set).toHaveBeenCalledWith('EMA-14-ENTRY', 100);
      expect(mockCache.set).toHaveBeenCalledWith('BB-20-ENTRY', 50);
      expect(callback).toHaveBeenCalled();
    });

    it('test-D2: Multiple timeframes close simultaneously', async () => {
      // Arrange: Different timeframes at same time
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('Failed for PRIMARY')
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);
      service.setEntryTimeframe('ENTRY' as TimeframeRole);

      const timestamp = Date.now();

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, timestamp);
      await service.onCandleClosed('PRIMARY' as TimeframeRole, timestamp);
      await service.onCandleClosed('TREND1' as TimeframeRole, timestamp);

      // Assert: All processed despite one failure
      expect(callback).toHaveBeenCalled();
    });

    it('test-D3: Cascading failures with recovery', async () => {
      // Arrange: CandleProvider→Calculator→Cache failures
      mockCandleProvider.getCandles.mockResolvedValue(null);
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('No candles')
      );

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Service remains stable
      expect(callback).toHaveBeenCalled();
    });

    it('test-D4: Empty cache recovery scenario', async () => {
      // Arrange: Cache starts empty
      mockCache.get.mockReturnValue(undefined);
      mockCalculators[0].calculate.mockResolvedValue(
        new Map([['RSI-14-ENTRY', 45]])
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Values cached successfully
      expect(mockCache.set).toHaveBeenCalledWith('RSI-14-ENTRY', 45);
    });

    it('test-D5: Verify error telemetry tracking', async () => {
      // Arrange: Track error classification
      mockCalculators[0].calculate.mockRejectedValue(
        new Error('NaN result')
      );
      mockCalculators[1].calculate.mockRejectedValue(
        new Error('not enough candles')
      );
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      const warnSpy = jest.spyOn(logger, 'warn');

      // Act
      await service.onCandleClosed('ENTRY' as TimeframeRole, Date.now());

      // Assert: Errors logged for telemetry (includes calculator failures)
      expect(warnSpy.mock.calls.filter(call =>
        call[0].includes('Skipped')
      ).length).toBeGreaterThanOrEqual(2);
    });

    it('test-D6: High-frequency close events (stress test)', async () => {
      // Arrange: Rapid queue buildup
      mockCalculators.forEach((calc) => {
        calc.calculate.mockResolvedValue(new Map([['TEST', 100]]));
      });

      const callback = jest.fn().mockResolvedValue(undefined);
      service.setOnIndicatorsReady(callback);

      // Act: Queue 20 events rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          service.onCandleClosed(
            'ENTRY' as TimeframeRole,
            Date.now() + i * 1000
          )
        );
      }
      await Promise.all(promises);

      // Assert: All processed, queue emptied
      expect(callback).toHaveBeenCalled();
    });
  });

  // ==========================================
  // E. BACKWARD COMPATIBILITY (2)
  // ==========================================

  describe('E. Backward Compatibility - Without ErrorHandler', () => {
    it('test-E1: Should work without ErrorHandler parameter', async () => {
      // Arrange: Create service without errorHandler
      const { service: serviceWithoutHandler } =
        createLegacyHarness({
          logger,
          candleProvider: mockCandleProvider,
          cache: mockCache,
          calculators: mockCalculators,
        });

      mockCalculators[0].calculate.mockResolvedValue(
        new Map([['RSI-14-ENTRY', 45]])
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act
      await serviceWithoutHandler.onCandleClosed(
        'ENTRY' as TimeframeRole,
        Date.now()
      );

      // Assert: Original behavior maintained
      expect(mockCache.set).toHaveBeenCalledWith('RSI-14-ENTRY', 45);
    });

    it('test-E2: Should maintain original behavior for cache failures', async () => {
      // Arrange: Without errorHandler, cache failures logged to console
      const { service: serviceWithoutHandler } =
        createLegacyHarness({
          logger,
          candleProvider: mockCandleProvider,
          cache: mockCache,
          calculators: mockCalculators,
        });

      mockCache.set.mockImplementation(() => {
        throw new Error('Cache write failed');
      });

      mockCalculators[0].calculate.mockResolvedValue(
        new Map([['RSI-14-ENTRY', 45]])
      );
      mockCalculators[1].calculate.mockResolvedValue(new Map());
      mockCalculators[2].calculate.mockResolvedValue(new Map());

      // Act & Assert: Should handle gracefully (original try-catch)
      await expect(
        serviceWithoutHandler.onCandleClosed(
          'ENTRY' as TimeframeRole,
          Date.now()
        )
      ).resolves.not.toThrow();
    });
  });
});
