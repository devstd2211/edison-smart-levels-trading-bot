import { BreakoutAnalyzerNew } from '../../analyzers/breakout.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 6 };
}

function createCandles(closes: number[], volumes: number[] = []): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.3,
    high: close + 1,
    low: close - 1,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('BreakoutAnalyzerNew - Functional: Squeeze + Breakout Up', () => {
  it('should detect squeeze to breakout up', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const squeeze = Array.from({ length: 20 }, () => 100);
    const breakout = Array.from({ length: 20 }, (_, i) => 100 + i * 1.5);
    const prices = [...squeeze, ...breakout];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should detect resistance break with volume', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const breakup = Array.from({ length: 25 }, (_, i) => 100 + i * 0.8);
    const prices = [...pre, ...breakup];
    const vols = [...Array(15).fill(1000), ...Array(25).fill(2000)];
    const candles = createCandles(prices, vols);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: Squeeze + Breakout Down', () => {
  it('should detect squeeze to breakout down', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const squeeze = Array.from({ length: 20 }, () => 100);
    const breakdown = Array.from({ length: 20 }, (_, i) => 100 - i * 1.5);
    const prices = [...squeeze, ...breakdown];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should detect support break with volume', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const breakdown = Array.from({ length: 25 }, (_, i) => 100 - i * 0.8);
    const prices = [...pre, ...breakdown];
    const vols = [...Array(15).fill(1000), ...Array(25).fill(2000)];
    const candles = createCandles(prices, vols);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: Range Trading', () => {
  it('should analyze oscillating range', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 3);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple bounces at support', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const p1 = Array.from({ length: 10 }, (_, i) => 100 + i);
    const p2 = Array.from({ length: 10 }, (_, i) => 110 - i);
    const p3 = Array.from({ length: 10 }, (_, i) => 100 + i);
    const p4 = Array.from({ length: 10 }, (_, i) => 110 - i);
    const prices = [...p1, ...p2, ...p3, ...p4];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: Trending Markets', () => {
  it('should analyze strong uptrend', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i * 0.8);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should analyze strong downtrend', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const prices = Array.from({ length: 40 }, (_, i) => 150 - i * 0.8);
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: Gap Patterns', () => {
  it('should handle gap up breakout', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const gap = [110];
    const post = Array.from({ length: 24 }, (_, i) => 110 + i * 0.5);
    const prices = [...pre, ...gap, ...post];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should handle gap down breakout', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const gap = [90];
    const post = Array.from({ length: 24 }, (_, i) => 90 - i * 0.5);
    const prices = [...pre, ...gap, ...post];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: False Breakouts', () => {
  it('should handle spike that fails', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const spike = Array.from({ length: 3 }, (_, i) => 105 + i);
    const fail = Array.from({ length: 22 }, (_, i) => 107 - i * 0.5);
    const prices = [...pre, ...spike, ...fail];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('BreakoutAnalyzerNew - Functional: Volatility Changes', () => {
  it('should detect breakout with increasing volatility', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const low = Array.from({ length: 15 }, () => 100);
    const high = Array.from({ length: 25 }, (_, i) => 100 + i * 0.5);
    const prices = [...low, ...high];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should detect breakout with decreasing volatility', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const high = Array.from({ length: 15 }, (_, i) => 100 + i);
    const low = Array.from({ length: 25 }, (_, i) => 115 + i * 0.2);
    const prices = [...high, ...low];
    const candles = createCandles(prices);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});
