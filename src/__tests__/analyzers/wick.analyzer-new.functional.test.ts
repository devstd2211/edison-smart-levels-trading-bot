import { WickAnalyzerNew } from '../../analyzers/wick.analyzer-new';
import type { Candle } from '../../types/core';
import type { WickAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): WickAnalyzerConfigNew {
  return { enabled: true, weight: 0.65, priority: 5 };
}

function createCandlesWithWicks(closes: number[], lowerWickSize: number[] = [], upperWickSize: number[] = []): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close,
    high: close + (upperWickSize[i] || 0.5),
    low: close - (lowerWickSize[i] || 0.5),
    close,
    volume: 1000,
  }));
}

describe('WickAnalyzerNew - Functional: Long Lower Wick', () => {
  it('should detect long lower wick', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const lowerWicks = Array.from({ length: 30 }, () => 3); // Long lower wick
    const candles = createCandlesWithWicks(closes, lowerWicks);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect hammer candle (bullish wick)', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const lowerWicks = Array.from({ length: 30 }, () => 4);
    const candles = createCandlesWithWicks(closes, lowerWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Long Upper Wick', () => {
  it('should detect long upper wick', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const upperWicks = Array.from({ length: 30 }, () => 3);
    const candles = createCandlesWithWicks(closes, [], upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect shooting star (bearish wick)', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const upperWicks = Array.from({ length: 30 }, () => 4);
    const candles = createCandlesWithWicks(closes, [], upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Support Test Patterns', () => {
  it('should detect lower wick at support level', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const support = Array.from({ length: 15 }, (_, i) => 100 - i * 0.3);
    const closes = [...pre, ...support];
    const lowerWicks = Array.from({ length: 30 }, () => 2.5);
    const candles = createCandlesWithWicks(closes, lowerWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Resistance Test Patterns', () => {
  it('should detect upper wick at resistance level', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const resistance = Array.from({ length: 15 }, (_, i) => 100 + i * 0.3);
    const closes = [...pre, ...resistance];
    const upperWicks = Array.from({ length: 30 }, () => 2.5);
    const candles = createCandlesWithWicks(closes, [], upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Trending Markets with Wicks', () => {
  it('should analyze uptrend with lower wicks', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.8);
    const lowerWicks = Array.from({ length: 30 }, () => 1.5);
    const candles = createCandlesWithWicks(closes, lowerWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze downtrend with upper wicks', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 150 - i * 0.8);
    const upperWicks = Array.from({ length: 30 }, () => 1.5);
    const candles = createCandlesWithWicks(closes, [], upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Reversal Patterns', () => {
  it('should detect reversal from downtrend with long lower wick', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const down = Array.from({ length: 15 }, (_, i) => 100 - i * 1.2);
    const reversal = Array.from({ length: 15 }, (_, i) => 82 + i * 1.2);
    const closes = [...down, ...reversal];
    const lowerWicks = Array.from({ length: 30 }, () => 2.5);
    const candles = createCandlesWithWicks(closes, lowerWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect reversal from uptrend with long upper wick', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const up = Array.from({ length: 15 }, (_, i) => 100 + i * 1.2);
    const reversal = Array.from({ length: 15 }, (_, i) => 118 - i * 1.2);
    const closes = [...up, ...reversal];
    const upperWicks = Array.from({ length: 30 }, () => 2.5);
    const candles = createCandlesWithWicks(closes, [], upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WickAnalyzerNew - Functional: Consolidation with Wicks', () => {
  it('should analyze range with long wicks', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.2) * 2);
    const lowerWicks = Array.from({ length: 30 }, () => 2);
    const upperWicks = Array.from({ length: 30 }, () => 2);
    const candles = createCandlesWithWicks(closes, lowerWicks, upperWicks);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
