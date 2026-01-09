import { LiquiditySweepAnalyzerNew } from '../../analyzers/liquidity-sweep.analyzer-new';
import type { Candle } from '../../types/core';
import type { LiquiditySweepAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): LiquiditySweepAnalyzerConfigNew {
  return { enabled: true, weight: 0.65, priority: 6 };
}

function createCandlesWithWicks(closes: number[], lows?: number[], highs?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs ? highs[i] : close + 0.5,
    low: lows ? lows[i] : close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('LiquiditySweepAnalyzerNew - Functional: Bullish Sweep', () => {
  it('should detect sweep below previous lows with close above low', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const range = Array.from({ length: 24 }, (_, i) => 100 + Math.sin(i * 0.3) * 2);
    const sweep = [98]; // Below previous lows
    const closes = [...range, ...sweep];
    const lows = closes.map((c, i) => c - (i === closes.length - 1 ? 2 : 0.5));
    const candles = createCandlesWithWicks(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LiquiditySweepAnalyzerNew - Functional: Bearish Sweep', () => {
  it('should detect sweep above previous highs with close below high', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const range = Array.from({ length: 24 }, (_, i) => 100 + Math.sin(i * 0.3) * 2);
    const sweep = [105]; // Above previous highs
    const closes = [...range, ...sweep];
    const highs = closes.map((c, i) => c + (i === closes.length - 1 ? 2 : 0.5));
    const candles = createCandlesWithWicks(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LiquiditySweepAnalyzerNew - Functional: Liquidity Levels', () => {
  it('should analyze sweep at support liquidity', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const stable = Array.from({ length: 15 }, () => 100);
    const sweep = [98.5];
    const recovery = Array.from({ length: 9 }, (_, i) => 98.5 + i * 0.2);
    const closes = [...stable, ...sweep, ...recovery];
    const lows = closes.map(c => c - 1.5);
    const candles = createCandlesWithWicks(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LiquiditySweepAnalyzerNew - Functional: Uptrend Sweeps', () => {
  it('should detect sweep during uptrend', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const uptrend = Array.from({ length: 23 }, (_, i) => 100 + i * 0.4);
    const pullback = [108, 108.5]; // Sweep low then bounce
    const closes = [...uptrend, ...pullback];
    const lows = closes.map(c => c - 0.8);
    const candles = createCandlesWithWicks(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LiquiditySweepAnalyzerNew - Functional: Downtrend Sweeps', () => {
  it('should detect sweep during downtrend', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const downtrend = Array.from({ length: 23 }, (_, i) => 100 - i * 0.4);
    const relief = [92, 91.5]; // Sweep high then fall
    const closes = [...downtrend, ...relief];
    const highs = closes.map(c => c + 0.8);
    const candles = createCandlesWithWicks(closes, undefined, highs);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('LiquiditySweepAnalyzerNew - Functional: Reversal Patterns', () => {
  it('should detect sweep leading to reversal', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const down = Array.from({ length: 10 }, (_, i) => 100 - i * 0.5);
    const sweep = [95];
    const reversal = Array.from({ length: 14 }, (_, i) => 95 + i * 0.3);
    const closes = [...down, ...sweep, ...reversal];
    const lows = closes.map(c => c - 1);
    const candles = createCandlesWithWicks(closes, lows);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
