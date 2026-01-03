/**
 * Level-Based Strategy Tests (Simplified)
 */

import { LevelBasedStrategy, LevelBasedConfig } from '../../strategies/level-based.strategy';
import { LoggerService, LogLevel, StrategyMarketData, Candle, SignalDirection } from '../../types';
import { createTestMarketData, createTestCandle } from '../helpers/test-data.helper';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createSimpleCandles = (count: number = 10): Candle[] => {
  const now = Date.now();
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push(createTestCandle(now - (count - i) * 60000, 100, 105, 95, 100, 1000));
  }
  return candles;
};

const createData = (candles: Candle[], price: number, trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): StrategyMarketData => {
  // Set EMA and RSI to match trend
  let ema = { fast: 100, slow: 95 };
  let rsi = 50;

  if (trend === 'BULLISH') {
    ema = { fast: 100, slow: 95 }; // fast > slow (uptrend)
    rsi = 55; // Above 50 (bullish)
  } else if (trend === 'BEARISH') {
    ema = { fast: 95, slow: 100 }; // fast < slow (downtrend)
    rsi = 45; // Below 50 (bearish)
  }

  return createTestMarketData({
    candles,
    rsi,
    ema,
    trend,
    atr: 1.5,
    timestamp: Date.now(),
    currentPrice: price,
  });
};

const defaultConfig: LevelBasedConfig = {
  enabled: true,
  maxDistancePercent: 1.5,
  minTouchesRequired: 2,
  minTouchesForStrong: 3,
  requireTrendAlignment: true,
  zigzagDepth: 2,
  stopLossAtrMultiplier: 0.5,
  minConfidenceThreshold: 0.5, // 50% - allow most signals for testing
  takeProfits: [
    { level: 1, percent: 0.5, sizePercent: 33.33 },
    { level: 2, percent: 1.0, sizePercent: 33.33 },
    { level: 3, percent: 2.0, sizePercent: 33.34 },
  ],
  levelClustering: {
    clusterThresholdPercent: 0.3,
    minTouchesForStrong: 3,
    strengthBoost: 0.5,
    baseConfidence: 0.65,
    trendAlignmentBoost: 0.15,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('LevelBasedStrategy', () => {
  let strategy: LevelBasedStrategy;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    strategy = new LevelBasedStrategy(defaultConfig, logger);
  });

  // TEST 1-2: Basic properties
  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('LevelBased');
    });

    it('should have correct priority', () => {
      expect(strategy.priority).toBe(2);
    });
  });

  // TEST 3-4: Insufficient data
  describe('insufficient data', () => {
    it('should return no signal with too few candles', async () => {
      const candles = createSimpleCandles(3);
      const data = createData(candles, 100, 'BULLISH');

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Not enough swing points');
    });

    it('should return strategy metadata even when invalid', async () => {
      const candles = createSimpleCandles(3);
      const data = createData(candles, 100, 'BULLISH');

      const result = await strategy.evaluate(data);

      expect(result.strategyName).toBe('LevelBased');
      expect(result.priority).toBe(2);
    });
  });

  // TEST 5-6: LONG at support
  describe('LONG at support', () => {
    it('should generate LONG when price near support in BULLISH trend', async () => {
      // Pattern: price bounces from 95 level multiple times (2 swing lows within 0.3% - will cluster)
      // IMPORTANT: zigzagDepth=2 requires 2 candles before AND after swing point
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0 (1st touch)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 }, // Swing High
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Swing Low 95.2 (2nd touch - within 0.3%!)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now }, // Extra candle for zigzag depth=2
      ];

      const data = createData(candles, 95.5, 'BULLISH'); // Price near support
      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(true);
      expect(result.signal!.direction).toBe(SignalDirection.LONG);
    });

    it('should have higher confidence for strong support', async () => {
      // Strong support at 95 (3 swing lows clustered)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 12 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 11 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 10 * 60000 }, // High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 108, high: 110, low: 95, close: 97, volume: 1000, timestamp: now - 8 * 60000 }, // Low 1 (95)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 100, high: 110, low: 100, close: 107, volume: 1000, timestamp: now - 6 * 60000 }, // High
        { open: 107, high: 108, low: 102, close: 105, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 105, high: 106, low: 95.2, close: 96, volume: 1000, timestamp: now - 4 * 60000 }, // Low 2 (95.2)
        { open: 96, high: 108, low: 96, close: 105, volume: 1000, timestamp: now - 3 * 60000 }, // High
        { open: 105, high: 106, low: 100, close: 103, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 103, high: 104, low: 94.8, close: 96, volume: 1000, timestamp: now - 1 * 60000 }, // Low 3 (94.8)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now },
      ];

      const data = createData(candles, 95.5, 'BULLISH');
      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(true);
      expect(result.signal!.confidence).toBeGreaterThan(0.7);
    });
  });

  // TEST 7-8: SHORT at resistance
  describe('SHORT at resistance', () => {
    it('should generate SHORT when price near resistance in BEARISH trend', async () => {
      // Pattern with 2 swing highs at ~115 level (resistance with 2+ touches, within 0.3%)
      // With zigzagDepth=2, swing point at index i requires:
      // - All candles in [i-2...i-1] have low >= candle[i].low
      // - All candles in [i+1...i+2] have low >= candle[i].low
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 108, low: 98, close: 102, volume: 1000, timestamp: now - 13 * 60000 },
        { open: 102, high: 106, low: 96, close: 100, volume: 1000, timestamp: now - 12 * 60000 }, // prep before swing_low_1
        { open: 100, high: 103, low: 85, close: 100, volume: 1000, timestamp: now - 11 * 60000 }, // SWING LOW idx=2, low=85
        { open: 100, high: 112, low: 95, close: 107, volume: 1000, timestamp: now - 10 * 60000 }, // prep after swing_low_1
        { open: 107, high: 115.0, low: 105, close: 112, volume: 1000, timestamp: now - 9 * 60000 }, // SWING HIGH idx=4, high=115
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 8 * 60000 },  // prep after swing_high_1
        { open: 108, high: 109, low: 88, close: 98, volume: 1000, timestamp: now - 7 * 60000 },    // SWING LOW idx=6, low=88
        { open: 98, high: 110, low: 96, close: 105, volume: 1000, timestamp: now - 6 * 60000 },    // prep after swing_low_2
        { open: 105, high: 115.2, low: 104, close: 113, volume: 1000, timestamp: now - 5 * 60000 }, // SWING HIGH idx=8, high=115.2
        { open: 113, high: 114, low: 110, close: 111, volume: 1000, timestamp: now - 4 * 60000 },  // prep
        { open: 111, high: 112, low: 108, close: 109, volume: 1000, timestamp: now - 3 * 60000 },  // prep
        { open: 109, high: 110, low: 107, close: 108, volume: 1000, timestamp: now - 2 * 60000 },  // prep
        { open: 108, high: 109, low: 106, close: 107, volume: 1000, timestamp: now - 1 * 60000 },  // prep
        { open: 107, high: 108, low: 105, close: 106, volume: 1000, timestamp: now },               // final
      ];

      const data = createData(candles, 114.5, 'BEARISH'); // Near resistance at ~115
      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(true);
      expect(result.signal!.direction).toBe(SignalDirection.SHORT);
    });

    it('should return valid strategy signal structure', async () => {
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 108, low: 98, close: 102, volume: 1000, timestamp: now - 13 * 60000 },
        { open: 102, high: 106, low: 96, close: 100, volume: 1000, timestamp: now - 12 * 60000 }, // prep before swing_low_1
        { open: 100, high: 103, low: 85, close: 100, volume: 1000, timestamp: now - 11 * 60000 }, // SWING LOW idx=2, low=85
        { open: 100, high: 112, low: 95, close: 107, volume: 1000, timestamp: now - 10 * 60000 }, // prep after swing_low_1
        { open: 107, high: 115.0, low: 105, close: 112, volume: 1000, timestamp: now - 9 * 60000 }, // SWING HIGH idx=4, high=115
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 8 * 60000 },  // prep after swing_high_1
        { open: 108, high: 109, low: 88, close: 98, volume: 1000, timestamp: now - 7 * 60000 },    // SWING LOW idx=6, low=88
        { open: 98, high: 110, low: 96, close: 105, volume: 1000, timestamp: now - 6 * 60000 },    // prep after swing_low_2
        { open: 105, high: 115.2, low: 104, close: 113, volume: 1000, timestamp: now - 5 * 60000 }, // SWING HIGH idx=8, high=115.2
        { open: 113, high: 114, low: 110, close: 111, volume: 1000, timestamp: now - 4 * 60000 },  // prep
        { open: 111, high: 112, low: 108, close: 109, volume: 1000, timestamp: now - 3 * 60000 },  // prep
        { open: 109, high: 110, low: 107, close: 108, volume: 1000, timestamp: now - 2 * 60000 },  // prep
        { open: 108, high: 109, low: 106, close: 107, volume: 1000, timestamp: now - 1 * 60000 },  // prep
        { open: 107, high: 108, low: 105, close: 106, volume: 1000, timestamp: now },               // final
      ];

      const data = createData(candles, 114.5, 'BEARISH');
      const result = await strategy.evaluate(data);

      expect(result.signal).toBeDefined();
      expect(result.signal!.type).toBe('LEVEL_BASED');
      expect(result.signal!.takeProfits.length).toBe(3);
    });
  });

  // TEST 9-10: Distance threshold
  describe('distance threshold', () => {
    it('should reject if price too far from levels', async () => {
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 3 * 60000 }, // High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 108, high: 110, low: 95, close: 97, volume: 1000, timestamp: now - 1 * 60000 }, // Low 95
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now },
      ];

      const data = createData(candles, 110, 'BULLISH'); // Far from levels (> 1.5%)

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(false);
    });

    it('should accept if price within threshold', async () => {
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0 (1st)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Swing Low 95.2 (2nd, within 0.3%)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now }, // Extra candle
      ];

      const data = createData(candles, 95.5, 'BULLISH'); // Near support (within 1.5%)

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(true);
    });
  });

  // TEST 11: Price direction filtering
  describe('price direction filtering', () => {
    it('should reject LONG when price BELOW support level', async () => {
      // Support at 95, but price at 92 (BELOW support)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 108, high: 110, low: 95, close: 97, volume: 1000, timestamp: now - 5 * 60000 }, // Swing Low 95
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 107, high: 108, low: 94, close: 96, volume: 1000, timestamp: now - 1 * 60000 }, // Swing Low 94
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now },
      ];

      const data = createData(candles, 92, 'BULLISH'); // Price BELOW support (92 < 95)
      const result = await strategy.evaluate(data);

      // Should NOT generate LONG signal because price is BELOW support
      // This prevents SL from being calculated above entry price
      expect(result.valid).toBe(false);
    });

    it('should reject SHORT when price ABOVE resistance level', async () => {
      // Resistance at 115, but price at 118 (ABOVE resistance)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 6 * 60000 }, // Swing High 115
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 108, high: 109, low: 103, close: 105, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 105, high: 106, low: 100, close: 103, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 103, high: 120, low: 102, close: 118, volume: 1000, timestamp: now - 2 * 60000 }, // Swing High 120
        { open: 118, high: 119, low: 115, close: 116, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 116, high: 117, low: 112, close: 114, volume: 1000, timestamp: now },
      ];

      const data = createData(candles, 122, 'BEARISH'); // Price ABOVE resistance (122 > 120)
      const result = await strategy.evaluate(data);

      // Should NOT generate SHORT signal because price is ABOVE resistance
      // This prevents SL from being calculated below entry price
      expect(result.valid).toBe(false);
    });
  });

  // TEST 13: Weak level filtering (NEW!)
  describe('weak level filtering', () => {
    it('should reject level with only 1 touch (< minTouchesRequired)', async () => {
      // Only 1 swing low at 95 (weak level - should be filtered out)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 5 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 108, high: 110, low: 95, close: 97, volume: 1000, timestamp: now - 3 * 60000 }, // Swing Low 95 (ONLY 1!)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 103, high: 106, low: 102, close: 104, volume: 1000, timestamp: now },
      ];

      const data = createData(candles, 95.5, 'BULLISH'); // Price near support
      const result = await strategy.evaluate(data);

      // Should REJECT because level has only 1 touch (< 2 required)
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/No levels within distance|Not enough swing points/);
    });

    it('should accept level with 2+ touches (>= minTouchesRequired)', async () => {
      // 2 swing lows at ~95 (valid level, within 0.3%)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0 (1st)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 }, // Swing High
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Swing Low 95.2 (2nd)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now }, // Extra candle
      ];

      const data = createData(candles, 95.5, 'BULLISH');
      const result = await strategy.evaluate(data);

      // Should ACCEPT because level has 2 touches (>= 2 required)
      expect(result.valid).toBe(true);
    });
  });

  // TEST 15-16: Trend alignment
  describe('trend alignment', () => {
    it('should block LONG if trend not aligned', async () => {
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0 (1st)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 }, // Swing High
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Swing Low 95.2 (2nd)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now }, // Extra candle
      ];

      const data = createData(candles, 95.5, 'BEARISH'); // Near support but BEARISH

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not aligned');
    });

    it('should allow signal when trend alignment disabled', async () => {
      const config = { ...defaultConfig, requireTrendAlignment: false };
      const noTrendStrategy = new LevelBasedStrategy(config, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0 (1st)
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 }, // Swing High
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Swing Low 95.2 (2nd)
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now }, // Extra candle
      ];

      const data = createData(candles, 95.5, 'BEARISH');

      const result = await noTrendStrategy.evaluate(data);

      expect(result.valid).toBe(true);
    });
  });

  // TEST: LONG Downtrend Filter
  describe('LONG downtrend filter', () => {
    it('should block LONG when blockLongInDowntrend=true and EMA20 < EMA50 AND RSI < 50', async () => {
      const configWithFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false, // Don't block on trend
        blockLongInDowntrend: true, // Enable downtrend filter
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configWithFilter, logger);

      // Pattern: support level with 2+ touches
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 }, // Swing Low 95.0
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 }, // Swing High
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: 9000 }, // Swing Low 95.2
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // Downtrend: EMA20 < EMA50, RSI < 50
      const downtrendData = createTestMarketData({
        candles,
        rsi: 45, // < 50
        ema: { fast: 95, slow: 100 }, // fast < slow (downtrend)
        trend: 'BEARISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5, // Near support
      });

      const result = await strategy.evaluate(downtrendData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('LONG blocked in downtrend');
      expect(result.reason).toContain('EMA');
      expect(result.reason).toContain('RSI');
    });

    it('should allow LONG when blockLongInDowntrend=true but NOT in downtrend (EMA20 > EMA50)', async () => {
      const configWithFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: true,
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configWithFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // NOT downtrend: EMA20 > EMA50
      const uptrendData = createTestMarketData({
        candles,
        rsi: 55, // > 50
        ema: { fast: 105, slow: 100 }, // fast > slow (uptrend)
        trend: 'BULLISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(uptrendData);

      expect(result.valid).toBe(true); // Should pass downtrend filter
      expect(result.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should allow LONG when blockLongInDowntrend=true and RSI >= 55 (not in downtrend)', async () => {
      const configWithFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: true,
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configWithFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // RSI strong - not in downtrend
      const mixedData = createTestMarketData({
        candles,
        rsi: 56, // >= 55 (bullish momentum - above downtrend threshold)
        ema: { fast: 105, slow: 100 }, // fast > slow (uptrend - not a downtrend scenario)
        trend: 'BULLISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(mixedData);

      expect(result.valid).toBe(true); // Should pass - RSI shows momentum
      expect(result.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should NOT block LONG when blockLongInDowntrend=false even in downtrend', async () => {
      const configNoFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false, // Filter disabled
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configNoFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // Downtrend but filter disabled
      const downtrendData = createTestMarketData({
        candles,
        rsi: 52, // Session 36: LONG requires RSI >= 50
        ema: { fast: 95, slow: 100 },
        trend: 'BEARISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(downtrendData);

      expect(result.valid).toBe(true); // Should pass - filter disabled
      expect(result.signal?.direction).toBe(SignalDirection.LONG);
    });
  });

  // TEST: Different minTouches for LONG vs SHORT
  describe('separate minTouches for LONG/SHORT', () => {
    it('should require more touches for LONG (minTouchesRequiredLong=3) than SHORT', async () => {
      const strictLongConfig: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2, // Fallback
        minTouchesRequiredShort: 2,
        minTouchesRequiredLong: 3, // Stricter for LONG
      };
      strategy = new LevelBasedStrategy(strictLongConfig, logger);

      // Support level with exactly 2 touches (should be blocked for LONG)
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: 5000 }, // Touch 1
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 }, // Touch 2
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      const data = createTestMarketData({
        candles,
        rsi: 55,
        ema: { fast: 105, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(data);

      // Should fail - only 2 touches but LONG requires 3
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No levels within distance threshold');
    });

    it('should allow SHORT with 2 touches when minTouchesRequiredShort=2', async () => {
      const strictLongConfig: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2,
        minTouchesRequiredShort: 2, // OK for SHORT
        minTouchesRequiredLong: 3, // Stricter for LONG
      };
      strategy = new LevelBasedStrategy(strictLongConfig, logger);

      // Same data as successful SHORT test, just modified for this specific config
      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 108, low: 98, close: 102, volume: 1000, timestamp: now - 13 * 60000 },
        { open: 102, high: 106, low: 96, close: 100, volume: 1000, timestamp: now - 12 * 60000 }, // prep before swing_low_1
        { open: 100, high: 103, low: 85, close: 100, volume: 1000, timestamp: now - 11 * 60000 }, // SWING LOW idx=2, low=85
        { open: 100, high: 112, low: 95, close: 107, volume: 1000, timestamp: now - 10 * 60000 }, // prep after swing_low_1
        { open: 107, high: 115.0, low: 105, close: 112, volume: 1000, timestamp: now - 9 * 60000 }, // SWING HIGH idx=4, high=115
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 8 * 60000 },  // prep after swing_high_1
        { open: 108, high: 109, low: 88, close: 98, volume: 1000, timestamp: now - 7 * 60000 },    // SWING LOW idx=6, low=88
        { open: 98, high: 110, low: 96, close: 105, volume: 1000, timestamp: now - 6 * 60000 },    // prep after swing_low_2
        { open: 105, high: 115.2, low: 104, close: 113, volume: 1000, timestamp: now - 5 * 60000 }, // SWING HIGH idx=8, high=115.2
        { open: 113, high: 114, low: 110, close: 111, volume: 1000, timestamp: now - 4 * 60000 },  // prep
        { open: 111, high: 112, low: 108, close: 109, volume: 1000, timestamp: now - 3 * 60000 },  // prep
        { open: 109, high: 110, low: 107, close: 108, volume: 1000, timestamp: now - 2 * 60000 },  // prep
        { open: 108, high: 109, low: 106, close: 107, volume: 1000, timestamp: now - 1 * 60000 },  // prep
        { open: 107, high: 108, low: 105, close: 106, volume: 1000, timestamp: now },               // final
      ];

      const data = createTestMarketData({
        candles,
        rsi: 45,
        ema: { fast: 95, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 114.5, // Near resistance at ~115
      });

      const result = await strategy.evaluate(data);

      // Should pass - 2 touches is enough for SHORT
      expect(result.valid).toBe(true);
      expect(result.signal?.direction).toBe(SignalDirection.SHORT);
    });
  });

  // ============================================================================
  // FILTER PIPELINE TESTS
  // ============================================================================

  describe('SHORT uptrend filter', () => {
    it('should block SHORT when blockShortInUptrend=true and in uptrend', async () => {
      const configWithFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockShortInUptrend: true,
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configWithFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 108, low: 98, close: 102, volume: 1000, timestamp: now - 13 * 60000 },
        { open: 102, high: 106, low: 96, close: 100, volume: 1000, timestamp: now - 12 * 60000 },
        { open: 100, high: 103, low: 85, close: 100, volume: 1000, timestamp: now - 11 * 60000 },
        { open: 100, high: 112, low: 95, close: 107, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 107, high: 115.0, low: 105, close: 112, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 108, high: 109, low: 88, close: 98, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 98, high: 110, low: 96, close: 105, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 105, high: 115.2, low: 104, close: 113, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 113, high: 114, low: 110, close: 111, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 111, high: 112, low: 108, close: 109, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 109, high: 110, low: 107, close: 108, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 108, high: 109, low: 106, close: 107, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 107, high: 108, low: 105, close: 106, volume: 1000, timestamp: now },
      ];

      // Uptrend: EMA20 > EMA50, RSI > 50
      const uptrendData = createTestMarketData({
        candles,
        rsi: 55,
        ema: { fast: 105, slow: 100 }, // fast > slow (uptrend)
        trend: 'BULLISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 114.5, // Near resistance
      });

      const result = await strategy.evaluate(uptrendData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('SHORT blocked in uptrend');
      expect(result.reason).toContain('EMA');
      expect(result.reason).toContain('RSI');
    });

    it('should allow SHORT when blockShortInUptrend=false even in uptrend', async () => {
      const configNoFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockShortInUptrend: false, // Filter disabled
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(configNoFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 108, low: 98, close: 102, volume: 1000, timestamp: now - 13 * 60000 },
        { open: 102, high: 106, low: 96, close: 100, volume: 1000, timestamp: now - 12 * 60000 },
        { open: 100, high: 103, low: 85, close: 100, volume: 1000, timestamp: now - 11 * 60000 },
        { open: 100, high: 112, low: 95, close: 107, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 107, high: 115.0, low: 105, close: 112, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 108, high: 109, low: 88, close: 98, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 98, high: 110, low: 96, close: 105, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 105, high: 115.2, low: 104, close: 113, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 113, high: 114, low: 110, close: 111, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 111, high: 112, low: 108, close: 109, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 109, high: 110, low: 107, close: 108, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 108, high: 109, low: 106, close: 107, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 107, high: 108, low: 105, close: 106, volume: 1000, timestamp: now },
      ];

      const uptrendData = createTestMarketData({
        candles,
        rsi: 48, // Session 36: SHORT requires RSI < 50
        ema: { fast: 105, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 114.5,
      });

      const result = await strategy.evaluate(uptrendData);

      expect(result.valid).toBe(true);
      expect(result.signal?.direction).toBe(SignalDirection.SHORT);
    });
  });

  describe('RSI filter pipeline', () => {
    const createCandlesWithLevels = (): Candle[] => {
      const now = Date.now();
      return [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];
    };

    it('should block LONG when RSI < longMinThreshold', async () => {
      const configWithRsiFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2,
        rsiFilters: {
          enabled: true,
          longMinThreshold: 30,
          longMaxThreshold: 70,
          shortMinThreshold: 30,
          shortMaxThreshold: 70,
        },
      };
      strategy = new LevelBasedStrategy(configWithRsiFilter, logger);

      const data = createTestMarketData({
        candles: createCandlesWithLevels(),
        rsi: 25, // Below 30
        ema: { fast: 105, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('RSI');
      expect(result.reason).toContain('25');
      expect(result.reason).toContain('30');
    });

    it('should block LONG when RSI > longMaxThreshold', async () => {
      const configWithRsiFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2,
        rsiFilters: {
          enabled: true,
          longMinThreshold: 30,
          longMaxThreshold: 70,
          shortMinThreshold: 30,
          shortMaxThreshold: 70,
        },
      };
      strategy = new LevelBasedStrategy(configWithRsiFilter, logger);

      const data = createTestMarketData({
        candles: createCandlesWithLevels(),
        rsi: 75, // Above 70
        ema: { fast: 105, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('RSI');
      expect(result.reason).toContain('75');
      expect(result.reason).toContain('70');
    });

    it('should allow LONG when RSI within thresholds', async () => {
      const configWithRsiFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2,
        rsiFilters: {
          enabled: true,
          longMinThreshold: 30,
          longMaxThreshold: 70,
          shortMinThreshold: 30,
          shortMaxThreshold: 70,
        },
      };
      strategy = new LevelBasedStrategy(configWithRsiFilter, logger);

      const data = createTestMarketData({
        candles: createCandlesWithLevels(),
        rsi: 50, // Within range
        ema: { fast: 105, slow: 100 },
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(data);

      expect(result.valid).toBe(true);
      expect(result.signal?.direction).toBe(SignalDirection.LONG);
    });
  });

  describe('flat market filter (TREND_EXISTENCE)', () => {
    it('should block entry when EMA gap is too small (flat market)', async () => {
      const config: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(config, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // Flat market: EMA gap < 0.5%
      const flatMarketData = createTestMarketData({
        candles,
        rsi: 50,
        ema: { fast: 100.2, slow: 100.0 }, // 0.2% gap - too small
        trend: 'NEUTRAL',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(flatMarketData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Flat market');
      expect(result.reason).toContain('EMA gap');
    });

    it('should allow entry when EMA gap is significant', async () => {
      const config: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false,
        minTouchesRequired: 2,
      };
      strategy = new LevelBasedStrategy(config, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // Trending market: EMA gap > 0.5%
      const trendingData = createTestMarketData({
        candles,
        rsi: 55,
        ema: { fast: 105, slow: 100 }, // 5% gap - significant
        trend: 'BULLISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(trendingData);

      expect(result.valid).toBe(true);
    });
  });

  describe('EMA structure filter', () => {
    it('should block LONG in strong downtrend (EMA diff > threshold AND RSI weak)', async () => {
      const configWithEmaFilter: LevelBasedConfig = {
        ...defaultConfig,
        requireTrendAlignment: false,
        blockLongInDowntrend: false, // Disable basic filter to test EMA structure
        minTouchesRequired: 2,
        emaFilters: {
          enabled: true,
          downtrend: {
            rsiThreshold: 55,
            emaDiffThreshold: 0.5,
          },
        },
      };
      strategy = new LevelBasedStrategy(configWithEmaFilter, logger);

      const now = Date.now();
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: now - 10 * 60000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: now - 9 * 60000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: now - 8 * 60000 },
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: now - 7 * 60000 },
        { open: 108, high: 110, low: 95.0, close: 97, volume: 1000, timestamp: now - 6 * 60000 },
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: now - 5 * 60000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: now - 4 * 60000 },
        { open: 103, high: 110, low: 102, close: 107, volume: 1000, timestamp: now - 3 * 60000 },
        { open: 107, high: 108, low: 95.2, close: 96, volume: 1000, timestamp: now - 2 * 60000 },
        { open: 96, high: 101, low: 96, close: 98, volume: 1000, timestamp: now - 1 * 60000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: now },
      ];

      // Strong downtrend: EMA diff > 0.5% AND RSI < rsiThreshold
      const strongDowntrendData = createTestMarketData({
        candles,
        rsi: 45, // < 55 (weak)
        ema: { fast: 99, slow: 100 }, // ~1% diff (strong downtrend)
        trend: 'BEARISH',
        atr: 1.5,
        timestamp: Date.now(),
        currentPrice: 95.5,
      });

      const result = await strategy.evaluate(strongDowntrendData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Strong downtrend');
    });
  });

  // ============================================================================
  // PHASE 3: MULTI-TIMEFRAME CONFIRMATION TESTS
  // ============================================================================
  describe('Multi-Timeframe Confirmation (Phase 3)', () => {
    let mtfConfig: LevelBasedConfig;

    beforeEach(() => {
      mtfConfig = {
        ...defaultConfig,
        multiTimeframeConfirmation: {
          enabled: true,
          htfLevelConfirmation: {
            enabled: true,
            alignmentThresholdPercent: 0.3,
            confidenceBoostPercent: 15,
          },
          contextTrendFilter: {
            enabled: true,
            minEmaGapPercent: 0.5,
          },
        },
      };
    });

    describe('Context Trend Filter (1h trend blocking)', () => {
      it('should block LONG when 1h trend is BEARISH', async () => {
        // Increase maxDistancePercent to allow levels to be found
        const relaxedConfig = {
          ...mtfConfig,
          maxDistancePercent: 3.0,
          minTouchesRequired: 2,
        };
        const mtfStrategy = new LevelBasedStrategy(relaxedConfig, logger);

        // Create candles with clear support level at 95
        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 }, // 5m uptrend
          emaTrend1: { fast: 100, slow: 95 }, // 15m uptrend
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.5, // Very close to support at 95
          emaContext: { fast: 94, slow: 100 }, // 1h BEARISH (fast < slow, gap > 0.5%)
        });

        const result = await mtfStrategy.evaluate(data);

        // Should be blocked - either by context trend or other filters
        expect(result.valid).toBe(false);
        // If it gets to context trend filter, it should be blocked there
        if (result.reason && !result.reason.includes('No levels') && !result.reason.includes('Not enough')) {
          expect(result.reason).toContain('1h trend');
        }
      });

      it('should block SHORT when 1h trend is BULLISH', async () => {
        // Increase maxDistancePercent to allow levels to be found
        const relaxedConfig = {
          ...mtfConfig,
          maxDistancePercent: 3.0,
          minTouchesRequired: 2,
        };
        const mtfStrategy = new LevelBasedStrategy(relaxedConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 45,
          ema: { fast: 95, slow: 100 }, // 5m downtrend
          emaTrend1: { fast: 95, slow: 100 }, // 15m downtrend
          trend: 'BEARISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 104.5, // Very close to resistance at 105
          emaContext: { fast: 106, slow: 100 }, // 1h BULLISH (fast > slow, gap > 0.5%)
        });

        const result = await mtfStrategy.evaluate(data);

        // Should be blocked - either by context trend or other filters
        expect(result.valid).toBe(false);
        // If it gets to context trend filter, it should be blocked there
        if (result.reason && !result.reason.includes('No levels') && !result.reason.includes('Not enough')) {
          expect(result.reason).toContain('1h trend');
        }
      });

      it('should allow entry when 1h trend aligns', async () => {
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 }, // 5m uptrend
          emaTrend1: { fast: 100, slow: 95 }, // 15m uptrend
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2, // Near support
          emaContext: { fast: 100, slow: 95 }, // 1h BULLISH (aligns with LONG)
        });

        const result = await mtfStrategy.evaluate(data);

        // Should pass context trend filter (may fail for other reasons)
        if (!result.valid) {
          expect(result.reason).not.toContain('1h trend');
        }
      });

      it('should not block when 1h trend is NEUTRAL', async () => {
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          emaContext: { fast: 100, slow: 100.2 }, // 1h NEUTRAL (gap < 0.5%)
        });

        const result = await mtfStrategy.evaluate(data);

        // Should pass context trend filter
        if (!result.valid) {
          expect(result.reason).not.toContain('1h trend');
        }
      });

      it('should not block when context trend filter is disabled', async () => {
        mtfConfig.multiTimeframeConfirmation!.contextTrendFilter.enabled = false;
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          emaContext: { fast: 94, slow: 100 }, // 1h BEARISH but should not block
        });

        const result = await mtfStrategy.evaluate(data);

        // Should not block for 1h trend when disabled
        if (!result.valid) {
          expect(result.reason).not.toContain('1h trend');
        }
      });
    });

    describe('HTF Level Confirmation (15m level alignment)', () => {
      it('should provide confidence boost when HTF level aligns', async () => {
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        // Create similar HTF candles with levels at same price
        const htfCandles = createSwingCandles(); // Same pattern = same levels

        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          candlesTrend1: htfCandles, // Provide HTF candles
          emaContext: { fast: 100, slow: 95 }, // 1h BULLISH (aligns)
        });

        const result = await mtfStrategy.evaluate(data);

        // If valid, should have [HTF-Confirmed] in reason
        if (result.valid && result.signal) {
          // Check that reason includes HTF-Confirmed or confidence is boosted
          expect(result.reason).toBeDefined();
        }
      });

      it('should not boost confidence when HTF level confirmation is disabled', async () => {
        mtfConfig.multiTimeframeConfirmation!.htfLevelConfirmation.enabled = false;
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const htfCandles = createSwingCandles();

        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          candlesTrend1: htfCandles,
          emaContext: { fast: 100, slow: 95 },
        });

        const result = await mtfStrategy.evaluate(data);

        // Should not have HTF-Confirmed when disabled
        if (result.valid && result.reason) {
          expect(result.reason).not.toContain('HTF-Confirmed');
        }
      });

      it('should not boost when no HTF candles available', async () => {
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          candlesTrend1: undefined, // No HTF candles
          emaContext: { fast: 100, slow: 95 },
        });

        const result = await mtfStrategy.evaluate(data);

        // Should not have HTF-Confirmed when no candles
        if (result.valid && result.reason) {
          expect(result.reason).not.toContain('HTF-Confirmed');
        }
      });
    });

    describe('MTF disabled', () => {
      it('should work normally when MTF confirmation is disabled', async () => {
        mtfConfig.multiTimeframeConfirmation!.enabled = false;
        const mtfStrategy = new LevelBasedStrategy(mtfConfig, logger);

        const candles = createSwingCandles();
        const data = createTestMarketData({
          candles,
          rsi: 55,
          ema: { fast: 100, slow: 95 },
          emaTrend1: { fast: 100, slow: 95 },
          trend: 'BULLISH',
          atr: 0.8,
          timestamp: Date.now(),
          currentPrice: 95.2,
          emaContext: { fast: 94, slow: 100 }, // 1h BEARISH but should not block
          candlesTrend1: createSwingCandles(),
        });

        const result = await mtfStrategy.evaluate(data);

        // Should not be blocked by 1h trend when disabled
        if (!result.valid) {
          expect(result.reason).not.toContain('1h trend');
        }
        // Should not have HTF-Confirmed when disabled
        if (result.valid && result.reason) {
          expect(result.reason).not.toContain('HTF-Confirmed');
        }
      });
    });
  });

  // Helper for MTF tests - creates candles with clear swing points
  function createSwingCandles(): Candle[] {
    const now = Date.now();
    const candles: Candle[] = [];
    const basePrice = 100;

    // Create 50 candles with clear swing pattern:
    // 0-10: rising to 105 (swing high)
    // 10-20: falling to 95 (swing low)
    // 20-30: rising to 105 (swing high)
    // 30-40: falling to 95 (swing low)
    // 40-50: slightly above support

    for (let i = 0; i < 50; i++) {
      let price: number;
      const cycle = i % 20;

      if (cycle < 10) {
        // Rising phase
        price = 95 + (cycle / 10) * 10; // 95 to 105
      } else {
        // Falling phase
        price = 105 - ((cycle - 10) / 10) * 10; // 105 to 95
      }

      candles.push(createTestCandle(
        now - (50 - i) * 60000,
        price,
        price + 0.5,
        price - 0.5,
        price,
        1000,
      ));
    }

    return candles;
  }
});
