/**
 * LevelAnalyzer Unit Tests
 *
 * Tests for the level detection and signal generation logic.
 */

import { LevelAnalyzer, LevelAnalyzerConfig } from '../analyzers/level.analyzer';
import { SwingPoint, SwingPointType, SignalDirection, Candle } from '../types';

// Mock Logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('LevelAnalyzer', () => {
  let analyzer: LevelAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new LevelAnalyzer(mockLogger as any, {
      clusterThresholdPercent: 0.5,
      minTouchesRequired: 3,
      minTouchesForStrong: 5,
      maxDistancePercent: 1.0,
      veryCloseDistancePercent: 0.3,
      recencyDecayDays: 7,
      volumeBoostThreshold: 1.5,
      baseConfidence: 60,
      maxConfidence: 90,
    });
  });

  const createCandle = (
    price: number,
    volume: number = 100,
    timestamp: number = Date.now(),
  ): Candle => ({
    timestamp,
    open: price - 0.01,
    high: price + 0.02,
    low: price - 0.02,
    close: price,
    volume,
  });

  const createSwingPoint = (
    price: number,
    type: SwingPointType,
    timestamp: number = Date.now(),
  ): SwingPoint => ({
    price,
    type,
    timestamp,
  });

  describe('analyze', () => {
    it('should return HOLD when no swing points provided', () => {
      const candles = [createCandle(100)];
      const result = analyzer.analyze([], 100, candles, Date.now());

      expect(result.direction).toBe(SignalDirection.HOLD);
      expect(result.nearestLevel).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should detect support level from clustered swing lows', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 30000),
        createSwingPoint(110, SwingPointType.HIGH, now - 5000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(105, 100, now - i * 60000),
      );

      const result = analyzer.analyze(swingPoints, 100.5, candles, now);

      expect(result.direction).toBe(SignalDirection.LONG);
      expect(result.nearestLevel).not.toBeNull();
      expect(result.nearestLevel?.type).toBe('SUPPORT');
      expect(result.nearestLevel?.touches).toBe(3);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect resistance level from clustered swing highs', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(110.0, SwingPointType.HIGH, now - 10000),
        createSwingPoint(110.1, SwingPointType.HIGH, now - 20000),
        createSwingPoint(110.2, SwingPointType.HIGH, now - 30000),
        createSwingPoint(100, SwingPointType.LOW, now - 5000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(105, 100, now - i * 60000),
      );

      const result = analyzer.analyze(swingPoints, 109.5, candles, now);

      expect(result.direction).toBe(SignalDirection.SHORT);
      expect(result.nearestLevel).not.toBeNull();
      expect(result.nearestLevel?.type).toBe('RESISTANCE');
      expect(result.nearestLevel?.touches).toBe(3);
    });

    it('should return HOLD when price is too far from levels', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 30000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(105, 100, now - i * 60000),
      );

      // Price is 5% away from level (max is 1%)
      const result = analyzer.analyze(swingPoints, 105, candles, now);

      expect(result.direction).toBe(SignalDirection.HOLD);
    });

    it('should require minimum touches for valid level', () => {
      const now = Date.now();
      // Only 2 touches (minimum is 3)
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(100.5, 100, now - i * 60000),
      );

      const result = analyzer.analyze(swingPoints, 100.5, candles, now);

      expect(result.direction).toBe(SignalDirection.HOLD);
      expect(result.allLevels.support.length).toBe(0);
    });

    it('should calculate higher confidence for more touches', () => {
      const now = Date.now();

      // 3 touches
      const threeTouch = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 30000),
      ];

      // 5 touches
      const fiveTouch = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
        createSwingPoint(100.15, SwingPointType.LOW, now - 30000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 40000),
        createSwingPoint(100.05, SwingPointType.LOW, now - 50000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(100.5, 100, now - i * 60000),
      );

      const result3 = analyzer.analyze(threeTouch, 100.5, candles, now);
      const result5 = analyzer.analyze(fiveTouch, 100.5, candles, now);

      expect(result5.confidence).toBeGreaterThan(result3.confidence);
    });

    it('should consider volume when calculating level strength', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 60000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 120000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 180000),
      ];

      // Create candles with matching timestamps and high volume at touch points
      const candles: Candle[] = [];
      for (let i = 0; i < 100; i++) {
        const ts = now - i * 60000;
        const isAtTouch = swingPoints.some(sp => Math.abs(sp.timestamp - ts) < 60000);
        candles.push(createCandle(100.5, isAtTouch ? 500 : 100, ts));
      }

      const result = analyzer.analyze(swingPoints, 100.5, candles, now);

      expect(result.nearestLevel).not.toBeNull();
      expect(result.nearestLevel!.avgVolumeAtTouch).toBeGreaterThan(0);
    });
  });

  describe('generateSignal', () => {
    it('should return AnalyzerSignal for valid level', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
        createSwingPoint(100.2, SwingPointType.LOW, now - 30000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(100.5, 100, now - i * 60000),
      );

      const signal = analyzer.generateSignal(swingPoints, 100.5, candles, now);

      expect(signal).not.toBeNull();
      expect(signal!.source).toBe('LEVEL_ANALYZER');
      expect(signal!.direction).toBe(SignalDirection.LONG);
      expect(signal!.weight).toBe(0.25);
      expect(signal!.priority).toBe(7);
    });

    it('should return null when no valid level found', () => {
      const now = Date.now();
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now),
        createSwingPoint(100.1, SwingPointType.LOW, now),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(105, 100, now - i * 60000),
      );

      const signal = analyzer.generateSignal(swingPoints, 105, candles, now);

      expect(signal).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig: Partial<LevelAnalyzerConfig> = {
        minTouchesRequired: 5,
        maxDistancePercent: 2.0,
      };

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, customConfig);
      const config = customAnalyzer.getConfig();

      expect(config.minTouchesRequired).toBe(5);
      expect(config.maxDistancePercent).toBe(2.0);
    });

    it('should update configuration', () => {
      analyzer.updateConfig({ minTouchesRequired: 4 });
      const config = analyzer.getConfig();

      expect(config.minTouchesRequired).toBe(4);
    });
  });

  // ============================================================================
  // NEW EDGE CASE TESTS - Added for level detection improvements
  // ============================================================================

  describe('asymmetric distance for trend-aligned entries', () => {
    it('should return wider maxDistance for RESISTANCE in DOWNTREND (SHORT entries)', () => {
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxDistancePercent: 1.0,
        trendAlignedDistanceMultiplier: 1.5,
      });

      // DOWNTREND + RESISTANCE = trend-aligned SHORT entry
      const distanceDowntrendResistance = customAnalyzer.getAsymmetricMaxDistance('RESISTANCE', 'DOWNTREND');
      expect(distanceDowntrendResistance).toBe(1.5); // 1.0 * 1.5

      // DOWNTREND + SUPPORT = counter-trend entry (no multiplier)
      const distanceDowntrendSupport = customAnalyzer.getAsymmetricMaxDistance('SUPPORT', 'DOWNTREND');
      expect(distanceDowntrendSupport).toBe(1.0);
    });

    it('should return wider maxDistance for SUPPORT in UPTREND (LONG entries)', () => {
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxDistancePercent: 1.0,
        trendAlignedDistanceMultiplier: 1.5,
      });

      // UPTREND + SUPPORT = trend-aligned LONG entry
      const distanceUptrendSupport = customAnalyzer.getAsymmetricMaxDistance('SUPPORT', 'UPTREND');
      expect(distanceUptrendSupport).toBe(1.5); // 1.0 * 1.5

      // UPTREND + RESISTANCE = counter-trend entry (no multiplier)
      const distanceUptrendResistance = customAnalyzer.getAsymmetricMaxDistance('RESISTANCE', 'UPTREND');
      expect(distanceUptrendResistance).toBe(1.0);
    });

    it('should return base maxDistance for NEUTRAL trend', () => {
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxDistancePercent: 1.0,
        trendAlignedDistanceMultiplier: 1.5,
      });

      expect(customAnalyzer.getAsymmetricMaxDistance('SUPPORT', 'NEUTRAL')).toBe(1.0);
      expect(customAnalyzer.getAsymmetricMaxDistance('RESISTANCE', 'NEUTRAL')).toBe(1.0);
    });
  });

  describe('level age filtering', () => {
    it('should filter out old levels based on maxLevelAgeCandles', () => {
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      // Create analyzer with 100 candle age limit (100 minutes for 1m)
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxLevelAgeCandles: 100,
        candleIntervalMinutes: 1,
        minTouchesRequired: 2,
      });

      // Create swing points - some fresh, some old
      const swingPoints = [
        // Fresh support level (10 minutes ago) - should be kept
        createSwingPoint(100.0, SwingPointType.LOW, now - 10 * oneMinuteMs),
        createSwingPoint(100.1, SwingPointType.LOW, now - 15 * oneMinuteMs),
        createSwingPoint(100.2, SwingPointType.LOW, now - 20 * oneMinuteMs),
        // Old support level (200 minutes ago) - should be filtered
        createSwingPoint(95.0, SwingPointType.LOW, now - 200 * oneMinuteMs),
        createSwingPoint(95.1, SwingPointType.LOW, now - 210 * oneMinuteMs),
        createSwingPoint(95.2, SwingPointType.LOW, now - 220 * oneMinuteMs),
      ];

      const candles = Array.from({ length: 300 }, (_, i) =>
        createCandle(100, 100, now - i * oneMinuteMs),
      );

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now);

      // Should only have the fresh level, not the old one
      expect(levels.support.length).toBe(1);
      expect(levels.support[0].price).toBeCloseTo(100.1, 1); // Cluster average ~100.1
    });

    it('should keep all levels when maxLevelAgeCandles is not set', () => {
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      // Create analyzer without age limit
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
      });

      const swingPoints = [
        // Fresh level
        createSwingPoint(100.0, SwingPointType.LOW, now - 10 * oneMinuteMs),
        createSwingPoint(100.1, SwingPointType.LOW, now - 15 * oneMinuteMs),
        // Old level (should still be included)
        createSwingPoint(95.0, SwingPointType.LOW, now - 200 * oneMinuteMs),
        createSwingPoint(95.1, SwingPointType.LOW, now - 210 * oneMinuteMs),
      ];

      const candles = Array.from({ length: 300 }, (_, i) =>
        createCandle(100, 100, now - i * oneMinuteMs),
      );

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now);

      // Both levels should be present
      expect(levels.support.length).toBe(2);
    });
  });

  describe('dynamic clustering with ATR', () => {
    it('should use dynamic cluster threshold when atrPercent is provided', () => {
      const now = Date.now();
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        clusterThresholdPercent: 0.3, // Static threshold
        dynamicClusterThreshold: {
          enabled: true,
          atrMultiplier: 0.5, // ATR * 0.5
        },
        minTouchesRequired: 2,
      });

      // With high ATR (2%), dynamic threshold = 2% * 0.5 = 1%
      // This should cluster levels further apart than static 0.3%
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.8, SwingPointType.LOW, now - 20000), // 0.8% away
        createSwingPoint(100.9, SwingPointType.LOW, now - 30000), // 0.9% away
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(101, 100, now - i * 60000),
      );

      // With ATR 2% -> dynamic threshold 1%, all 3 points should cluster together
      const levelsWithHighAtr = customAnalyzer.getAllLevels(swingPoints, candles, now, 2.0);
      expect(levelsWithHighAtr.support.length).toBe(1); // All clustered

      // With low ATR 0.2% -> dynamic threshold 0.1% (min is 0.3%)
      // Points 0.8-0.9% apart should NOT cluster
      // Note: Static threshold 0.3% still applies as minimum
      const levelsWithLowAtr = customAnalyzer.getAllLevels(swingPoints, candles, now, 0.2);
      // With 0.3% threshold, 100.0 and 100.8 won't cluster (0.8% > 0.3%)
      expect(levelsWithLowAtr.support.length).toBeGreaterThan(1);
    });
  });

  describe('level exhaustion', () => {
    it('should reduce level strength after breakouts', () => {
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        levelExhaustion: {
          enabled: true,
          penaltyPerBreakout: 0.15,
          maxPenalty: 0.6,
          breakoutThresholdPercent: 0.1,
          lookbackCandles: 50,
        },
      });

      // Support level at 100
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10 * oneMinuteMs),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20 * oneMinuteMs),
        createSwingPoint(100.2, SwingPointType.LOW, now - 30 * oneMinuteMs),
      ];

      // Create candles with 3 breakouts below support (closes at 99.5, well below 100)
      const candles: Candle[] = [];
      for (let i = 0; i < 50; i++) {
        const ts = now - i * oneMinuteMs;
        // 3 candles close below support level
        const closePrice = i < 3 ? 99.5 : 101;
        candles.push(createCandle(closePrice, 100, ts));
      }

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now);

      expect(levels.support.length).toBe(1);
      const supportLevel = levels.support[0];

      // Should have detected breakouts
      expect(supportLevel.breakouts).toBe(3);
      expect(supportLevel.exhaustionPenalty).toBeCloseTo(0.45, 2); // 3 * 0.15 = 0.45

      // Strength should be reduced
      // Original strength ~0.6 (3 touches), after 45% penalty = 0.6 * 0.55 = 0.33
      expect(supportLevel.strength).toBeLessThan(0.5);
    });

    it('should cap exhaustion penalty at maxPenalty', () => {
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        levelExhaustion: {
          enabled: true,
          penaltyPerBreakout: 0.15,
          maxPenalty: 0.6, // Max 60% penalty
          breakoutThresholdPercent: 0.1,
          lookbackCandles: 50,
        },
      });

      // Resistance level at 110
      const swingPoints = [
        createSwingPoint(110.0, SwingPointType.HIGH, now - 10 * oneMinuteMs),
        createSwingPoint(110.1, SwingPointType.HIGH, now - 20 * oneMinuteMs),
      ];

      // Create candles with 10 breakouts above resistance
      const candles: Candle[] = [];
      for (let i = 0; i < 50; i++) {
        const ts = now - i * oneMinuteMs;
        // 10 candles close above resistance
        const closePrice = i < 10 ? 111.0 : 109;
        candles.push(createCandle(closePrice, 100, ts));
      }

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now);

      expect(levels.resistance.length).toBe(1);
      const resistanceLevel = levels.resistance[0];

      // Penalty should be capped at 0.6 (not 10 * 0.15 = 1.5)
      expect(resistanceLevel.exhaustionPenalty).toBe(0.6);
      expect(resistanceLevel.breakouts).toBe(10);

      // Strength should be at least 0.1 (minimum)
      expect(resistanceLevel.strength).toBeGreaterThanOrEqual(0.1);
    });

    it('should not apply exhaustion when disabled', () => {
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        // levelExhaustion not configured = disabled
      });

      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10 * oneMinuteMs),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20 * oneMinuteMs),
      ];

      // Candles with breakouts
      const candles: Candle[] = [];
      for (let i = 0; i < 50; i++) {
        const ts = now - i * oneMinuteMs;
        const closePrice = i < 5 ? 99.0 : 101;
        candles.push(createCandle(closePrice, 100, ts));
      }

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now);

      expect(levels.support.length).toBe(1);
      // No exhaustion fields should be set
      expect(levels.support[0].breakouts).toBeUndefined();
      expect(levels.support[0].exhaustionPenalty).toBeUndefined();
    });
  });

  describe('breakout mode config', () => {
    it('should support breakout mode configuration', () => {
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxDistancePercent: 1.0,
        // Note: breakoutMode is handled by strategy, not analyzer
        // This test verifies analyzer doesn't break with extra config
      });

      expect(customAnalyzer.getConfig().maxDistancePercent).toBe(1.0);
    });
  });

  describe('SHORT entry in downtrend edge case', () => {
    it('should find resistance level when price is below resistance in downtrend', () => {
      const now = Date.now();

      // Analyzer with asymmetric distance
      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        maxDistancePercent: 1.0,
        trendAlignedDistanceMultiplier: 1.5,
        minTouchesRequired: 3,
      });

      // Resistance level at 110
      const swingPoints = [
        createSwingPoint(110.0, SwingPointType.HIGH, now - 10000),
        createSwingPoint(110.1, SwingPointType.HIGH, now - 20000),
        createSwingPoint(110.2, SwingPointType.HIGH, now - 30000),
        // Need lows too
        createSwingPoint(105.0, SwingPointType.LOW, now - 15000),
      ];

      const candles = Array.from({ length: 100 }, (_, i) =>
        createCandle(108.5, 100, now - i * 60000),
      );

      // Current price 108.5, resistance at ~110.1
      // Distance = (110.1 - 108.5) / 110.1 * 100 = 1.45%
      // With trend-aligned multiplier: maxDistance = 1.0 * 1.5 = 1.5%
      // So 1.45% should be within range!

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now, undefined, 'DOWNTREND');

      expect(levels.resistance.length).toBeGreaterThan(0);
      expect(levels.resistance[0].touches).toBe(3);

      // The level should be found within asymmetric distance
      const resistancePrice = levels.resistance[0].price;
      const currentPrice = 108.5;
      const distance = Math.abs((currentPrice - resistancePrice) / resistancePrice) * 100;

      // With 1.5x multiplier, distance should be acceptable
      const asymmetricMax = customAnalyzer.getAsymmetricMaxDistance('RESISTANCE', 'DOWNTREND');
      expect(distance).toBeLessThanOrEqual(asymmetricMax);
    });
  });

  describe('orderbook validation', () => {
    it('should boost SUPPORT level strength when BID wall confirms it', () => {
      const now = Date.now();

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        orderbookValidation: {
          enabled: true,
          minWallPercent: 5,
          strengthBoost: 0.15,
          maxDistancePercent: 0.3,
          requireConfirmation: false,
        },
      });

      // Support level at 100
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
      ];

      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(101, 100, now - i * 60000),
      );

      // Orderbook with BID wall near support level
      const orderbookAnalysis = {
        timestamp: now,
        orderBook: { symbol: 'TEST', timestamp: now, bids: [], asks: [], updateId: 1 },
        imbalance: { bidVolume: 1000, askVolume: 800, ratio: 1.25, direction: 'BULLISH' as const, strength: 0.5 },
        walls: [
          { side: 'BID' as const, price: 100.1, quantity: 500, percentOfTotal: 10, distance: 1.0 },
        ],
        strongestBid: null,
        strongestAsk: null,
        spread: 0.1,
        depth: { bid: 50, ask: 50 },
      };

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now, undefined, undefined, orderbookAnalysis);

      expect(levels.support.length).toBe(1);
      expect(levels.support[0].orderbookConfirmed).toBe(true);
      expect(levels.support[0].orderbookWall).toBeDefined();
      expect(levels.support[0].orderbookWall?.side).toBe('BID');
    });

    it('should boost RESISTANCE level strength when ASK wall confirms it', () => {
      const now = Date.now();

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        orderbookValidation: {
          enabled: true,
          minWallPercent: 5,
          strengthBoost: 0.15,
          maxDistancePercent: 0.3,
          requireConfirmation: false,
        },
      });

      // Resistance level at 110
      const swingPoints = [
        createSwingPoint(110.0, SwingPointType.HIGH, now - 10000),
        createSwingPoint(110.1, SwingPointType.HIGH, now - 20000),
        createSwingPoint(100.0, SwingPointType.LOW, now - 15000), // Need at least one low
      ];

      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(108, 100, now - i * 60000),
      );

      // Orderbook with ASK wall near resistance level
      const orderbookAnalysis = {
        timestamp: now,
        orderBook: { symbol: 'TEST', timestamp: now, bids: [], asks: [], updateId: 1 },
        imbalance: { bidVolume: 800, askVolume: 1000, ratio: 0.8, direction: 'BEARISH' as const, strength: 0.5 },
        walls: [
          { side: 'ASK' as const, price: 110.0, quantity: 600, percentOfTotal: 12, distance: 2.0 },
        ],
        strongestBid: null,
        strongestAsk: null,
        spread: 0.1,
        depth: { bid: 50, ask: 50 },
      };

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now, undefined, undefined, orderbookAnalysis);

      expect(levels.resistance.length).toBe(1);
      expect(levels.resistance[0].orderbookConfirmed).toBe(true);
      expect(levels.resistance[0].orderbookWall?.side).toBe('ASK');
    });

    it('should NOT confirm level when wall is too far from level price', () => {
      const now = Date.now();

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        orderbookValidation: {
          enabled: true,
          minWallPercent: 5,
          strengthBoost: 0.15,
          maxDistancePercent: 0.3, // Only 0.3% distance allowed
          requireConfirmation: false,
        },
      });

      // Support level at 100
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.05, SwingPointType.LOW, now - 20000),
      ];

      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(101, 100, now - i * 60000),
      );

      // BID wall at 99.0 - too far from 100.0 (1% distance)
      const orderbookAnalysis = {
        timestamp: now,
        orderBook: { symbol: 'TEST', timestamp: now, bids: [], asks: [], updateId: 1 },
        imbalance: { bidVolume: 1000, askVolume: 800, ratio: 1.25, direction: 'BULLISH' as const, strength: 0.5 },
        walls: [
          { side: 'BID' as const, price: 99.0, quantity: 500, percentOfTotal: 10, distance: 2.0 },
        ],
        strongestBid: null,
        strongestAsk: null,
        spread: 0.1,
        depth: { bid: 50, ask: 50 },
      };

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now, undefined, undefined, orderbookAnalysis);

      expect(levels.support.length).toBe(1);
      expect(levels.support[0].orderbookConfirmed).toBeFalsy();
      expect(levels.support[0].orderbookWall).toBeUndefined();
    });

    it('should NOT confirm level when wall size is below threshold', () => {
      const now = Date.now();

      const customAnalyzer = new LevelAnalyzer(mockLogger as any, {
        minTouchesRequired: 2,
        orderbookValidation: {
          enabled: true,
          minWallPercent: 10, // Require 10% minimum
          strengthBoost: 0.15,
          maxDistancePercent: 0.3,
          requireConfirmation: false,
        },
      });

      // Support level at 100
      const swingPoints = [
        createSwingPoint(100.0, SwingPointType.LOW, now - 10000),
        createSwingPoint(100.1, SwingPointType.LOW, now - 20000),
      ];

      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(101, 100, now - i * 60000),
      );

      // BID wall only 5% - below threshold
      const orderbookAnalysis = {
        timestamp: now,
        orderBook: { symbol: 'TEST', timestamp: now, bids: [], asks: [], updateId: 1 },
        imbalance: { bidVolume: 1000, askVolume: 800, ratio: 1.25, direction: 'BULLISH' as const, strength: 0.5 },
        walls: [
          { side: 'BID' as const, price: 100.1, quantity: 200, percentOfTotal: 5, distance: 1.0 },
        ],
        strongestBid: null,
        strongestAsk: null,
        spread: 0.1,
        depth: { bid: 50, ask: 50 },
      };

      const levels = customAnalyzer.getAllLevels(swingPoints, candles, now, undefined, undefined, orderbookAnalysis);

      expect(levels.support.length).toBe(1);
      expect(levels.support[0].orderbookConfirmed).toBeFalsy();
    });
  });
});
