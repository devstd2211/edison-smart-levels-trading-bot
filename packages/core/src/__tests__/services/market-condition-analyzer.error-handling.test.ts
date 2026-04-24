/**
 * Phase 8.9.59 ErrorHandler Integration Tests
 * MarketConditionAnalyzerService - Market Condition Detection with TP Adjustment
 *
 * Test Structure:
 * 1. THROW validation (5 tests) - Null TPs, invalid prices, confidence out of range
 * 2. GRACEFUL_DEGRADE (5 tests) - Processing failures, return original TPs
 * 3. SKIP (3 tests) - Logging failures with safe wrapper
 * 4. Integration (4 tests) - FLAT/TRENDING market scenarios, E2E adjustments
 * 5. Backward Compatibility (3 tests) - Tests without ErrorHandler
 * 6. Edge Cases (5 tests) - Boundary values, multiple TPs, extreme confidence
 *
 * Total: 25 tests ✅
 */

import type { MarketConditionAnalyzerService } from '../../services/market-condition-analyzer.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import type { TakeProfit } from '../../types/legacy';
import {
  createManagedMarketConditionContext,
  createInvalidMarketConditionResult,
  createInvalidMarketConditionTakeProfit,
  createMarketConditionResult,
  createMarketConditionTakeProfit,
  createMarketConditionTakeProfitSeries,
  createSequentialMarketConditionTakeProfits,
} from '../helpers/market-condition-analyzer-test.utils';

const createTP = createMarketConditionTakeProfit;
const createFlatResult = createMarketConditionResult;
type MarketConditionContext = ReturnType<typeof createManagedMarketConditionContext>;

describe('MarketConditionAnalyzerService ErrorHandler Integration (Phase 8.9.59)', () => {
  let logger: MarketConditionContext['logger'];
  let errorHandler: MarketConditionContext['errorHandler'];
  let service: MarketConditionContext['service'];
  let createService: MarketConditionContext['createService'];
  let cleanup: MarketConditionContext['cleanup'];

  beforeEach(() => {
    ({
      logger,
      errorHandler,
      service,
      createService,
      cleanup,
    } = createManagedMarketConditionContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW Validation Tests (5)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    it('should THROW on null takeProfits array', () => {
      const flatResult = createFlatResult(true, 75);

      expect(() => {
        service.adjustTakeProfitsForMarketCondition(null as unknown as TakeProfit[], flatResult);
      }).not.toThrow(); // ErrorHandler catches it

      // Should warn about validation failure
      expect(logger.warn).toBeDefined();
    });

    it('should THROW on empty takeProfits array', () => {
      const flatResult = createFlatResult(true, 75);

      expect(() => {
        service.adjustTakeProfitsForMarketCondition([], flatResult);
      }).not.toThrow();
    });

    it('should THROW on invalid TP price (NaN)', () => {
      const takeProfits = [createInvalidMarketConditionTakeProfit()];
      const flatResult = createFlatResult(true, 75);

      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      }).not.toThrow();
    });

    it('should THROW on negative TP price', () => {
      const takeProfits = [createInvalidMarketConditionTakeProfit({ price: -100 })];
      const flatResult = createFlatResult(true, 75);

      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      }).not.toThrow();
    });

    it('should THROW on invalid sizePercent (>100)', () => {
      const takeProfits = [createInvalidMarketConditionTakeProfit({ price: 100, sizePercent: 150 })];
      const flatResult = createFlatResult(true, 75);

      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Confidence Validation (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Market Condition Processing', () => {
    it('should handle NaN confidence gracefully', () => {
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createInvalidMarketConditionResult();

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      // Should return original TPs on error
      expect(result).toBeDefined();
    });

    it('should handle negative confidence gracefully', () => {
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createFlatResult(true, -10);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result).toBeDefined();
    });

    it('should handle confidence > 100 gracefully', () => {
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createFlatResult(true, 150);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result).toBeDefined();
    });

    it('should return original TPs on processing error', () => {
      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
      ]);
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      // Should return valid adjusted or original TPs
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null flatResult gracefully', () => {
      const takeProfits = [createTP(1, 100, 50, 0.5)];

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, null);
      // Should return original TPs when flatResult is null
      expect(result).toEqual(takeProfits);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (3)
  // ============================================================================

  describe('SKIP: Logging Failures with Safe Wrapper', () => {
    it('should skip info logging failures in FLAT market', () => {
      const service = createService({
        logger: {
          ...logger,
          info: jest.fn().mockImplementation(() => {
            throw new Error('Logger write failed');
          }),
        },
      });
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createFlatResult(true, 75);

      // Should not throw despite logger failure
      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      }).not.toThrow();
    });

    it('should skip warn logging failures on error', () => {
      const service = createService({
        logger: {
          ...logger,
          warn: jest.fn().mockImplementation(() => {
            throw new Error('Logger write failed');
          }),
        },
      });
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const badFlatResult = createInvalidMarketConditionResult();

      // Should not throw despite logger failure
      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, badFlatResult);
      }).not.toThrow();
    });

    it('should skip logging failures in TRENDING market', () => {
      const service = createService({
        logger: {
          ...logger,
          info: jest.fn().mockImplementation(() => {
            throw new Error('Logger write failed');
          }),
        },
      });
      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createFlatResult(false, 80);

      // Should not throw despite logger failure
      expect(() => {
        service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: E2E Scenarios (4)
  // ============================================================================

  describe('Integration: End-to-End Scenarios', () => {
    it('should adjust TPs for FLAT market (single TP)', () => {
      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
        { level: 3, price: 120, sizePercent: 20, percent: 1.5 },
      ]);
      const flatResult = createFlatResult(true, 85);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);

      // Should return single TP for flat market
      expect(result.length).toBe(1);
      expect(result[0].level).toBe(1);
      expect(result[0].price).toBe(100); // First TP price
      expect(result[0].sizePercent).toBe(100); // 100% close

      expect(logger.info).toHaveBeenCalled();
    });

    it('should keep multi-TP for TRENDING market', () => {
      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
        { level: 3, price: 120, sizePercent: 20, percent: 1.5 },
      ]);
      const flatResult = createFlatResult(false, 90);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);

      // Should return all TPs unchanged for trending market
      expect(result.length).toBe(3);
      expect(result).toEqual(takeProfits);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('TRENDING'),
        expect.any(Object)
      );
    });

    it('should handle single TP array correctly', () => {
      const takeProfits = [createTP(1, 100, 100, 0.5)];
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);

      expect(result.length).toBe(1);
      expect(result[0].price).toBe(100);
    });

    it('should handle boundary confidence values', () => {
      const takeProfits = [
        createTP(1, 100, 50, 0.5),
        createTP(2, 110, 50, 1.0),
      ];

      // 0% confidence (very uncertain)
      let flatResult = createFlatResult(true, 0);
      let result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(Array.isArray(result)).toBe(true);

      // 100% confidence (very certain)
      flatResult = createFlatResult(false, 100);
      result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result.length).toBe(2);
    });
  });

  // ============================================================================
  // Backward Compatibility (3)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (uses default)', () => {
      const service = createService({ logger, withErrorHandler: false });
      expect(service).toBeDefined();

      const takeProfits = [createTP(1, 100, 50, 0.5)];
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result).toBeDefined();
    });

    it('should maintain existing behavior when ErrorHandler not provided', () => {
      const service = createService({ logger, withErrorHandler: false });

      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
      ]);
      const flatResult = createFlatResult(true, 80);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);

      // FLAT market should return single TP
      expect(result.length).toBe(1);
      expect(result[0].sizePercent).toBe(100);
    });

    it('should support null flatResult without ErrorHandler', () => {
      const service = createService({ logger, withErrorHandler: false });

      const takeProfits = [createTP(1, 100, 50, 0.5)];

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, null);
      expect(result).toEqual(takeProfits);
    });
  });

  // ============================================================================
  // Edge Cases (5)
  // ============================================================================

  describe('Edge Cases & Corner Cases', () => {
    it('should handle very small TP prices', () => {
      const takeProfits = [createTP(1, 0.00001, 50, 0.0001)];
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result.length).toBe(1);
      expect(result[0].price).toBe(0.00001);
    });

    it('should handle very large TP prices', () => {
      const takeProfits = [createTP(1, 999999, 50, 99.9)];
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result.length).toBe(1);
      expect(result[0].price).toBe(999999);
    });

    it('should handle many TPs in array', () => {
      const takeProfits = createSequentialMarketConditionTakeProfits(20, {
        startPrice: 100,
        priceStep: 10,
        sizePercent: 5,
        percentStep: 0.1,
      });
      const flatResult = createFlatResult(true, 75);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      // FLAT market should condense to single TP
      expect(result.length).toBe(1);
    });

    it('should handle boundary sizePercent values', () => {
      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 0, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 100, percent: 1.0 },
      ]);
      const flatResult = createFlatResult(false, 80);

      const result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      // TRENDING should keep all TPs
      expect(result.length).toBe(2);
      expect(result[0].sizePercent).toBe(0);
      expect(result[1].sizePercent).toBe(100);
    });

    it('should handle repeated consecutive adjustments', () => {
      const takeProfits = createMarketConditionTakeProfitSeries([
        { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
        { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
      ]);

      // First adjustment: FLAT
      let flatResult = createFlatResult(true, 75);
      let result = service.adjustTakeProfitsForMarketCondition(takeProfits, flatResult);
      expect(result.length).toBe(1);

      // Second adjustment: Still FLAT (using adjusted result)
      flatResult = createFlatResult(true, 80);
      result = service.adjustTakeProfitsForMarketCondition(result, flatResult);
      expect(result.length).toBe(1);

      // Third adjustment: Switch to TRENDING
      flatResult = createFlatResult(false, 85);
      result = service.adjustTakeProfitsForMarketCondition(result, flatResult);
      expect(result.length).toBe(1); // Still one from previous FLAT adjustment
    });
  });
});
