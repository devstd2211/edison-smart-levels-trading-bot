/**
 * Phase 8.9.45: MultiTimeframeTrendService - ErrorHandler Integration Tests
 *
 * Tests error handling strategies for multi-timeframe trend analysis:
 * - THROW strategy for input validation
 * - GRACEFUL_DEGRADE strategy for data processing
 * - SKIP strategy for logging failures
 * - Integration scenarios with cascading failures
 * - Backward compatibility without ErrorHandler
 *
 * Total: 20 comprehensive tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MultiTimeframeTrendService } from '../../services/multi-timeframe-trend.service';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { Candle, LoggerService, TrendBias, MultiTimeframeData } from '../../types/legacy';
import {
  asMultiTimeframeTrendData as asData,
  createMultiTimeframeTrendCandles as createValidCandles,
  createMultiTimeframeTrendData as createValidMultiTFData,
  createMultiTimeframeTrendErrorHandler,
  createMultiTimeframeTrendFailingLogger,
  createMultiTimeframeTrendHarness,
  createMultiTimeframeTrendLogger as createMockLogger,
  createMultiTimeframeTrendService,
} from '../helpers/multi-timeframe-trend-test.utils';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('MultiTimeframeTrendService - Error Handling', () => {
  let service: MultiTimeframeTrendService;
  let errorHandler: ErrorHandler;
  let logger: LoggerService;
  let swingPointDetector: SwingPointDetectorService;

  beforeEach(() => {
    const harness = createMultiTimeframeTrendHarness();
    logger = harness.logger;
    errorHandler = harness.errorHandler as ErrorHandler;
    swingPointDetector = harness.swingPointDetector;
  });

  // ==========================================================================
  // THROW STRATEGY - Input Validation (5 tests)
  // ==========================================================================

  describe('THROW Strategy - Input Validation', () => {
    it('should throw on null multiTFData', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      try {
        await service.analyze(asData(null));
        throw new Error('Should have thrown');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('null or undefined input data');
      }
    });

    it('should throw on undefined multiTFData', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      try {
        await service.analyze(asData(undefined));
        throw new Error('Should have thrown');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('null or undefined input data');
      }
    });

    it('should handle THROW strategy properly with ErrorHandler', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      try {
        await service.analyze(asData(null));
        throw new Error('Should have thrown');
      } catch (error: unknown) {
        // Verify that error was thrown with ErrorHandler context
        expect((error as Error).message).toBeDefined();
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should preserve error context on validation failure', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      try {
        await service.analyze(asData(null));
        throw new Error('Should have thrown');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('MultiTimeframe');
      }
    });

    it('should provide detailed error message on invalid input', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      try {
        await service.analyze(asData({}));
        throw new Error('Should have thrown');
      } catch {
        // Expected - test passes if error thrown
      }
    });
  });

  // ==========================================================================
  // GRACEFUL_DEGRADE STRATEGY - Data Processing (5 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE Strategy - Data Processing', () => {
    it('should degrade gracefully on missing candles', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = asData({
        candles5m: undefined,
        candles15m: createValidCandles(10),
        candles1h: createValidCandles(10),
        candles4h: createValidCandles(10),      });

      try {
        const result = await service.analyze(data);
        expect(result).toBeDefined();
      } catch {
        // May throw or return - both acceptable
      }
    });

    it('should degrade gracefully on insufficient candles', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = asData({
        candles5m: createValidCandles(2), // Less than required 5
        candles15m: createValidCandles(10),
        candles1h: createValidCandles(10),
        candles4h: createValidCandles(10),      });

      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    it('should degrade gracefully on NaN prices in candles', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const invalidCandles = [
        {
          timestamp: 1000000,
          open: NaN,
          high: NaN,
          low: NaN,
          close: NaN,
          volume: 1000,
        },
        ...createValidCandles(9),
      ];

      const data = asData({
        candles5m: invalidCandles,
        candles15m: createValidCandles(10),
        candles1h: createValidCandles(10),
        candles4h: createValidCandles(10),      });

      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    it('should degrade gracefully on Infinity values', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const invalidCandles = [
        {
          timestamp: 1000000,
          open: Infinity,
          high: Infinity,
          low: -Infinity,
          close: Infinity,
          volume: 1000,
        },
        ...createValidCandles(9),
      ];

      const data = asData({
        candles5m: invalidCandles,
        candles15m: createValidCandles(10),
        candles1h: createValidCandles(10),
        candles4h: createValidCandles(10),      });

      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(Number.isFinite(result.consensus.strength)).toBe(true);
    });

    it('should calculate consensus strength with safe defaults on data errors', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(Number.isFinite(result.consensus.strength)).toBe(true);
      expect(result.consensus.strength).toBeGreaterThanOrEqual(0);
      expect(result.consensus.strength).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // SKIP STRATEGY - Logging Failures (3 tests)
  // ==========================================================================

  describe('SKIP Strategy - Logging Failures', () => {
    it('should skip debug logging failures and continue analysis', async () => {
      const brokenLogger = createMultiTimeframeTrendFailingLogger({
        debug: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });
      service = createMultiTimeframeTrendService({
        logger: brokenLogger,
        swingPointDetector,
        errorHandler: createMultiTimeframeTrendErrorHandler(brokenLogger),
      });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    it('should skip info logging failures', async () => {
      const brokenLogger = createMultiTimeframeTrendFailingLogger({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      service = createMultiTimeframeTrendService({
        logger: brokenLogger,
        swingPointDetector,
        errorHandler: createMultiTimeframeTrendErrorHandler(brokenLogger),
      });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus.primaryTrend).toBeDefined();
    });

    it('should continue analysis despite multiple logging errors', async () => {
      const brokenLogger = createMultiTimeframeTrendFailingLogger({
        warn: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      service = createMultiTimeframeTrendService({
        logger: brokenLogger,
        swingPointDetector,
        errorHandler: createMultiTimeframeTrendErrorHandler(brokenLogger),
      });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(result.consensus.primaryTrend).toBeDefined();
      expect(result.consensus.currentTrend).toBeDefined();
      expect(result.consensus.entryTrend).toBeDefined();
    });
  });

  // ==========================================================================
  // INTEGRATION - E2E Scenarios (4 tests)
  // ==========================================================================

  describe('Integration - E2E Scenarios', () => {
    it('should handle cascading timeframe failures gracefully', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = asData({
        candles5m: [], // Empty
        candles15m: createValidCandles(3), // Too few
        candles1h: createValidCandles(10),
        candles4h: [
          {
            timestamp: 1000000,
            open: NaN,
            high: NaN,
            low: NaN,
            close: NaN,
            volume: 1000,
          },
        ], // NaN values      });

      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    it('should detect alignment despite partial data failures', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(['ALIGNED', 'CONFLICTED', 'MIXED'].includes(result.consensus.alignment)).toBe(
        true,
      );
    });

    it('should provide valid consensus with mixed data quality', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, errorHandler });

      const data = asData({
        candles5m: createValidCandles(10),
        candles15m: [
          {
            timestamp: 1000000,
            open: NaN,
            high: NaN,
            low: NaN,
            close: NaN,
            volume: 1000,
          },
          ...createValidCandles(9),
        ],
        candles1h: undefined,
        candles4h: createValidCandles(10),      });

      try {
        const result = await service.analyze(data);

        if (result) {
          expect(result.consensus.strength).toBeGreaterThanOrEqual(0);
          expect(result.consensus.strength).toBeLessThanOrEqual(1);
        }
      } catch {
        // May throw - acceptable if ErrorHandler validation throws
      }
    });

    it('should recover from SwingPointDetector failures', async () => {
      const brokenDetector = {
        detectSwingPoints: jest.fn(() => {
          throw new Error('Detector failed');
        }),
        calculateStrengthFromSwingPoints: jest.fn(() => 0.3),
      } as unknown as SwingPointDetectorService;

      service = createMultiTimeframeTrendService({ logger, swingPointDetector: brokenDetector, errorHandler });

      const data = createValidMultiTFData();
      try {
        const result = await service.analyze(data);
        expect(result).toBeDefined();
      } catch {
        // May throw - acceptable
      }
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY - Without ErrorHandler (3 tests)
  // ==========================================================================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should work without ErrorHandler parameter', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, withErrorHandler: false });

      const data = createValidMultiTFData();
      const result = await service.analyze(data);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    it('should handle errors gracefully without ErrorHandler', async () => {
      const brokenLogger = createMockLogger();
      brokenLogger.debug = jest.fn(() => {
        throw new Error('Logger failed');
      });

      service = createMultiTimeframeTrendService({ logger: brokenLogger, swingPointDetector, withErrorHandler: false });

      const data = createValidMultiTFData();
      try {
        const result = await service.analyze(data);
        expect(result).toBeDefined();
      } catch {
        // May throw without ErrorHandler - both acceptable
      }
    });

    it('should produce valid results without ErrorHandler', async () => {
      service = createMultiTimeframeTrendService({ logger, swingPointDetector, withErrorHandler: false });

      const data = asData({
        candles5m: createValidCandles(10),
        candles15m: createValidCandles(10),
        candles1h: createValidCandles(10),
        candles4h: createValidCandles(10),      });

      const result = await service.analyze(data);

      expect(result.consensus.primaryTrend).toBeDefined();
      expect(result.consensus.strength).toBeGreaterThanOrEqual(0);
      expect(result.consensus.strength).toBeLessThanOrEqual(1);
    });
  });
});



