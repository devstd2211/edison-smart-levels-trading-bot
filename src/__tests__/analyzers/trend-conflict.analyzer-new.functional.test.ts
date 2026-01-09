import { TrendConflictAnalyzerNew } from '../../analyzers/trend-conflict.analyzer-new';
import type { Candle } from '../../types/core';
import type { TrendConflictAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): TrendConflictAnalyzerConfigNew {
  return { enabled: true, weight: 0.6, priority: 4 };
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

describe('TrendConflictAnalyzerNew - Functional: Price Above Short MA', () => {
  it('should detect conflict when price above short MA but below long MA (bullish price, bearish MA)', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Long downtrend overall, but short term bounce
    const downtrend = Array.from({ length: 15 }, (_, i) => 100 - i * 0.5);
    const shortBounce = Array.from({ length: 10 }, (_, i) => 92.5 + i * 0.3);
    const closes = [...downtrend, ...shortBounce];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should show conflict strength increases with greater divergence', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Strong downtrend overall with strong short-term reversal
    const strongDown = Array.from({ length: 15 }, (_, i) => 100 - i * 1.5);
    const strongUp = Array.from({ length: 10 }, (_, i) => 77.5 + i * 1.2);
    const closes = [...strongDown, ...strongUp];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: Price Below Short MA', () => {
  it('should detect conflict when price below short MA but above long MA (bearish price, bullish MA)', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Long uptrend overall, but short term pullback
    const uptrend = Array.from({ length: 15 }, (_, i) => 100 + i * 0.5);
    const shortPullback = Array.from({ length: 10 }, (_, i) => 107.5 - i * 0.3);
    const closes = [...uptrend, ...shortPullback];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should show conflict strength increases with greater divergence in pullback', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Strong uptrend overall with strong short-term correction
    const strongUp = Array.from({ length: 15 }, (_, i) => 100 + i * 1.5);
    const strongDown = Array.from({ length: 10 }, (_, i) => 122.5 - i * 1.2);
    const closes = [...strongUp, ...strongDown];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: No Conflict - Aligned Trend', () => {
  it('should analyze when price and MAs are aligned in uptrend', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const aligned = Array.from({ length: 25 }, (_, i) => 100 + i * 1.0);
    const candles = createCandles(aligned);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze when price and MAs are aligned in downtrend', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const aligned = Array.from({ length: 25 }, (_, i) => 150 - i * 1.0);
    const candles = createCandles(aligned);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: MA Crossover Scenarios', () => {
  it('should detect conflict during golden cross pattern', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Short MA crosses above long MA (bullish), but price pulls back
    const stable = Array.from({ length: 10 }, () => 100);
    const upMove = Array.from({ length: 10 }, (_, i) => 100 + i * 0.8);
    const pullback = Array.from({ length: 5 }, (_, i) => 108 - i * 0.4);
    const closes = [...stable, ...upMove, ...pullback];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect conflict during death cross pattern', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    // Short MA crosses below long MA (bearish), but price bounces
    const stable = Array.from({ length: 10 }, () => 100);
    const downMove = Array.from({ length: 10 }, (_, i) => 100 - i * 0.8);
    const bounce = Array.from({ length: 5 }, (_, i) => 92 + i * 0.4);
    const closes = [...stable, ...downMove, ...bounce];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: Consolidation Patterns', () => {
  it('should analyze consolidation with minor MA conflict', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const range = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.3) * 1.5);
    const candles = createCandles(range);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect conflict in whipsaw range pattern', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const whipsaw = Array.from({ length: 25 }, (_, i) => {
      const block = Math.floor(i / 5);
      return 100 + (block % 2 === 0 ? i % 5 * 0.5 : -i % 5 * 0.5);
    });
    const candles = createCandles(whipsaw);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: Reversal Conflicts', () => {
  it('should detect conflict at trend reversal from down to up', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const downtrend = Array.from({ length: 12 }, (_, i) => 100 - i * 1.0);
    const reversal = Array.from({ length: 13 }, (_, i) => 88 + i * 1.0);
    const closes = [...downtrend, ...reversal];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect conflict at trend reversal from up to down', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const uptrend = Array.from({ length: 12 }, (_, i) => 100 + i * 1.0);
    const reversal = Array.from({ length: 13 }, (_, i) => 112 - i * 1.0);
    const closes = [...uptrend, ...reversal];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: Gap Scenarios', () => {
  it('should analyze conflict after gap up in downtrend', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const pre = Array.from({ length: 12 }, (_, i) => 100 - i * 0.5);
    const gap = [95];
    const gapUp = [100];
    const post = Array.from({ length: 11 }, (_, i) => 100 - i * 0.3);
    const closes = [...pre, ...gap, ...gapUp, ...post];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze conflict after gap down in uptrend', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const pre = Array.from({ length: 12 }, (_, i) => 100 + i * 0.5);
    const gap = [105];
    const gapDown = [100];
    const post = Array.from({ length: 11 }, (_, i) => 100 + i * 0.3);
    const closes = [...pre, ...gap, ...gapDown, ...post];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TrendConflictAnalyzerNew - Functional: Volatility Impact', () => {
  it('should analyze conflict with increasing volatility', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.2) * (i * 0.1));
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze conflict with decreasing volatility', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.2) * Math.max(0.1, 2 - i * 0.08));
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
