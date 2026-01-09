import { ChochBosAnalyzerNew } from '../../analyzers/choch-bos.analyzer-new';
import type { Candle } from '../../types/core';
import type { ChochBosAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): ChochBosAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 5 };
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

describe('ChochBosAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new ChochBosAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new ChochBosAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new ChochBosAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('ChochBosAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new ChochBosAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i));
    (candles[15] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('ChochBosAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('CHOCH_BOS_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.75);
  });

  test('should track last signal', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('ChochBosAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const state = analyzer.getState();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });
});

describe('ChochBosAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new ChochBosAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new ChochBosAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
