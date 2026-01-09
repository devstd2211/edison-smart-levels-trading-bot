import { OrderBlockAnalyzerNew } from '../../analyzers/order-block.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 6 };
}

function createCandlesWithBodies(closes: number[], opens?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: opens ? opens[i] : close - 0.5,
    high: Math.max(close, opens ? opens[i] : close - 0.5) + 0.5,
    low: Math.min(close, opens ? opens[i] : close - 0.5) - 0.5,
    close,
    volume: 1000,
  }));
}

describe('OrderBlockAnalyzerNew - Functional: Bullish Order Block', () => {
  it('should detect bullish block after downtrend', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 20 }, () => 100);
    // Strong downtrend (large red candles - order block)
    const downCandles = Array.from({ length: 5 }, (_, i) => 100 - i * 1.5);
    const downOpens = downCandles.map((_, i) => 100 - i * 1.5 + 2); // Open above close for red candles
    // Recovery back to block level
    const recovery = Array.from({ length: 15 }, (_, i) => 92.5 + i * 0.6);
    const closes = [...initial, ...downCandles, ...recovery];
    const opens = [...Array(20).fill(100), ...downOpens, ...recovery];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize bullish block at support', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Price consolidates
    const initial = Array.from({ length: 18 }, () => 120);
    // Sharp drop with big red candles
    const drop = Array.from({ length: 4 }, (_, i) => 120 - i * 2);
    const dropOpens = drop.map((_, i) => 120 - i * 2 + 2.5);
    // Buyers step in, price recovers
    const recovery = Array.from({ length: 13 }, (_, i) => 112 + i * 0.8);
    const closes = [...initial, ...drop, ...recovery];
    const opens = [...Array(18).fill(120), ...dropOpens, ...recovery];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: Bearish Order Block', () => {
  it('should detect bearish block after uptrend', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 20 }, () => 100);
    // Strong uptrend (large green candles - order block)
    const upCandles = Array.from({ length: 5 }, (_, i) => 100 + i * 1.5);
    const upOpens = upCandles.map((_, i) => 100 + i * 1.5 - 2); // Open below close for green candles
    // Pullback from block level
    const pullback = Array.from({ length: 15 }, (_, i) => 107.5 - i * 0.6);
    const closes = [...initial, ...upCandles, ...pullback];
    const opens = [...Array(20).fill(100), ...upOpens, ...pullback];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish block at resistance', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Price consolidates
    const initial = Array.from({ length: 18 }, () => 80);
    // Sharp rally with big green candles
    const rally = Array.from({ length: 4 }, (_, i) => 80 + i * 2.5);
    const rallyOpens = rally.map((_, i) => 80 + i * 2.5 - 2);
    // Sellers step in, price pulls back
    const pullback = Array.from({ length: 13 }, (_, i) => 90 - i * 0.8);
    const closes = [...initial, ...rally, ...pullback];
    const opens = [...Array(18).fill(80), ...rallyOpens, ...pullback];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: Multiple Order Blocks', () => {
  it('should analyze consecutive order blocks', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // First block: downtrend
    const down1 = Array.from({ length: 5 }, (_, i) => 120 - i * 1);
    const down1Opens = down1.map((_, i) => 120 - i * 1 + 1.5);
    // Recovery
    const rec1 = Array.from({ length: 5 }, (_, i) => 115 + i * 0.4);
    // Second block: downtrend again
    const down2 = Array.from({ length: 5 }, (_, i) => 117 - i * 1);
    const down2Opens = down2.map((_, i) => 117 - i * 1 + 1.5);
    // Recovery
    const rec2 = Array.from({ length: 10 }, (_, i) => 112 + i * 0.3);
    const closes = [...down1, ...rec1, ...down2, ...rec2];
    const opens = [...down1Opens, ...rec1, ...down2Opens, ...rec2];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: V-Shape with Order Block', () => {
  it('should identify block during V-shaped recovery', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Initial uptrend
    const up = Array.from({ length: 10 }, (_, i) => 100 + i * 0.5);
    // Sharp drop with order block
    const drop = Array.from({ length: 5 }, (_, i) => 105 - i * 2);
    const dropOpens = drop.map((_, i) => 105 - i * 2 + 2);
    // V-recovery
    const recovery = Array.from({ length: 15 }, (_, i) => 95 + i * 0.7);
    const closes = [...up, ...drop, ...recovery];
    const opens = [...up, ...dropOpens, ...recovery];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify block during inverted V-shape', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Initial downtrend
    const down = Array.from({ length: 10 }, (_, i) => 120 - i * 0.5);
    // Sharp rally with order block
    const rally = Array.from({ length: 5 }, (_, i) => 115 + i * 2);
    const rallyOpens = rally.map((_, i) => 115 + i * 2 - 2);
    // Downmove
    const fall = Array.from({ length: 15 }, (_, i) => 125 - i * 0.7);
    const closes = [...down, ...rally, ...fall];
    const opens = [...down, ...rallyOpens, ...fall];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: Institutional Order Blocks', () => {
  it('should recognize block from institutional activity', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Quiet consolidation
    const quiet = Array.from({ length: 15 }, () => 100);
    // Sudden large candle down (institutional selling)
    const institutional = [95, 93, 91];
    const instOpens = [100.5, 96.5, 94.5];
    // Dip buyers enter, price recovers
    const dip = Array.from({ length: 17 }, (_, i) => 91 + i * 0.6);
    const closes = [...quiet, ...institutional, ...dip];
    const opens = [...Array(15).fill(100), ...instOpens, ...dip];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: False Breaks and Order Blocks', () => {
  it('should identify block at false breakout point', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Support level
    const support = Array.from({ length: 12 }, () => 100);
    // False break below with large candles
    const falsBreak = Array.from({ length: 5 }, (_, i) => 100 - i * 0.8);
    const falseOpens = falsBreak.map((_, i) => 100 - i * 0.8 + 1);
    // Quick recovery (trapped shorts covering)
    const recovery = Array.from({ length: 13 }, (_, i) => 96 + i * 0.5);
    const closes = [...support, ...falsBreak, ...recovery];
    const opens = [...Array(12).fill(100), ...falseOpens, ...recovery];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderBlockAnalyzerNew - Functional: Trend Continuation with Block', () => {
  it('should identify block during uptrend continuation', () => {
    const analyzer = new OrderBlockAnalyzerNew(createConfig());
    // Initial uptrend
    const trend = Array.from({ length: 10 }, (_, i) => 100 + i * 1);
    // Pullback creates order block (red candles)
    const pullback = Array.from({ length: 5 }, (_, i) => 110 - i * 0.6);
    const pullbackOpens = pullback.map((_, i) => 110 - i * 0.6 + 1);
    // Continuation uptrend
    const continuation = Array.from({ length: 15 }, (_, i) => 107 + i * 0.7);
    const closes = [...trend, ...pullback, ...continuation];
    const opens = [...trend, ...pullbackOpens, ...continuation];
    const candles = createCandlesWithBodies(closes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
