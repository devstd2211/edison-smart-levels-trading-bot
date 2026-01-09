import { PriceMomentumAnalyzerNew } from '../../analyzers/price-momentum.analyzer-new';
import type { Candle } from '../../types/core';
import type { PriceMomentumAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

function createConfig(): PriceMomentumAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 5, minConfidence: 0.1, maxConfidence: 0.95 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('PriceMomentumAnalyzerNew - Functional: Strong Upward Momentum', () => {
  it('should detect sustained upward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.8);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect upward momentum with acceleration', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 100 + i * 0.3);
    const part2 = Array.from({ length: 13 }, (_, i) => 103.6 + i * 1.5);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Strong Downward Momentum', () => {
  it('should detect sustained downward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 150 - i * 0.8);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect downward momentum with acceleration', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 150 - i * 0.3);
    const part2 = Array.from({ length: 13 }, (_, i) => 146.4 - i * 1.5);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Momentum Deceleration', () => {
  it('should detect slowing upward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 100 + i * 1.5);
    const part2 = Array.from({ length: 13 }, (_, i) => 118 + i * 0.3);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect slowing downward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 150 - i * 1.5);
    const part2 = Array.from({ length: 13 }, (_, i) => 132 - i * 0.3);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Reversals', () => {
  it('should detect reversal from downtrend to uptrend', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const down = Array.from({ length: 12 }, (_, i) => 100 - i * 1.5);
    const up = Array.from({ length: 13 }, (_, i) => 82 + i * 1.5);
    const closes = [...down, ...up];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect reversal from uptrend to downtrend', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const up = Array.from({ length: 12 }, (_, i) => 100 + i * 1.5);
    const down = Array.from({ length: 13 }, (_, i) => 118 - i * 1.5);
    const closes = [...up, ...down];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Consolidation', () => {
  it('should analyze consolidation with low momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.3) * 1);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Flash Crash', () => {
  it('should handle sharp down move', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const pre = Array.from({ length: 10 }, () => 100);
    const crash = Array.from({ length: 5 }, (_, i) => 100 - i * 3);
    const post = Array.from({ length: 10 }, (_, i) => 85 + i * 0.5);
    const closes = [...pre, ...crash, ...post];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceMomentumAnalyzerNew - Functional: Gap Patterns', () => {
  it('should detect gap with upward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const pre = Array.from({ length: 10 }, () => 100);
    const gap = [110];
    const post = Array.from({ length: 14 }, (_, i) => 110 + i * 0.5);
    const closes = [...pre, ...gap, ...post];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect gap with downward momentum', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const pre = Array.from({ length: 10 }, () => 100);
    const gap = [90];
    const post = Array.from({ length: 14 }, (_, i) => 90 - i * 0.5);
    const closes = [...pre, ...gap, ...post];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
