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

describe('TrendConflictAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new TrendConflictAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new TrendConflictAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new TrendConflictAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('TrendConflictAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new TrendConflictAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    (candles[10] as any).close = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('TrendConflictAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('TREND_CONFLICT_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.6);
  });

  test('should track last signal', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('TrendConflictAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const state = analyzer.getState();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });
});

describe('TrendConflictAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new TrendConflictAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new TrendConflictAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
