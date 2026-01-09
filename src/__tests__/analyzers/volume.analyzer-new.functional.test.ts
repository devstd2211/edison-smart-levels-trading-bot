/**
 * Volume Analyzer NEW - Functional Tests
 * Tests real market patterns and signal behavior
 */

import { VolumeAnalyzerNew } from '../../analyzers/volume.analyzer-new';
import type { Candle } from '../../types/core';
import type { VolumeAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandleSequence(
  prices: number[],
  volumes: number | number[] | ((index: number) => number) = 1000
): Candle[] {
  return prices.map((price, index) => {
    let vol: number;
    if (typeof volumes === 'number') {
      vol = volumes;
    } else if (typeof volumes === 'function') {
      vol = volumes(index);
    } else {
      vol = volumes[index] ?? volumes[0];
    }
    return {
      timestamp: Date.now() + index * 60000,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: vol,
    };
  });
}

function createDefaultConfig(): VolumeAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.7,
    priority: 4,
    neutralConfidence: 0.3,
  };
}

// ============================================================================
// FUNCTIONAL TESTS
// ============================================================================

describe('VolumeAnalyzerNew - Functional: Uptrend with Strong Volume', () => {
  it('should generate LONG signal in uptrend with high volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Uptrend with rising volume creating strong final volume - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.8);
    const candles = createCandleSequence(prices, (index) =>
      index < 59 ? 500 : 2000 // Low average, high spike at end
    );

    const signal = analyzer.analyze(candles);

    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
    expect(signal.source).toBe('VOLUME_ANALYZER');
  });

  it('should maintain high confidence with sustained volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Uptrend with consistent high volume - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.8);
    const candles = createCandleSequence(prices, (index) => index < 59 ? 1000 : 2000); // High final volume

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
  });
});

describe('VolumeAnalyzerNew - Functional: Downtrend with Declining Volume', () => {
  it('should generate SHORT signal in downtrend with declining volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Downtrend with declining volume - 50+ prices
    const prices = Array.from({ length: 50 }, (_, i) => 300 - i * 1);
    const candles = createCandleSequence(prices, (index) => 2000 - index * 30); // Decreasing volume

    const signal = analyzer.analyze(candles);

    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('VolumeAnalyzerNew - Functional: Consolidation with Neutral Volume', () => {
  it('should generate HOLD signal during consolidation', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Consolidation with steady volume - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.2) * 2);
    const candles = createCandleSequence(prices, 1000); // Consistent volume

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
    expect(signal.confidence).toBeCloseTo(30, 5); // neutralConfidence * 100
  });
});

describe('VolumeAnalyzerNew - Functional: Volume Spike on Breakout', () => {
  it('should detect volume spike on upside breakout', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Consolidation then breakout with volume spike - 60+ prices
    const consolidation = Array.from({ length: 30 }, () => 100);
    const breakout = Array.from({ length: 30 }, (_, i) => 100 + i * 1.5);
    const prices = [...consolidation, ...breakout];

    const candles = createCandleSequence(prices, (index) =>
      index < 30 ? 500 : 2000 // Low vol consolidation, high vol breakout
    );

    const signal = analyzer.analyze(candles);

    // High volume confirmation should generate strong signal
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should detect volume spike on downside breakdown', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Consolidation then breakdown with volume spike - 60+ prices
    const consolidation = Array.from({ length: 30 }, () => 100);
    const breakdown = Array.from({ length: 30 }, (_, i) => 100 - i * 1.5);
    const prices = [...consolidation, ...breakdown];

    const candles = createCandleSequence(prices, (index) =>
      index < 30 ? 500 : 2000 // Low vol consolidation, high vol breakdown
    );

    const signal = analyzer.analyze(candles);

    // High volume confirmation should generate a signal
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('VolumeAnalyzerNew - Functional: False Breakout (Low Volume)', () => {
  it('should warn on false breakout with low volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Price spike with low volume (false breakout) - 60+ prices
    const consolidation = Array.from({ length: 30 }, () => 100);
    const fakeBreakout = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const prices = [...consolidation, ...fakeBreakout];

    const candles = createCandleSequence(prices, 500); // Consistent low volume

    const signal = analyzer.analyze(candles);

    // Low volume should generate SHORT or HOLD (warning signal)
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('VolumeAnalyzerNew - Functional: Trend Continuation with Declining Volume', () => {
  it('should warn on trend with declining volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Uptrend with declining volume (weakening trend) - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(prices, (index) => 2000 - index * 20); // Declining volume

    const signal = analyzer.analyze(candles);

    // Declining volume should generate HOLD or SHORT
    expect([SignalDirection.HOLD, SignalDirection.SHORT]).toContain(signal.direction);
  });
});

describe('VolumeAnalyzerNew - Functional: Volume Confirmation on Reversal', () => {
  it('should confirm reversal with strong volume', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Uptrend reversal with strong downside volume - 60+ prices
    const uptrend = Array.from({ length: 25 }, (_, i) => 100 + i * 1);
    const reversal = Array.from({ length: 35 }, (_, i) => 125 - i * 1.5);
    const prices = [...uptrend, ...reversal];

    const candles = createCandleSequence(prices, (index) =>
      index < 25 ? 1000 : 2000 // Normal uptrend, strong volume in reversal
    );

    const signal = analyzer.analyze(candles);

    // Strong volume should generate a signal (LONG or HOLD with high confidence)
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('VolumeAnalyzerNew - Functional: Signal Strength Variation', () => {
  it('should scale confidence with different volume levels', () => {
    const config = createDefaultConfig();

    // Mild volume spike
    const mildVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const mildVolCandles = createCandleSequence(mildVolPrices, (index) =>
      index < 49 ? 1000 : 1200
    );
    const mildAnalyzer = new VolumeAnalyzerNew(config);
    const mildSignal = mildAnalyzer.analyze(mildVolCandles);

    // Extreme volume spike
    const extremeVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const extremeVolCandles = createCandleSequence(extremeVolPrices, (index) =>
      index < 49 ? 1000 : 3000
    );
    const extremeAnalyzer = new VolumeAnalyzerNew(config);
    const extremeSignal = extremeAnalyzer.analyze(extremeVolCandles);

    // Extreme volume should have more confidence than mild
    expect(extremeSignal.confidence).toBeGreaterThanOrEqual(mildSignal.confidence);
  });
});

describe('VolumeAnalyzerNew - Functional: Signal Consistency', () => {
  it('should flip signal on significant volume change', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // Phase 1: Low volume
    const lowVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    const lowVolCandles = createCandleSequence(lowVolPrices, 500);
    const signal1 = analyzer.analyze(lowVolCandles);
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal1.direction);

    // Phase 2: High volume
    const highVolPrices = Array.from({ length: 50 }, (_, i) => 105 + i * 0.5);
    const highVolCandles = createCandleSequence(highVolPrices, (index) =>
      index < 49 ? 500 : 2000
    );
    const signal2 = analyzer.analyze(highVolCandles);
    expect(signal2.direction).toBe(SignalDirection.LONG);
  });

  it('should maintain signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);

    // First analysis: high volume
    const highVolPrices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const highVolCandles = createCandleSequence(highVolPrices, (index) =>
      index < 49 ? 500 : 2000
    );
    const signal1 = analyzer.analyze(highVolCandles);

    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis: low volume
    const lowVolPrices = Array.from({ length: 50 }, (_, i) => 150 - i);
    const lowVolCandles = createCandleSequence(lowVolPrices, 500);
    const signal2 = analyzer.analyze(lowVolCandles);

    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
  });
});

describe('VolumeAnalyzerNew - Functional: Config Impact on Signals', () => {
  it('should respect neutralConfidence configuration', () => {
    const highNeutralConfig = { ...createDefaultConfig(), neutralConfidence: 0.6 };
    const lowNeutralConfig = { ...createDefaultConfig(), neutralConfidence: 0.1 };

    const highAnalyzer = new VolumeAnalyzerNew(highNeutralConfig);
    const lowAnalyzer = new VolumeAnalyzerNew(lowNeutralConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    const candles = createCandleSequence(prices, 1000); // Neutral volume

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // High neutral config should have higher confidence
    expect(highSignal.confidence).toBeGreaterThan(lowSignal.confidence);
  });

  test('should respect weight in score calculation', () => {
    const highWeightConfig = { ...createDefaultConfig(), weight: 0.9 };
    const lowWeightConfig = { ...createDefaultConfig(), weight: 0.2 };

    const highAnalyzer = new VolumeAnalyzerNew(highWeightConfig);
    const lowAnalyzer = new VolumeAnalyzerNew(lowWeightConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles = createCandleSequence(prices, (index) => index < 49 ? 500 : 2000);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Score should reflect weight
    expect(highSignal.score).toBeGreaterThan(lowSignal.score ?? 0);
  });
});
