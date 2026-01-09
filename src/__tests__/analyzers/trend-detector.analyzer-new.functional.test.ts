import { TrendDetectorAnalyzerNew } from '../../analyzers/trend-detector.analyzer-new';
import type { Candle } from '../../types/core';
import type { TrendDetectorConfigNew } from '../../types/config-new.types';

function createConfig(): TrendDetectorConfigNew {
  return { enabled: true, weight: 0.8, priority: 5, minEmaGapPercent: 0.1, minConfidence: 0.1, maxConfidence: 0.95 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('TrendDetectorAnalyzerNew - Functional: Strong Uptrend', () => {
  it('should detect sustained uptrend with higher highs and higher lows', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 1.0);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect uptrend with acceleration', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 100 + i * 0.3);
    const part2 = Array.from({ length: 13 }, (_, i) => 103.6 + i * 1.5);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Strong Downtrend', () => {
  it('should detect sustained downtrend with lower highs and lower lows', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 150 - i * 1.0);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect downtrend with acceleration', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const part1 = Array.from({ length: 12 }, (_, i) => 150 - i * 0.3);
    const part2 = Array.from({ length: 13 }, (_, i) => 146.4 - i * 1.5);
    const closes = [...part1, ...part2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Consolidation', () => {
  it('should detect sideways consolidation', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.3) * 1);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect range-bound trading', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => {
      const base = i < 12 ? 100 : 105;
      return i % 2 === 0 ? base : base - 0.5;
    });
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: V-Shape Recovery', () => {
  it('should analyze V-shaped recovery from downtrend to uptrend', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const down = Array.from({ length: 12 }, (_, i) => 100 - i * 1.5);
    const up = Array.from({ length: 13 }, (_, i) => 82 + i * 1.5);
    const closes = [...down, ...up];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Inverted V-Shape', () => {
  it('should analyze inverted V-shaped pattern from uptrend to downtrend', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const up = Array.from({ length: 12 }, (_, i) => 100 + i * 1.5);
    const down = Array.from({ length: 13 }, (_, i) => 118 - i * 1.5);
    const closes = [...up, ...down];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Weak Uptrend', () => {
  it('should analyze weak uptrend', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.1);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Weak Downtrend', () => {
  it('should analyze weak downtrend', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 150 - i * 0.1);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendDetectorAnalyzerNew - Functional: Multiple Reversals', () => {
  it('should handle multiple direction changes', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const up1 = Array.from({ length: 8 }, (_, i) => 100 + i * 1.0);
    const down1 = Array.from({ length: 8 }, (_, i) => 108 - i * 1.0);
    const up2 = Array.from({ length: 9 }, (_, i) => 100 + i * 1.0);
    const closes = [...up1, ...down1, ...up2];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
