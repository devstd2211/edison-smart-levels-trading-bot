import { ChochBosAnalyzerNew } from '../../analyzers/choch-bos.analyzer-new';
import type { Candle } from '../../types/core';
import type { ChochBosAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): ChochBosAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 5 };
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

describe('ChochBosAnalyzerNew - Functional: Bullish BOS (Lower Low Break)', () => {
  it('should detect bullish BOS when price breaks below previous lows', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const down = Array.from({ length: 10 }, (_, i) => 100 - i * 0.8);
    const breakBelow = Array.from({ length: 10 }, (_, i) => 92 - i * 0.5);
    const closes = [...pre, ...down, ...breakBelow];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: Bearish BOS (Higher High Break)', () => {
  it('should detect bearish BOS when price breaks above previous highs', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const pre = Array.from({ length: 15 }, () => 100);
    const up = Array.from({ length: 10 }, (_, i) => 100 + i * 0.8);
    const breakAbove = Array.from({ length: 10 }, (_, i) => 108 + i * 0.5);
    const closes = [...pre, ...up, ...breakAbove];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: Range Break Patterns', () => {
  it('should detect break above consolidation high', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.3) * 1);
    const breakout = Array.from({ length: 20 }, (_, i) => 101 + i * 0.3);
    const closes = [...range, ...breakout];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect break below consolidation low', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.3) * 1);
    const breakdown = Array.from({ length: 20 }, (_, i) => 99 - i * 0.3);
    const closes = [...range, ...breakdown];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: False Breaks', () => {
  it('should handle failed attempt to break above resistance', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, () => 100);
    const spike = Array.from({ length: 8 }, (_, i) => 100 + i * 0.5);
    const rejectBack = Array.from({ length: 12 }, (_, i) => 104 - i * 0.5);
    const closes = [...range, ...spike, ...rejectBack];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle failed attempt to break below support', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, () => 100);
    const spike = Array.from({ length: 8 }, (_, i) => 100 - i * 0.5);
    const rejectBack = Array.from({ length: 12 }, (_, i) => 96 + i * 0.5);
    const closes = [...range, ...spike, ...rejectBack];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: Support/Resistance Levels', () => {
  it('should detect BOS at major support level', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const stable = Array.from({ length: 20 }, () => 100);
    const breakdown = Array.from({ length: 15 }, (_, i) => 100 - i * 0.3);
    const closes = [...stable, ...breakdown];
    const lows = closes.map(c => c - 0.5);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect BOS at major resistance level', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const stable = Array.from({ length: 20 }, () => 100);
    const breakup = Array.from({ length: 15 }, (_, i) => 100 + i * 0.3);
    const closes = [...stable, ...breakup];
    const highs = closes.map(c => c + 0.5);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: Trend Continuation', () => {
  it('should detect BOS during uptrend continuation', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const uptrend1 = Array.from({ length: 12 }, (_, i) => 100 + i * 0.8);
    const pullback = Array.from({ length: 5 }, (_, i) => 109.6 - i * 0.5);
    const uptrend2 = Array.from({ length: 13 }, (_, i) => 107.1 + i * 0.7);
    const closes = [...uptrend1, ...pullback, ...uptrend2];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect BOS during downtrend continuation', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const downtrend1 = Array.from({ length: 12 }, (_, i) => 100 - i * 0.8);
    const bounce = Array.from({ length: 5 }, (_, i) => 90.4 + i * 0.5);
    const downtrend2 = Array.from({ length: 13 }, (_, i) => 92.9 - i * 0.7);
    const closes = [...downtrend1, ...bounce, ...downtrend2];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithLevels(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('ChochBosAnalyzerNew - Functional: Multiple Structure Breaks', () => {
  it('should analyze multiple breaks over time', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const range1 = Array.from({ length: 10 }, () => 100);
    const break1 = Array.from({ length: 8 }, (_, i) => 100 + i * 0.5);
    const range2 = Array.from({ length: 8 }, (_, i) => 104 + Math.sin(i * 0.4) * 0.5);
    const break2 = Array.from({ length: 9 }, (_, i) => 104.5 + i * 0.4);
    const closes = [...range1, ...break1, ...range2, ...break2];
    const highs = closes.map(c => c + 1);
    const candles = createCandlesWithLevels(closes, [], highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
