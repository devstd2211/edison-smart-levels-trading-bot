import { LiquidityZoneAnalyzerNew } from '../../analyzers/liquidity-zone.analyzer-new';
import type { Candle } from '../../types/core';
import type { LiquidityZoneAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): LiquidityZoneAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 6 };
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

describe('LiquidityZoneAnalyzerNew - Configuration & Input Validation', () => {
  test('should create with valid config', () => {
    const analyzer = new LiquidityZoneAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on invalid config', () => {
    expect(() => new LiquidityZoneAnalyzerNew({ enabled: 'true' as any, weight: 0.7, priority: 6 })).toThrow();
  });

  test('should generate valid signal', () => {
    const analyzer = new LiquidityZoneAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
    expect(signal.score).toBe((signal.confidence / 100) * 0.7);
  });

  test('should track and reset signal', () => {
    const analyzer = new LiquidityZoneAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).not.toBeNull();
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('LiquidityZoneAnalyzerNew - Functional', () => {
  test('should analyze various market conditions', () => {
    const analyzer = new LiquidityZoneAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * 3));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
