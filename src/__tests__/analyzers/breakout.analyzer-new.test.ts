import { BreakoutAnalyzerNew } from '../../analyzers/breakout.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 6 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.3,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe('BreakoutAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new BreakoutAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new BreakoutAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new BreakoutAnalyzerNew({ ...createConfig(), priority: 11 })).toThrow();
  });
});

describe('BreakoutAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new BreakoutAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    (candles[20] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('BreakoutAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('BREAKOUT_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.weight).toBe(0.75);
  });

  test('should calculate score', () => {
    const config = { ...createConfig(), weight: 0.5 };
    const analyzer = new BreakoutAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * 0.5, 1);
  });

  test('should track last signal', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('BreakoutAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const config = createConfig();
    const analyzer = new BreakoutAnalyzerNew(config);
    const state = analyzer.getState();
    expect(state.config.weight).toBe(0.75);
    expect(state.config.priority).toBe(6);
  });
});

describe('BreakoutAnalyzerNew - Edge Cases Tests', () => {
  test('should handle flat prices', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });

  test('should handle zero weight', () => {
    const analyzer = new BreakoutAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle large moves', () => {
    const analyzer = new BreakoutAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 3));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
  });
});
