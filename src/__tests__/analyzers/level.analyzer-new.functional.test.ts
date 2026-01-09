import { LevelAnalyzerNew } from '../../analyzers/level.analyzer-new';
import type { Candle } from '../../types/core';
import type { LevelAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): LevelAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 5 };
}

function createCandlesWithLevels(
  closes: number[],
  lows: number[] = [],
  highs: number[] = [],
): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs[i] ?? close + 0.5,
    low: lows[i] ?? close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('LevelAnalyzerNew - Functional: Price Near Support', () => {
  it('should detect price near support level', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const stable = Array.from({ length: 20 }, () => 100);
    const decline = Array.from({ length: 15 }, (_, i) => 100 - i * 0.2);
    const closes = [...stable, ...decline];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect bounce from support', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const down = Array.from({ length: 15 }, (_, i) => 100 - i * 0.3);
    const bounce = Array.from({ length: 20 }, (_, i) => 95.5 + i * 0.2);
    const closes = [...down, ...bounce];
    const lows = closes.map(c => c - 0.5);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Price Near Resistance', () => {
  it('should detect price near resistance level', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const stable = Array.from({ length: 20 }, () => 100);
    const rise = Array.from({ length: 15 }, (_, i) => 100 + i * 0.2);
    const closes = [...stable, ...rise];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect rejection from resistance', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const up = Array.from({ length: 15 }, (_, i) => 100 + i * 0.3);
    const rejection = Array.from({ length: 20 }, (_, i) => 104.5 - i * 0.2);
    const closes = [...up, ...rejection];
    const highs = closes.map(c => c + 0.5);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Support/Resistance Range', () => {
  it('should analyze range bound in middle between support and resistance', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const range = Array.from({ length: 35 }, (_, i) => 100 + Math.sin(i * 0.2) * 3);
    const lows = range.map(c => c - 3.5);
    const highs = range.map(c => c + 3.5);
    const candles = createCandlesWithLevels(range, lows, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect pullback to midpoint of range', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const breakup = Array.from({ length: 15 }, (_, i) => 100 + i * 0.8);
    const pullback = Array.from({ length: 20 }, (_, i) => 112 - i * 0.4);
    const closes = [...breakup, ...pullback];
    const lows = closes.map(c => c - 1);
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, lows, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Historical High/Low Levels', () => {
  it('should detect price testing historical high', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const trend = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const recent = Array.from({ length: 5 }, () => 114.5);
    const closes = [...trend, ...recent];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect price testing historical low', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const trend = Array.from({ length: 30 }, (_, i) => 100 - i * 0.5);
    const recent = Array.from({ length: 5 }, () => 85.5);
    const closes = [...trend, ...recent];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Level Breakouts', () => {
  it('should analyze breakout above resistance level', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.4) * 2);
    const breakout = Array.from({ length: 20 }, (_, i) => 102 + i * 0.3);
    const closes = [...range, ...breakout];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze breakdown below support level', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.4) * 2);
    const breakdown = Array.from({ length: 20 }, (_, i) => 98 - i * 0.3);
    const closes = [...range, ...breakdown];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Multi-Level Analysis', () => {
  it('should analyze price between multiple support/resistance levels', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const stage1 = Array.from({ length: 10 }, (_, i) => 100 + i * 0.5);
    const pullback = Array.from({ length: 8 }, (_, i) => 105 - i * 0.3);
    const stage2 = Array.from({ length: 10 }, (_, i) => 102.6 + i * 0.4);
    const pullback2 = Array.from({ length: 7 }, (_, i) => 106.6 - i * 0.2);
    const closes = [...stage1, ...pullback, ...stage2, ...pullback2];
    const lows = closes.map(c => c - 1);
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, lows, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LevelAnalyzerNew - Functional: Gap at Levels', () => {
  it('should handle gap above resistance', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, () => 100);
    const gap = [110];
    const post = Array.from({ length: 19 }, (_, i) => 110 + i * 0.1);
    const closes = [...range, ...gap, ...post];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle gap below support', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, () => 100);
    const gap = [90];
    const post = Array.from({ length: 19 }, (_, i) => 90 - i * 0.1);
    const closes = [...range, ...gap, ...post];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
