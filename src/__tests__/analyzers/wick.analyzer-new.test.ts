import { WickAnalyzerNew } from '../../analyzers/wick.analyzer-new';
import type { Candle } from '../../types/core';
import type { WickAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): WickAnalyzerConfigNew {
  return { enabled: true, weight: 0.65, priority: 5 };
}

function createCandles(prices: number[]): Candle[] {
  return prices.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.2,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
  }));
}

describe('WickAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new WickAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new WickAnalyzerNew({ ...createConfig(), weight: 1.2 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new WickAnalyzerNew({ ...createConfig(), priority: 0 })).toThrow();
  });
});

describe('WickAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new WickAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    (candles[15] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('WickAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('WICK_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should track last signal', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('WickAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('WickAnalyzerNew - Edge Cases Tests', () => {
  test('should handle no wick candles', () => {
    const analyzer = new WickAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 30 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should handle zero weight', () => {
    const analyzer = new WickAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });
});
