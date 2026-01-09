import { PriceMomentumAnalyzerNew } from '../../analyzers/price-momentum.analyzer-new';
import type { Candle } from '../../types/core';
import type { PriceMomentumAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

function createConfig(): PriceMomentumAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 5, minConfidence: 0.1, maxConfidence: 0.95 };
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

describe('PriceMomentumAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new PriceMomentumAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new PriceMomentumAnalyzerNew({ ...createConfig(), weight: 1.1 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new PriceMomentumAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('PriceMomentumAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new PriceMomentumAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    (candles[10] as any).close = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('PriceMomentumAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('PRICE_MOMENTUM_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should track last signal', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('PriceMomentumAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('PriceMomentumAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new PriceMomentumAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new PriceMomentumAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
