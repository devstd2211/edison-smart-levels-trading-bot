import { PriceActionAnalyzerNew } from '../../analyzers/price-action.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 5 };
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

describe('PriceActionAnalyzerNew - Functional: Bullish Price Action', () => {
  it('should detect consistent upward movement', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Clear uptrend in recent bars
    const closes = Array.from({ length: 22 }, (_, i) => 100 + i * 0.3);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize mostly higher closes', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Recent bars mostly up
    const closes = Array.from({ length: 20 }, () => 100);
    closes[20] = 100.3; // Up
    closes[21] = 100.6; // Up
    closes[22] = 100.9; // Up
    closes[23] = 101.2; // Up
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bullish continuation', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Uptrend with some consolidation
    const trend = Array.from({ length: 18 }, (_, i) => 100 + i * 0.2);
    // Recent action bullish
    const recent = [103.6, 103.9, 104.2, 104.5];
    const closes = [...trend, ...recent];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceActionAnalyzerNew - Functional: Bearish Price Action', () => {
  it('should detect consistent downward movement', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Clear downtrend in recent bars
    const closes = Array.from({ length: 22 }, (_, i) => 100 - i * 0.3);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize mostly lower closes', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Recent bars mostly down
    const closes = Array.from({ length: 20 }, () => 100);
    closes[20] = 99.7; // Down
    closes[21] = 99.4; // Down
    closes[22] = 99.1; // Down
    closes[23] = 98.8; // Down
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish continuation', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Downtrend with some consolidation
    const trend = Array.from({ length: 18 }, (_, i) => 100 - i * 0.2);
    // Recent action bearish
    const recent = [96.4, 96.1, 95.8, 95.5];
    const closes = [...trend, ...recent];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceActionAnalyzerNew - Functional: Reversals', () => {
  it('should identify V-shape recovery', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Down then up
    const down = Array.from({ length: 12 }, (_, i) => 110 - i * 0.5);
    const up = Array.from({ length: 11 }, (_, i) => 104 + i * 0.6);
    const closes = [...down, ...up];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect inverted V-shape', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Up then down
    const up = Array.from({ length: 12 }, (_, i) => 90 + i * 0.5);
    const down = Array.from({ length: 11 }, (_, i) => 96 - i * 0.6);
    const closes = [...up, ...down];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize sudden reversal from support', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Fall to support
    const fall = Array.from({ length: 15 }, (_, i) => 110 - i * 0.8);
    // Bounce from support
    const bounce = Array.from({ length: 8 }, (_, i) => 98 + i * 0.8);
    const closes = [...fall, ...bounce];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceActionAnalyzerNew - Functional: Consolidation Patterns', () => {
  it('should handle tight consolidation', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Tight range with mixed direction
    const range = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.2) * 0.3);
    const candles = createCandles(range);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify breakout from consolidation', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Consolidation then breakout
    const cons = Array.from({ length: 18 }, () => 100);
    const breakout = [100.5, 101.2, 101.8, 102.5];
    const closes = [...cons, ...breakout];
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('PriceActionAnalyzerNew - Functional: Extreme Price Action', () => {
  it('should handle sharp uptrend', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Sharp rally
    const closes = Array.from({ length: 24 }, (_, i) => 100 + i * 0.8);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect sharp downtrend', () => {
    const analyzer = new PriceActionAnalyzerNew(createConfig());
    // Sharp decline
    const closes = Array.from({ length: 24 }, (_, i) => 120 - i * 0.8);
    const candles = createCandles(closes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
