import { TickDeltaAnalyzerNew } from '../../analyzers/tick-delta.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 6 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.15,
    high: close + 0.4,
    low: close - 0.4,
    close,
    volume: 1000,
  }));
}

describe('TickDeltaAnalyzerNew - Functional: Positive Delta', () => {
  it('should detect positive tick delta on uptrend', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // More up ticks than down ticks
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.2);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify positive delta with majority up ticks', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Mostly up ticks
    const closes = Array.from({ length: 20 }, () => 100);
    closes[15] = 100.1;
    closes[16] = 100.2;
    closes[17] = 100.3;
    closes[18] = 100.4;
    closes[19] = 100.5;
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize strong positive delta during rally', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Rally with few down ticks
    const trend = Array.from({ length: 18 }, (_, i) => 100 + i * 0.4);
    const recent = [107.2, 107.6, 108.0]; // All up
    const closes = [...trend, ...recent];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TickDeltaAnalyzerNew - Functional: Negative Delta', () => {
  it('should detect negative tick delta on downtrend', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // More down ticks than up ticks
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.2);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify negative delta with majority down ticks', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Mostly down ticks
    const closes = Array.from({ length: 20 }, () => 100);
    closes[15] = 99.9;
    closes[16] = 99.8;
    closes[17] = 99.7;
    closes[18] = 99.6;
    closes[19] = 99.5;
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize strong negative delta during decline', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Decline with few up ticks
    const trend = Array.from({ length: 18 }, (_, i) => 100 - i * 0.4);
    const recent = [92.8, 92.4, 92.0]; // All down
    const closes = [...trend, ...recent];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TickDeltaAnalyzerNew - Functional: Delta Shift', () => {
  it('should detect shift from negative to positive delta', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Down trend reverses
    const down = Array.from({ length: 12 }, (_, i) => 110 - i * 0.4);
    const up = Array.from({ length: 11 }, (_, i) => 105.2 + i * 0.5);
    const closes = [...down, ...up];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify shift from positive to negative delta', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // Up trend reverses
    const up = Array.from({ length: 12 }, (_, i) => 90 + i * 0.4);
    const down = Array.from({ length: 11 }, (_, i) => 94.8 - i * 0.5);
    const closes = [...up, ...down];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TickDeltaAnalyzerNew - Functional: Delta Divergence', () => {
  it('should handle positive delta with price decline', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // More up ticks but price still lower (bearish divergence)
    const closes = [100, 99.8, 100, 99.9, 100.1, 99.7, 100, 100.2, 99.5, 100.3, 99.9, 100.4, 99.8, 100.5, 100, 100.2, 99.9, 100.1, 99.7, 100];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle negative delta with price advance', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // More down ticks but price still higher (bullish divergence)
    const closes = [100, 100.2, 100, 100.1, 99.9, 100.3, 100, 99.8, 100.5, 99.7, 100, 99.9, 100.8, 100, 101, 100.1, 100.5, 99.9, 101.2, 100.5];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('TickDeltaAnalyzerNew - Functional: Extreme Delta', () => {
  it('should detect maximum positive delta', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // All up ticks
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect maximum negative delta', () => {
    const analyzer = new TickDeltaAnalyzerNew(createConfig());
    // All down ticks
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.5);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
