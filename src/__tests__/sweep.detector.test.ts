import { SweepDetector } from '../analyzers/sweep.detector';
import { Candle, SweepType } from '../types';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('SweepDetector', () => {
  let detector: SweepDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new SweepDetector(mockLogger as any);
  });

  // Helper to create candles
  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number = 1000,
    timestamp: number = Date.now(),
  ): Candle => ({
    open,
    high,
    low,
    close,
    volume,
    timestamp,
  });

  // Create array of normal candles for volume baseline
  const createBaselineCandles = (count: number, basePrice: number = 100): Candle[] => {
    const candles: Candle[] = [];
    for (let i = 0; i < count; i++) {
      candles.push(createCandle(
        basePrice,
        basePrice + 0.1,
        basePrice - 0.1,
        basePrice,
        1000,
        Date.now() - (count - i) * 60000,
      ));
    }
    return candles;
  };

  describe('Bullish Sweep Detection', () => {
    it('should detect bullish sweep when price dips below support and recovers', () => {
      const supportLevel = 100;
      const candles = createBaselineCandles(20, 100.5);

      // Add a sweep candle: wick below support, close above
      candles.push(createCandle(
        100.2,   // open above support
        100.3,   // high
        99.8,    // low below support (sweep)
        100.15,  // close above support (recovery)
        2000,    // higher volume
        Date.now(),
      ));

      const result = detector.analyze(candles, [supportLevel], [], 'LONG');

      expect(result.hasSweep).toBe(true);
      expect(result.sweep).not.toBeNull();
      expect(result.sweep?.type).toBe(SweepType.BULLISH_SWEEP);
      expect(result.sweep?.levelPrice).toBe(supportLevel);
      expect(result.sweep?.sweepPrice).toBe(99.8);
      expect(result.confidenceBoost).toBeGreaterThan(0);
    });

    it('should NOT detect sweep when close is below support', () => {
      const supportLevel = 100;
      const candles = createBaselineCandles(20, 100.5);

      // Add candle that breaks support (not a sweep - no recovery)
      candles.push(createCandle(
        100.2,   // open above support
        100.3,   // high
        99.5,    // low below support
        99.7,    // close BELOW support (no recovery)
        1000,
        Date.now(),
      ));

      const result = detector.analyze(candles, [supportLevel], [], 'LONG');

      expect(result.hasSweep).toBe(false);
      expect(result.sweep).toBeNull();
    });

    it('should NOT detect sweep when wick is too small', () => {
      const supportLevel = 100;
      const candles = createBaselineCandles(20, 100.5);

      // Add candle with tiny wick below support (less than minWickPercent)
      candles.push(createCandle(
        100.1,   // open
        100.2,   // high
        99.95,   // low - only 0.05% below support (too small)
        100.05,  // close above support
        1000,
        Date.now(),
      ));

      const result = detector.analyze(candles, [supportLevel], [], 'LONG');

      expect(result.hasSweep).toBe(false);
    });
  });

  describe('Bearish Sweep Detection', () => {
    it('should detect bearish sweep when price spikes above resistance and drops', () => {
      const resistanceLevel = 100;
      const candles = createBaselineCandles(20, 99.5);

      // Add a sweep candle: wick above resistance, close below
      candles.push(createCandle(
        99.8,    // open below resistance
        100.25,  // high above resistance (sweep)
        99.7,    // low
        99.85,   // close below resistance (recovery)
        2000,    // higher volume
        Date.now(),
      ));

      const result = detector.analyze(candles, [], [resistanceLevel], 'SHORT');

      expect(result.hasSweep).toBe(true);
      expect(result.sweep).not.toBeNull();
      expect(result.sweep?.type).toBe(SweepType.BEARISH_SWEEP);
      expect(result.sweep?.levelPrice).toBe(resistanceLevel);
      expect(result.sweep?.sweepPrice).toBe(100.25);
      expect(result.confidenceBoost).toBeGreaterThan(0);
    });

    it('should NOT detect sweep when close is above resistance', () => {
      const resistanceLevel = 100;
      const candles = createBaselineCandles(20, 99.5);

      // Add candle that breaks resistance (not a sweep - no recovery)
      candles.push(createCandle(
        99.8,    // open below resistance
        100.5,   // high above resistance
        99.7,    // low
        100.2,   // close ABOVE resistance (no recovery)
        1000,
        Date.now(),
      ));

      const result = detector.analyze(candles, [], [resistanceLevel], 'SHORT');

      expect(result.hasSweep).toBe(false);
      expect(result.sweep).toBeNull();
    });
  });

  describe('Confidence Boost', () => {
    it('should provide confidence boost only for aligned direction', () => {
      const supportLevel = 100;
      const candles = createBaselineCandles(20, 100.5);

      // Add bullish sweep
      candles.push(createCandle(100.2, 100.3, 99.7, 100.15, 2000, Date.now()));

      // LONG should get boost from bullish sweep
      const longResult = detector.analyze(candles, [supportLevel], [], 'LONG');
      expect(longResult.confidenceBoost).toBeGreaterThan(0);

      // SHORT should NOT get boost from bullish sweep
      const shortResult = detector.analyze(candles, [supportLevel], [], 'SHORT');
      expect(shortResult.confidenceBoost).toBe(0);
    });

    it('should calculate higher confidence for volume spike', () => {
      const supportLevel = 100;

      // Test with normal volume
      const candlesNormalVol = createBaselineCandles(20, 100.5);
      candlesNormalVol.push(createCandle(100.2, 100.3, 99.7, 100.15, 1000, Date.now()));
      const resultNormal = detector.analyze(candlesNormalVol, [supportLevel], [], 'LONG');

      // Test with high volume (spike)
      const candlesHighVol = createBaselineCandles(20, 100.5);
      candlesHighVol.push(createCandle(100.2, 100.3, 99.7, 100.15, 3000, Date.now())); // 3x volume
      const resultSpike = detector.analyze(candlesHighVol, [supportLevel], [], 'LONG');

      // Higher volume should give stronger sweep
      expect(resultSpike.sweep?.strength).toBeGreaterThan(resultNormal.sweep?.strength || 0);
    });
  });

  describe('Suggested Stop Loss', () => {
    it('should suggest SL below sweep low for LONG', () => {
      const supportLevel = 100;
      const candles = createBaselineCandles(20, 100.5);
      candles.push(createCandle(100.2, 100.3, 99.7, 100.15, 2000, Date.now()));

      const result = detector.analyze(candles, [supportLevel], [], 'LONG');

      expect(result.suggestedSL).not.toBeNull();
      expect(result.suggestedSL).toBeLessThan(99.7); // Below sweep low
    });

    it('should suggest SL above sweep high for SHORT', () => {
      const resistanceLevel = 100;
      const candles = createBaselineCandles(20, 99.5);
      candles.push(createCandle(99.8, 100.35, 99.7, 99.85, 2000, Date.now()));

      const result = detector.analyze(candles, [], [resistanceLevel], 'SHORT');

      expect(result.suggestedSL).not.toBeNull();
      expect(result.suggestedSL).toBeGreaterThan(100.35); // Above sweep high
    });
  });

  describe('Edge Cases', () => {
    it('should return no sweep when disabled', () => {
      const disabledDetector = new SweepDetector(mockLogger as any, { enabled: false });
      const candles = createBaselineCandles(20, 100);

      const result = disabledDetector.analyze(candles, [100], [100], 'LONG');

      expect(result.hasSweep).toBe(false);
    });

    it('should return no sweep when not enough candles', () => {
      const candles = createBaselineCandles(5, 100); // Less than lookbackCandles

      const result = detector.analyze(candles, [100], [], 'LONG');

      expect(result.hasSweep).toBe(false);
    });

    it('should handle empty level arrays', () => {
      const candles = createBaselineCandles(25, 100);

      const result = detector.analyze(candles, [], [], 'LONG');

      expect(result.hasSweep).toBe(false);
      expect(result.recentSweeps).toHaveLength(0);
    });

    it('should detect multiple sweeps and return strongest', () => {
      const candles = createBaselineCandles(20, 100.5);

      // Add two sweep candles at different support levels
      candles.push(createCandle(100.2, 100.3, 99.85, 100.15, 1500, Date.now() - 60000)); // Weak sweep
      candles.push(createCandle(100.2, 100.3, 99.5, 100.15, 3000, Date.now())); // Strong sweep

      const result = detector.analyze(candles, [100, 99.6], [], 'LONG');

      expect(result.hasSweep).toBe(true);
      expect(result.recentSweeps.length).toBeGreaterThanOrEqual(1);
      // Should return strongest sweep
      expect(result.sweep?.sweepPrice).toBe(99.5);
    });
  });

  describe('Helper Methods', () => {
    it('hasRecentBullishSweep should return true after bullish sweep', () => {
      const candles = createBaselineCandles(20, 100.5);
      candles.push(createCandle(100.2, 100.3, 99.7, 100.15, 2000, Date.now()));

      detector.analyze(candles, [100], [], 'LONG');

      expect(detector.hasRecentBullishSweep()).toBe(true);
      expect(detector.hasRecentBearishSweep()).toBe(false);
    });

    it('hasRecentBearishSweep should return true after bearish sweep', () => {
      const candles = createBaselineCandles(20, 99.5);
      candles.push(createCandle(99.8, 100.35, 99.7, 99.85, 2000, Date.now()));

      detector.analyze(candles, [], [100], 'SHORT');

      expect(detector.hasRecentBearishSweep()).toBe(true);
      expect(detector.hasRecentBullishSweep()).toBe(false);
    });

    it('getRecentSweeps should return all detected sweeps', () => {
      const candles = createBaselineCandles(20, 100);
      candles.push(createCandle(100.2, 100.3, 99.7, 100.15, 2000, Date.now()));

      detector.analyze(candles, [100], [], 'LONG');

      const recentSweeps = detector.getRecentSweeps();
      expect(recentSweeps.length).toBeGreaterThan(0);
    });
  });
});
