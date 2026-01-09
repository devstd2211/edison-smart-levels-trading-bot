import { SwingAnalyzerNew } from '../../analyzers/swing.analyzer-new';
import type { Candle } from '../../types/core';
import type { SwingAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): SwingAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 5 };
}

function createCandles(closes: number[], lows?: number[], highs?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs ? highs[i] : close + 0.5,
    low: lows ? lows[i] : close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('SwingAnalyzerNew - Functional: Swing High Detection', () => {
  it('should detect higher swing highs in uptrend', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.8);
    const highs = closes.map((c, i) => c + (i % 2 === 0 ? 1 : 0.3));
    const candles = createCandles(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect strong swing high peak', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const pre = Array.from({ length: 12 }, (_, i) => 100 + i * 0.5);
    const peak = Array.from({ length: 10 }, (_, i) => 106 + (i < 5 ? i * 0.3 : (9 - i) * 0.3));
    const post = Array.from({ length: 8 }, (_, i) => 107 - i * 0.4);
    const closes = [...pre, ...peak, ...post];
    const highs = closes.map((c, i) => c + (Math.floor(i / 5) % 2 === 0 ? 1 : 0.5));
    const candles = createCandles(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Swing Low Detection', () => {
  it('should detect lower swing lows in downtrend', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 150 - i * 0.8);
    const lows = closes.map((c, i) => c - (i % 2 === 0 ? 1 : 0.3));
    const candles = createCandles(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect strong swing low bottom', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const pre = Array.from({ length: 12 }, (_, i) => 150 - i * 0.5);
    const bottom = Array.from({ length: 10 }, (_, i) => 144 - (i < 5 ? i * 0.3 : (9 - i) * 0.3));
    const post = Array.from({ length: 8 }, (_, i) => 143 + i * 0.4);
    const closes = [...pre, ...bottom, ...post];
    const lows = closes.map((c, i) => c - (Math.floor(i / 5) % 2 === 0 ? 1 : 0.5));
    const candles = createCandles(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Swing Pattern Analysis', () => {
  it('should detect multiple swing highs in oscillating pattern', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.4) * 3);
    const highs = closes.map(c => c + 2);
    const lows = closes.map(c => c - 2);
    const candles = createCandles(closes, lows, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze symmetric swing pattern', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const up = Array.from({ length: 10 }, (_, i) => 100 + i * 0.8);
    const down = Array.from({ length: 10 }, (_, i) => 108 - i * 0.8);
    const stabilize = Array.from({ length: 10 }, () => 100);
    const closes = [...up, ...down, ...stabilize];
    const highs = closes.map((c, i) => c + (i < 10 ? 1 : i < 20 ? 0.5 : 1));
    const candles = createCandles(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Trending with Swings', () => {
  it('should detect swings in strong uptrend', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const swings = Array.from({ length: 30 }, (_, i) => {
      const trend = 100 + (i * 1.0);
      const swing = Math.sin(i * 0.5) * 2;
      return trend + swing;
    });
    const highs = swings.map((c, i) => c + (i % 3 === 0 ? 1.5 : 0.5));
    const candles = createCandles(swings, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect swings in strong downtrend', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const swings = Array.from({ length: 30 }, (_, i) => {
      const trend = 150 - (i * 1.0);
      const swing = Math.sin(i * 0.5) * 2;
      return trend + swing;
    });
    const lows = swings.map((c, i) => c - (i % 3 === 0 ? 1.5 : 0.5));
    const candles = createCandles(swings, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Reversal Swings', () => {
  it('should detect swing high followed by reversal', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const up = Array.from({ length: 12 }, (_, i) => 100 + i * 0.8);
    const peak = [110];
    const down = Array.from({ length: 12 }, (_, i) => 110 - i * 0.8);
    const closes = [...up, ...peak, ...down];
    const highs = closes.map((c, i) => c + 1);
    const candles = createCandles(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect swing low followed by reversal', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const down = Array.from({ length: 12 }, (_, i) => 150 - i * 0.8);
    const bottom = [130];
    const up = Array.from({ length: 12 }, (_, i) => 130 + i * 0.8);
    const closes = [...down, ...bottom, ...up];
    const lows = closes.map((c, i) => c - 1);
    const candles = createCandles(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Range-Bound Swings', () => {
  it('should detect swings within consolidation range', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + (i % 4 === 0 ? 2 : i % 4 === 2 ? -2 : 0));
    const highs = closes.map(c => c + 1);
    const lows = closes.map(c => c - 1);
    const candles = createCandles(closes, lows, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('SwingAnalyzerNew - Functional: Extreme Moves', () => {
  it('should handle sharp swing high spike', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const stable = Array.from({ length: 15 }, () => 100);
    const spike = Array.from({ length: 10 }, (_, i) => 100 + (i < 5 ? i * 2 : (9 - i) * 2));
    const resume = Array.from({ length: 5 }, () => 100);
    const closes = [...stable, ...spike, ...resume];
    const highs = closes.map((c, i) => c + (i >= 15 && i < 25 ? 2 : 0.5));
    const candles = createCandles(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle sharp swing low crash', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const stable = Array.from({ length: 15 }, () => 100);
    const crash = Array.from({ length: 10 }, (_, i) => 100 - (i < 5 ? i * 2 : (9 - i) * 2));
    const resume = Array.from({ length: 5 }, () => 100);
    const closes = [...stable, ...crash, ...resume];
    const lows = closes.map((c, i) => c - (i >= 15 && i < 25 ? 2 : 0.5));
    const candles = createCandles(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
