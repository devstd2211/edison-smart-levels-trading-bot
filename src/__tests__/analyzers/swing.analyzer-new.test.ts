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

describe('SwingAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new SwingAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new SwingAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new SwingAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('SwingAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new SwingAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    (candles[10] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('SwingAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('SWING_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.7);
  });

  test('should track last signal', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('SwingAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const state = analyzer.getState();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });
});

describe('SwingAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new SwingAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new SwingAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
