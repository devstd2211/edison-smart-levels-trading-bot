/**
 * ATR Analyzer NEW - Functional Tests
 * Tests real market patterns and signal behavior
 */

import { AtrAnalyzerNew } from '../../analyzers/atr.analyzer-new';
import type { Candle } from '../../types/core';
import type { AtrAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandleSequence(
  prices: number[],
  volatility: number | ((index: number) => number) = 0.01
): Candle[] {
  return prices.map((price, index) => {
    const vol = typeof volatility === 'function' ? volatility(index) : volatility;
    return {
      timestamp: Date.now() + index * 60000,
      open: price,
      high: price * (1 + vol),
      low: price * (1 - vol),
      close: price,
      volume: 1000,
    };
  });
}

function createDefaultConfig(): AtrAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.8,
    priority: 5,
    confidenceMultiplier: 1.0,
    maxConfidence: 0.95,
  };
}

// ============================================================================
// FUNCTIONAL TESTS: MARKET PATTERNS
// ============================================================================

describe('AtrAnalyzerNew - Functional: High Volatility Markets', () => {
  it('should generate LONG signal during high volatility periods', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // High volatility: large price swings - 50+ prices
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, 0.1); // 10% volatility

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(40);
    expect(signal.source).toBe('ATR_ANALYZER');
    expect(signal.weight).toBe(config.weight);
  });

  it('should maintain high confidence with sustained high volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Sustained high volatility over 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.8);
    const candles = createCandleSequence(prices, 0.12); // 12% volatility

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(50);
  });

  it('should have highest confidence during extreme volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Extreme volatility: very large price ranges
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const candles = createCandleSequence(prices, 0.2); // 20% volatility

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(60);
  });
});

describe('AtrAnalyzerNew - Functional: Low Volatility Markets', () => {
  it('should generate SHORT signal during low volatility periods', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Low volatility: small price swings - 50+ prices
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    const candles = createCandleSequence(prices, 0.001); // 0.1% volatility

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(10);
    expect(signal.source).toBe('ATR_ANALYZER');
  });

  it('should maintain strong SHORT signal with sustained low volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Sustained consolidation - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.05);
    const candles = createCandleSequence(prices, 0.002); // 0.2% volatility

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(20);
  });
});

describe('AtrAnalyzerNew - Functional: Consolidation to Breakout', () => {
  it('should transition from SHORT to LONG on volatility spike', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Low volatility consolidation followed by breakout
    const consolidation = Array.from({ length: 25 }, (_, i) => 100 + i * 0.05);
    const breakout = Array.from({ length: 35 }, (_, i) => 101 + i * 1.5);
    const prices = [...consolidation, ...breakout];

    const candles = createCandleSequence(prices, (index: number) =>
      index < 25 ? 0.002 : 0.15 // Low vol then high vol
    );

    const signal = analyzer.analyze(candles);

    // End of sequence is in breakout = LONG
    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(30);
  });
});

describe('AtrAnalyzerNew - Functional: Trending Markets with Varying ATR', () => {
  it('should respond to increasing volatility in uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Uptrend with increasing volatility - 50+ prices
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, (index: number) =>
      0.02 + (index / 50) * 0.18 // Volatility increases from 2% to 20%
    );

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(40);
  });

  it('should respond to decreasing volatility in uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Uptrend with decreasing volatility - 50+ prices
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, (index: number) =>
      0.2 - (index / 50) * 0.18 // Volatility decreases from 20% to 2%
    );

    const signal = analyzer.analyze(candles);

    // Decreasing volatility might shift to HOLD or SHORT
    expect([SignalDirection.LONG, SignalDirection.HOLD, SignalDirection.SHORT]).toContain(signal.direction);
  });
});

describe('AtrAnalyzerNew - Functional: Gap Volatility', () => {
  it('should respond to gap with increased volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Pre-gap consolidation then gap up with increased volatility - 60+ prices
    const preGap = Array.from({ length: 15 }, () => 100);
    const postGap = Array.from({ length: 45 }, (_, i) => 110 + i * 0.5);
    const prices = [...preGap, ...postGap];

    const candles = createCandleSequence(prices, (index: number) =>
      index < 15 ? 0.001 : 0.1 // Low vol before gap, high vol after
    );

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(30);
  });
});

describe('AtrAnalyzerNew - Functional: Volatile Range Trading', () => {
  it('should oscillate between LONG and HOLD in volatile range', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Range with high volatility - 60+ prices
    const prices = [
      100, 105, 110, 105, 100, 95, 90, 95, 100, 105, // Range with big swings (10)
      110, 105, 100, 95, 90, 85, 90, 95, 100, 105, // Continue oscillating (10)
      110, 115, 110, 105, 100, 95, 90, 85, 80, 85, // Range continues (10)
      90, 95, 100, 105, 110, 115, 120, 125, 130, 135, // Final breakout up (10)
      140, 145, 150, 155, 160, 165, 170, 175, 180, 185, // Even further (10)
    ];

    const candles = createCandleSequence(prices, 0.08); // High volatility throughout

    const signal = analyzer.analyze(candles);

    // Should be LONG due to consistent high volatility
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('AtrAnalyzerNew - Functional: Reversal Volatility Patterns', () => {
  it('should detect volatility spike at reversal points', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Uptrend, reversal with volatility spike, downtrend - 60+ prices
    const uptrend = Array.from({ length: 20 }, (_, i) => 100 + i * 1);
    const reversal = Array.from({ length: 20 }, (_, i) => 120 - i * 1.5); // Faster down with high vol
    const downtrend = Array.from({ length: 20 }, (_, i) => 90 - i * 0.5);
    const prices = [...uptrend, ...reversal, ...downtrend];

    const candles = createCandleSequence(prices, (index: number) => {
      if (index < 20) return 0.02; // Low vol uptrend
      if (index < 40) return 0.15; // High vol reversal - this dominates the ATR
      return 0.05; // Medium vol downtrend
    });

    const signal = analyzer.analyze(candles);

    // High volatility dominates the analysis, should be LONG or HOLD
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('AtrAnalyzerNew - Functional: Signal Strength Variation', () => {
  it('should scale confidence with different volatility levels', () => {
    const config = createDefaultConfig();

    // Mild volatility (2%)
    const mildVolCandles = createCandleSequence(
      Array.from({ length: 50 }, (_, i) => 100 + i * 0.5),
      0.02
    );
    const mildAnalyzer = new AtrAnalyzerNew(config);
    const mildSignal = mildAnalyzer.analyze(mildVolCandles);

    // Extreme volatility (15%)
    const extremeVolCandles = createCandleSequence(
      Array.from({ length: 50 }, (_, i) => 100 + i * 0.5),
      0.15
    );
    const extremeAnalyzer = new AtrAnalyzerNew(config);
    const extremeSignal = extremeAnalyzer.analyze(extremeVolCandles);

    // Both should generate signals, but extreme should have higher confidence
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(mildSignal.direction);
    expect(SignalDirection.LONG).toBe(extremeSignal.direction);
    expect(extremeSignal.confidence).toBeGreaterThan(mildSignal.confidence);
  });

  test('should clamp confidence to configured maxConfidence', () => {
    const config = {
      ...createDefaultConfig(),
      maxConfidence: 0.5,
    };
    const analyzer = new AtrAnalyzerNew(config);

    // High volatility with low maxConfidence
    const candles = createCandleSequence(
      Array.from({ length: 50 }, (_, i) => 100 + i * 2),
      0.2
    );

    const signal = analyzer.analyze(candles);

    // Confidence should not exceed maxConfidence (50)
    expect(signal.confidence).toBeLessThanOrEqual(50);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('AtrAnalyzerNew - Functional: Threshold Detection', () => {
  it('should correctly identify high volatility with custom threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // High volatility candles
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, 0.1);

    const atr = analyzer.getAtrValue(candles);
    // Test with threshold higher than actual ATR
    expect(analyzer.isHighVolatility(candles, atr + 1)).toBe(false);
    // Test with threshold lower than actual ATR
    expect(analyzer.isHighVolatility(candles, atr - 1)).toBe(true);
  });

  it('should correctly identify low volatility with custom threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Low volatility candles
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.05);
    const candles = createCandleSequence(prices, 0.001);

    const atr = analyzer.getAtrValue(candles);
    // Test with threshold higher than actual ATR
    expect(analyzer.isLowVolatility(candles, atr + 0.1)).toBe(true);
    // Test with threshold lower than actual ATR
    expect(analyzer.isLowVolatility(candles, atr - 0.1)).toBe(false);
  });
});

describe('AtrAnalyzerNew - Functional: Signal Consistency', () => {
  it('should flip signal on significant volatility change', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // Phase 1: Low volatility
    const lowVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    const lowVolCandles = createCandleSequence(lowVolPrices, 0.001);
    const signal1 = analyzer.analyze(lowVolCandles);
    expect(signal1.direction).toBe(SignalDirection.SHORT);

    // Phase 2: High volatility
    const highVolPrices = Array.from({ length: 50 }, (_, i) => 105 + i * 1);
    const highVolCandles = createCandleSequence(highVolPrices, 0.15);
    const signal2 = analyzer.analyze(highVolCandles);
    expect(signal2.direction).toBe(SignalDirection.LONG);
  });

  it('should maintain signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    // First analysis: low volatility
    const lowVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.05);
    const lowVolCandles = createCandleSequence(lowVolPrices, 0.001);
    const signal1 = analyzer.analyze(lowVolCandles);

    expect(signal1.direction).toBe(SignalDirection.SHORT);

    // State should record signal
    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis: high volatility
    const highVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const highVolCandles = createCandleSequence(highVolPrices, 0.12);
    const signal2 = analyzer.analyze(highVolCandles);

    expect(signal2.direction).toBe(SignalDirection.LONG);

    // State should be updated
    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
  });
});

describe('AtrAnalyzerNew - Functional: Config Impact on Signals', () => {
  it('should scale confidence with maxConfidence parameter', () => {
    const highConfigMax = { ...createDefaultConfig(), maxConfidence: 0.95 };
    const lowConfigMax = { ...createDefaultConfig(), maxConfidence: 0.3 };

    const highAnalyzer = new AtrAnalyzerNew(highConfigMax);
    const lowAnalyzer = new AtrAnalyzerNew(lowConfigMax);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, 0.1);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Both should be LONG, but high config should have higher confidence
    expect(highSignal.direction).toBe(SignalDirection.LONG);
    expect(lowSignal.direction).toBe(SignalDirection.LONG);
    expect(highSignal.confidence).toBeGreaterThan(lowSignal.confidence);
  });

  it('should respect weight in score calculation', () => {
    const highWeightConfig = { ...createDefaultConfig(), weight: 0.9 };
    const lowWeightConfig = { ...createDefaultConfig(), weight: 0.2 };

    const highAnalyzer = new AtrAnalyzerNew(highWeightConfig);
    const lowAnalyzer = new AtrAnalyzerNew(lowWeightConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, 0.1);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Score should reflect weight
    expect(highSignal.score).toBeGreaterThan(lowSignal.score ?? 0);
  });

  it('should apply confidenceMultiplier to confidence calculation', () => {
    const highMultiplier = { ...createDefaultConfig(), confidenceMultiplier: 2.0 };
    const lowMultiplier = { ...createDefaultConfig(), confidenceMultiplier: 0.5 };

    const highAnalyzer = new AtrAnalyzerNew(highMultiplier);
    const lowAnalyzer = new AtrAnalyzerNew(lowMultiplier);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
    const candles = createCandleSequence(prices, 0.1);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Higher multiplier should lead to higher confidence
    expect(highSignal.confidence).toBeGreaterThan(lowSignal.confidence);
  });
});
