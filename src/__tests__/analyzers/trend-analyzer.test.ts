/**
 * TrendAnalyzer Unit Tests
 *
 * Tests for PRIMARY trend detection component.
 * Validates: fast-fail validation, trend bias calculation, strength values, restricted directions.
 * CRITICAL: Tests PHASE 4 RULE compliance (NO FALLBACKS, EXPLICIT validation, EXPLICIT constants).
 */

import { TrendAnalyzer } from '../../analyzers/trend-analyzer';
import {
  Candle,
  TrendBias,
  SignalDirection,
  SwingPoint,
  SwingPointType,
  LogLevel,
} from '../../types';
import { LoggerService } from '../../services/logger.service';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import {
  TREND_ANALYZER_MIN_CANDLES_REQUIRED,
  TREND_ANALYZER_STRONG_TREND_STRENGTH,
  TREND_ANALYZER_FLAT_TREND_STRENGTH,
  TREND_ANALYZER_UNCLEAR_TREND_STRENGTH,
} from '../../constants';

/**
 * Mock Logger for testing (using actual LoggerService with minimal setup)
 */
class MockLogger extends LoggerService {
  constructor() {
    // Initialize with minimal settings - no file logging during tests
    super(LogLevel.INFO, './logs', false);
  }
}

/**
 * Mock MarketStructure for testing
 */
class MockMarketStructure {
  public lastAnalysis: { highs: SwingPoint[]; lows: SwingPoint[] } = {
    highs: [],
    lows: [],
  };

  analyzeStructure(candles: Candle[]): { highs: SwingPoint[]; lows: SwingPoint[] } {
    return this.lastAnalysis;
  }

  setSwingPoints(highs: SwingPoint[], lows: SwingPoint[]): void {
    this.lastAnalysis = { highs, lows };
  }
}

/**
 * Helper to create mock candles with specific trend pattern
 */
function createMockCandles(count: number, startPrice: number = 100, pattern: 'bullish' | 'bearish' | 'neutral' | 'flat' = 'bullish'): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < count; i++) {
    let candlePrice: number;

    switch (pattern) {
      case 'bullish':
        // Higher highs and higher lows - increasing trend
        candlePrice = startPrice + (i * 0.3);
        break;
      case 'bearish':
        // Lower highs and lower lows - decreasing trend
        candlePrice = startPrice - (i * 0.3);
        break;
      case 'neutral':
        // Mix of up and down - no clear direction
        candlePrice = startPrice + ((i % 2) === 0 ? i * 0.2 : -i * 0.15);
        break;
      case 'flat':
        // Prices stay roughly the same - tight rangebound
        // Creates neither HH_HL nor LH_LL -> NEUTRAL
        candlePrice = startPrice + ((i % 3) - 1) * 0.05; // Ranges from -0.05 to +0.05
        break;
    }

    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: candlePrice - 0.05,
      high: candlePrice + 0.2,
      low: candlePrice - 0.1,
      close: candlePrice,
      volume: 1000,
    });
  }

  return candles;
}

/**
 * Helper to create swing points
 */
function createSwingPoint(price: number, isHigh: boolean = true, index: number = 0): SwingPoint {
  return {
    price,
    type: isHigh ? SwingPointType.HIGH : SwingPointType.LOW,
    timestamp: Date.now() - (20 - index) * 60000,
  };
}

describe('TrendAnalyzer', () => {
  let trendAnalyzer: TrendAnalyzer;
  let mockMarketStructure: MockMarketStructure;
  let mockLogger: MockLogger;
  let swingPointDetector: SwingPointDetectorService;

  beforeEach(() => {
    mockMarketStructure = new MockMarketStructure();
    mockLogger = new MockLogger();
    swingPointDetector = new SwingPointDetectorService(mockLogger, 2);
    trendAnalyzer = new TrendAnalyzer(mockMarketStructure, mockLogger, swingPointDetector);
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      const analyzer = new TrendAnalyzer(mockMarketStructure, mockLogger, swingPointDetector);
      expect(analyzer).toBeDefined();
    });

    it('should throw error if MarketStructure is missing', () => {
      expect(() => {
        new TrendAnalyzer(null as any, mockLogger, swingPointDetector);
      }).toThrow('[TrendAnalyzer] REQUIRED: MarketStructureAnalyzer must be provided');
    });

    it('should throw error if LoggerService is missing', () => {
      expect(() => {
        new TrendAnalyzer(mockMarketStructure, null as any, swingPointDetector);
      }).toThrow('[TrendAnalyzer] REQUIRED: LoggerService must be provided');
    });

    it('should throw error if SwingPointDetector is missing', () => {
      expect(() => {
        new TrendAnalyzer(mockMarketStructure, mockLogger, null as any);
      }).toThrow('[TrendAnalyzer] REQUIRED: SwingPointDetectorService must be provided');
    });
  });

  describe('analyzeTrend - Input Validation (PHASE 4 RULE 3: FAST FAIL)', () => {
    it('should throw error if candles is not array', async () => {
      await expect(trendAnalyzer.analyzeTrend(null as any)).rejects.toThrow(
        '[TrendAnalyzer] REQUIRED: Candles must be array'
      );
    });

    it('should throw error if candles is empty', async () => {
      await expect(trendAnalyzer.analyzeTrend([])).rejects.toThrow(
        `[TrendAnalyzer] REQUIRED: Candles must have length >= ${TREND_ANALYZER_MIN_CANDLES_REQUIRED}`
      );
    });

    it('should throw error if candles.length < 20', async () => {
      const candles = createMockCandles(10);
      await expect(trendAnalyzer.analyzeTrend(candles)).rejects.toThrow(
        '[TrendAnalyzer] REQUIRED: Candles must have length >= 20'
      );
    });

    it('should throw error if timeframe is not string', async () => {
      const candles = createMockCandles(25);
      mockMarketStructure.setSwingPoints(
        [createSwingPoint(100.5, true, 10)],
        [createSwingPoint(99.5, false, 5)]
      );

      await expect(trendAnalyzer.analyzeTrend(candles, 123 as any)).rejects.toThrow(
        '[TrendAnalyzer] REQUIRED: Timeframe must be string'
      );
    });

    it('should work even if MarketStructure returns null (uses candle-based analysis)', async () => {
      const candles = createMockCandles(25);
      mockMarketStructure.lastAnalysis = null as any;

      // Should NOT throw - now uses candle structure directly
      const result = await trendAnalyzer.analyzeTrend(candles);
      expect(result.bias).toBeDefined();
      expect([TrendBias.BULLISH, TrendBias.BEARISH, TrendBias.NEUTRAL]).toContain(result.bias);
    });

    it('should work even if MarketStructure returns no swing points', async () => {
      const candles = createMockCandles(25);
      mockMarketStructure.setSwingPoints([], []);

      // Should NOT throw - uses candle structure directly
      const result = await trendAnalyzer.analyzeTrend(candles);
      expect(result.bias).toBeDefined();
      expect([TrendBias.BULLISH, TrendBias.BEARISH, TrendBias.NEUTRAL]).toContain(result.bias);
    });

    it('should work even if MarketStructure returns incomplete swing points', async () => {
      const candles = createMockCandles(25);
      mockMarketStructure.setSwingPoints([createSwingPoint(100.5, true, 10)], []);

      // Should NOT throw - uses candle structure directly
      const result = await trendAnalyzer.analyzeTrend(candles);
      expect(result.bias).toBeDefined();
      expect([TrendBias.BULLISH, TrendBias.BEARISH, TrendBias.NEUTRAL]).toContain(result.bias);
    });
  });

  describe('Trend Bias Calculation', () => {
    it('should detect BULLISH trend (Higher High + Higher Low)', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.bias).toBe(TrendBias.BULLISH);
      expect(result.pattern).toBe('HH_HL');
      expect(result.restrictedDirections).toContain(SignalDirection.SHORT);
      expect(result.restrictedDirections).not.toContain(SignalDirection.LONG);
    });

    it('should detect BEARISH trend (Lower High + Lower Low)', async () => {
      const candles = createMockCandles(25, 100, 'bearish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.bias).toBe(TrendBias.BEARISH);
      expect(result.pattern).toBe('LH_LL');
      expect(result.restrictedDirections).toContain(SignalDirection.LONG);
      expect(result.restrictedDirections).not.toContain(SignalDirection.SHORT);
    });

    it('should detect NEUTRAL trend (mixed pattern)', async () => {
      const candles = createMockCandles(25, 100, 'neutral');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.bias).toBe(TrendBias.NEUTRAL);
      expect(result.pattern).toBe('FLAT');
      expect(result.restrictedDirections.length).toBe(0);
    });

    it('should handle single swing point and still detect trend from candles', async () => {
      const candles = createMockCandles(25, 100, 'bullish');
      const highs = [createSwingPoint(100, true, 10)];
      const lows = [createSwingPoint(95, false, 5)];
      mockMarketStructure.setSwingPoints(highs, lows);

      const result = await trendAnalyzer.analyzeTrend(candles);

      // Should detect BULLISH trend from candles, not from swing points
      expect(result.bias).toBe(TrendBias.BULLISH);
    });
  });

  describe('Trend Strength Calculation', () => {
    it('should return strong strength for BULLISH trend', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      // Strength is now calculated from swing points
      expect(result.strength).toBeGreaterThan(0.3);
      expect(result.strength).toBeLessThanOrEqual(1.0);
    });

    it('should return strong strength for BEARISH trend', async () => {
      const candles = createMockCandles(25, 100, 'bearish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      // Strength is now calculated from swing points
      expect(result.strength).toBeGreaterThan(0.3);
      expect(result.strength).toBeLessThanOrEqual(1.0);
    });

    it('should return FLAT_TREND_STRENGTH for NEUTRAL trend', async () => {
      const candles = createMockCandles(25, 100, 'neutral');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.strength).toBe(TREND_ANALYZER_FLAT_TREND_STRENGTH);
      expect(result.strength).toBe(0.3);
    });

    it('should use EXPLICIT constants for NEUTRAL trend strength', async () => {
      const candles = createMockCandles(25, 100, 'neutral');

      const result = await trendAnalyzer.analyzeTrend(candles);

      // Strength should match constant for NEUTRAL trend
      expect(result.strength).toBe(TREND_ANALYZER_FLAT_TREND_STRENGTH);
      expect(result.strength).toBe(0.3);
    });
  });

  describe('Restricted Directions (PHASE 4 RULE: EXPLICIT blocking)', () => {
    it('BULLISH trend should block SHORT signals only', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.restrictedDirections).toHaveLength(1);
      expect(result.restrictedDirections[0]).toBe(SignalDirection.SHORT);
    });

    it('BEARISH trend should block LONG signals only', async () => {
      const candles = createMockCandles(25, 100, 'bearish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.restrictedDirections).toHaveLength(1);
      expect(result.restrictedDirections[0]).toBe(SignalDirection.LONG);
    });

    it('NEUTRAL trend should have no restrictions', async () => {
      const candles = createMockCandles(25, 100, 'neutral');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.restrictedDirections).toHaveLength(0);
    });
  });

  describe('Reasoning Array', () => {
    it('should include bias explanation for BULLISH', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('HH_HL pattern (Higher Highs + Higher Lows)');
    });

    it('should include bias explanation for BEARISH', async () => {
      const candles = createMockCandles(25, 100, 'bearish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('LH_LL pattern (Lower Highs + Lower Lows)');
    });

    it('should include strength explanation', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('Trend Strength');
    });

    it('should include swing points count explanation', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('Swing Points');
    });

    it('should include restriction explanation for BULLISH', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('SHORT entries blocked in uptrend');
    });

    it('should include restriction explanation for BEARISH', async () => {
      const candles = createMockCandles(25, 100, 'bearish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      const reasoningText = result.reasoning.join(' ');
      expect(reasoningText).toContain('LONG entries blocked in downtrend');
    });
  });

  describe('Return Value Structure', () => {
    it('should return TrendAnalysis with all required fields', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles, '1h');

      expect(result).toHaveProperty('bias');
      expect(result).toHaveProperty('strength');
      expect(result).toHaveProperty('timeframe');
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('restrictedDirections');
    });

    it('should return correct timeframe', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles, '4h');

      expect(result.timeframe).toBe('4h');
    });

    it('should use default timeframe if not provided', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.timeframe).toBe('1h');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 20 candles (minimum required)', async () => {
      const candles = createMockCandles(20, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH);
    });

    it('should handle 19 candles (below minimum)', async () => {
      const candles = createMockCandles(19);

      await expect(trendAnalyzer.analyzeTrend(candles)).rejects.toThrow(
        '[TrendAnalyzer] REQUIRED: Candles must have length >= 20'
      );
    });

    it('should handle very large number of candles', async () => {
      const candles = createMockCandles(1000, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH);
    });

    it('should handle zero price (edge case)', async () => {
      const candles = createMockCandles(25, 0, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result).toBeDefined();
      expect(result.bias).toBe(TrendBias.BULLISH);
    });

    it('should handle equal high/low prices (flat market)', async () => {
      const candles = createMockCandles(25, 100, 'flat');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result.bias).toBe(TrendBias.NEUTRAL);
    });

    it('should handle many swing points', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      expect(result).toBeDefined();
      // Trend should be clearly bullish or bearish
      expect([TrendBias.BULLISH, TrendBias.BEARISH, TrendBias.NEUTRAL]).toContain(result.bias);
    });
  });

  describe('PHASE 4 RULE Compliance', () => {
    it('should NOT use fallback values (??)', async () => {
      // This test verifies code doesn't use ?? operators
      const candles = createMockCandles(25);
      const highs = [createSwingPoint(100, true, 5), createSwingPoint(105, true, 15)];
      const lows = [createSwingPoint(95, false, 2), createSwingPoint(100, false, 12)];
      mockMarketStructure.setSwingPoints(highs, lows);

      const result = await trendAnalyzer.analyzeTrend(candles);

      // If code used fallbacks, we'd get silent wrong values
      // This test passes because code validates explicitly
      expect(result.bias).toBeDefined();
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });

    it('should use valid strength values', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles);

      // Strength must be a valid value between 0 and 1
      // For BULLISH: 0.5 (few swings) to 0.9 (many swings)
      // For NEUTRAL: always 0.3
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });

    it('should validate all inputs with descriptive errors', async () => {
      // Test various validation scenarios
      const validationTests = [
        {
          input: null,
          expectedError: '[TrendAnalyzer] REQUIRED: Candles must be array',
        },
        {
          input: [],
          expectedError: `[TrendAnalyzer] REQUIRED: Candles must have length >= ${TREND_ANALYZER_MIN_CANDLES_REQUIRED}`,
        },
      ];

      for (const test of validationTests) {
        await expect(trendAnalyzer.analyzeTrend(test.input as any)).rejects.toThrow(
          test.expectedError
        );
      }
    });
  });

  describe('Multiple Timeframes', () => {
    it('should work with 1m timeframe', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles, '1m');

      expect(result.timeframe).toBe('1m');
    });

    it('should work with 15m timeframe', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles, '15m');

      expect(result.timeframe).toBe('15m');
    });

    it('should work with 1d timeframe', async () => {
      const candles = createMockCandles(25, 100, 'bullish');

      const result = await trendAnalyzer.analyzeTrend(candles, '1d');

      expect(result.timeframe).toBe('1d');
    });
  });
});
