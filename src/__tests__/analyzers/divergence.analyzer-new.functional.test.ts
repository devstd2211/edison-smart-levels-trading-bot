import { DivergenceAnalyzerNew } from '../../analyzers/divergence.analyzer-new';
import type { Candle } from '../../types/core';
import type { DivergenceAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): DivergenceAnalyzerConfigNew {
  return { enabled: true, weight: 0.8, priority: 7, maxConfidence: 0.95 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.5,
    high: close + 1.5,
    low: close - 1.5,
    close,
    volume: 1000,
  }));
}

describe('DivergenceAnalyzerNew - Functional: Downtrend', () => {
  it('should analyze sustained downtrend', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const downtrend = Array.from({ length: 50 }, (_, i) => 150 - i * 1.2);
    const candles = createCandles(downtrend);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze downtrend followed by bounce', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const down = Array.from({ length: 25 }, (_, i) => 150 - i * 1.5);
    const bounce = Array.from({ length: 25 }, (_, i) => 113 + i * 0.8);
    const prices = [...down, ...bounce];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Uptrend', () => {
  it('should analyze sustained uptrend', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const uptrend = Array.from({ length: 50 }, (_, i) => 100 + i * 1.2);
    const candles = createCandles(uptrend);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze uptrend followed by pullback', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const up = Array.from({ length: 25 }, (_, i) => 100 + i * 1.5);
    const pullback = Array.from({ length: 25 }, (_, i) => 137 - i * 0.8);
    const prices = [...up, ...pullback];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: V-Shape Recovery', () => {
  it('should analyze V-shaped recovery pattern', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const down = Array.from({ length: 20 }, (_, i) => 100 - i * 1.5);
    const up = Array.from({ length: 30 }, (_, i) => 70 + i * 1.2);
    const prices = [...down, ...up];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Inverted V-Shape', () => {
  it('should analyze inverted V-shaped pattern', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const up = Array.from({ length: 20 }, (_, i) => 100 + i * 1.5);
    const down = Array.from({ length: 30 }, (_, i) => 130 - i * 1.2);
    const prices = [...up, ...down];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Consolidation', () => {
  it('should analyze consolidation pattern', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 2);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Gap Patterns', () => {
  it('should handle gap up', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const gap = Array.from({ length: 1 }, () => 110);
    const post = Array.from({ length: 34 }, (_, i) => 110 + i * 0.3);
    const prices = [...pre, ...gap, ...post];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle gap down', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const gap = Array.from({ length: 1 }, () => 90);
    const post = Array.from({ length: 34 }, (_, i) => 90 - i * 0.3);
    const prices = [...pre, ...gap, ...post];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Extreme Moves', () => {
  it('should handle sharp upward move', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle sharp downward move', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const prices = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DivergenceAnalyzerNew - Functional: Multiple Reversals', () => {
  it('should analyze multiple direction changes', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const p1 = Array.from({ length: 12 }, (_, i) => 100 + i);
    const p2 = Array.from({ length: 12 }, (_, i) => 112 - i);
    const p3 = Array.from({ length: 13 }, (_, i) => 100 + i);
    const p4 = Array.from({ length: 13 }, (_, i) => 113 - i);
    const prices = [...p1, ...p2, ...p3, ...p4];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
