/**
 * Flat Market Detector Tests
 *
 * Comprehensive unit tests for multi-factor flat market detection system.
 */

import { FlatMarketDetector } from '../../analyzers/flat-market.detector';
import {
  Candle,
  TradingContext,
  FlatMarketConfig,
  LoggerService,
  LogLevel,
  TrendBias,
  MarketStructure,
} from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

function createTestConfig(): FlatMarketConfig {
  return {
    enabled: true,
    flatThreshold: 80,
    emaThreshold: 0.3,
    atrThreshold: 1.5,
    rangeThreshold: 1.0,
    slopeThreshold: 5.0,
  };
}

function createTestCandles(count: number, basePrice: number, rangePercent: number): Candle[] {
  const candles: Candle[] = [];
  const range = basePrice * (rangePercent / 100);

  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * range;
    const close = basePrice + variation;
    const open = close + (Math.random() - 0.5) * (range * 0.2);
    const high = Math.max(open, close) + Math.random() * (range * 0.1);
    const low = Math.min(open, close) - Math.random() * (range * 0.1);

    candles.push({
      timestamp: Date.now() + i * 60000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
    });
  }

  return candles;
}

function createTestContext(atrPercent: number, marketStructure: MarketStructure | null): TradingContext {
  return {
    timestamp: Date.now(),
    trend: 'NEUTRAL' as TrendBias,
    marketStructure,
    atrPercent,
    emaDistance: 0.2,
    ema50: 100,
    atrModifier: 1.0,
    emaModifier: 1.0,
    trendModifier: 1.0,
    overallModifier: 1.0,
    isValidContext: true,
    blockedBy: [],
    warnings: [],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('FlatMarketDetector', () => {
  let detector: FlatMarketDetector;
  let logger: LoggerService;
  let config: FlatMarketConfig;

  beforeEach(() => {
    logger = createTestLogger();
    config = createTestConfig();
    detector = new FlatMarketDetector(config, logger);
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle insufficient candles', () => {
      const candles = createTestCandles(5, 100, 0.5); // Only 5 candles, need 20
      const context = createTestContext(1.0, null);

      const result = detector.detect(candles, context, 100, 100.1);

      expect(result.isFlat).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.explanation).toContain('Insufficient data');
    });

    it('should detect confident FLAT market (score 85%)', () => {
      const candles = createTestCandles(30, 100, 0.5); // Tight range
      const context = createTestContext(1.0, MarketStructure.EQUAL_HIGH);

      const result = detector.detect(candles, context, 100, 100.05); // Tight EMAs

      expect(result.isFlat).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.factors.emaDistance).toBeGreaterThan(0);
      expect(result.factors.atrVolatility).toBeGreaterThan(0);
    });

    it('should detect confident TREND market (score <50%)', () => {
      const candles = createTestCandles(30, 100, 3.0); // Wide range
      const context = createTestContext(3.0, MarketStructure.HIGHER_HIGH);

      const result = detector.detect(candles, context, 100, 102); // Wide EMAs

      expect(result.isFlat).toBe(false);
      expect(result.confidence).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // FACTOR TESTS
  // ==========================================================================

  describe('Individual Factors', () => {
    it('EMA Distance: should give max score for tight EMAs', () => {
      const candles = createTestCandles(30, 100, 0.5);
      const context = createTestContext(1.0, null);

      const result = detector.detect(candles, context, 100, 100.05); // 0.05% distance

      expect(result.factors.emaDistance).toBe(20); // Max score
    });

    it('ATR Volatility: should give max score for low ATR', () => {
      const candles = createTestCandles(30, 100, 0.5);
      const context = createTestContext(1.0, null); // 1.0% ATR (below 1.5% threshold)

      const result = detector.detect(candles, context, 100, 100.5);

      expect(result.factors.atrVolatility).toBe(20); // Max score
    });

    it('ZigZag Pattern: should give max score for EH/EL patterns', () => {
      const candles = createTestCandles(30, 100, 0.5);
      const context = createTestContext(1.0, MarketStructure.EQUAL_HIGH);

      const result = detector.detect(candles, context, 100, 100.5);

      expect(result.factors.zigzagPattern).toBe(20); // Max score
    });

    it('ZigZag Pattern: should give zero score for strong trend patterns', () => {
      const candles = createTestCandles(30, 100, 0.5);
      const context = createTestContext(1.0, MarketStructure.HIGHER_HIGH);

      const result = detector.detect(candles, context, 100, 100.5);

      expect(result.factors.zigzagPattern).toBe(0); // No flat pattern
    });

    it('Price Range: should give max score for tight range', () => {
      const candles = createTestCandles(30, 100, 0.3); // Very tight range
      const context = createTestContext(1.0, null);

      const result = detector.detect(candles, context, 100, 100.5);

      expect(result.factors.priceRange).toBeGreaterThan(10); // High score
    });

    it('Volume Distribution: should give high score for balanced volume', () => {
      // Create balanced volume candles (50/50 bullish/bearish)
      const candles: Candle[] = [];
      for (let i = 0; i < 30; i++) {
        candles.push({
          timestamp: Date.now() + i * 60000,
          open: 100,
          high: 100.1,
          low: 99.9,
          close: i % 2 === 0 ? 100.05 : 99.95, // Alternate bullish/bearish
          volume: 1000,
        });
      }

      const context = createTestContext(1.0, null);
      const result = detector.detect(candles, context, 100, 100.1);

      expect(result.factors.volumeDistribution).toBeGreaterThan(5); // Good balance
    });
  });

  // ==========================================================================
  // THRESHOLD TESTS
  // ==========================================================================

  describe('Threshold Behavior', () => {
    it('should classify as FLAT when confidence >= 80%', () => {
      const candles = createTestCandles(30, 100, 0.4);
      const context = createTestContext(1.2, MarketStructure.EQUAL_HIGH);

      const result = detector.detect(candles, context, 100, 100.1);

      if (result.confidence >= 80) {
        expect(result.isFlat).toBe(true);
      } else {
        expect(result.isFlat).toBe(false);
      }
    });

    it('should classify as TREND when confidence < 80%', () => {
      const candles = createTestCandles(30, 100, 2.0);
      const context = createTestContext(2.5, MarketStructure.HIGHER_HIGH);

      const result = detector.detect(candles, context, 100, 103);

      expect(result.confidence).toBeLessThan(80);
      expect(result.isFlat).toBe(false);
    });
  });

  // ==========================================================================
  // EXPLANATION TESTS
  // ==========================================================================

  describe('Explanation String', () => {
    it('should build readable explanation', () => {
      const candles = createTestCandles(30, 100, 0.5);
      const context = createTestContext(1.0, null);

      const result = detector.detect(candles, context, 100, 100.1);

      expect(result.explanation).toContain('EMA Distance:');
      expect(result.explanation).toContain('ATR Volatility:');
      expect(result.explanation).toContain('Price Range:');
      expect(result.explanation).toContain('ZigZag Pattern:');
      expect(result.explanation).toContain('EMA Slope:');
      expect(result.explanation).toContain('Volume:');
    });
  });
});
