import { TrendDetectorAnalyzerNew } from '../../analyzers/trend-detector.analyzer-new';
import type { Candle } from '../../types/core';
import type { TrendDetectorConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

function createConfig(): TrendDetectorConfigNew {
  return { enabled: true, weight: 0.8, priority: 5, minEmaGapPercent: 0.1, minConfidence: 0.1, maxConfidence: 0.95 };
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

describe('TrendDetectorAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new TrendDetectorAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new TrendDetectorAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new TrendDetectorAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('TrendDetectorAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new TrendDetectorAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    (candles[10] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('TrendDetectorAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('TREND_DETECTOR');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.8);
  });

  test('should track last signal', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('TrendDetectorAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const state = analyzer.getState();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });
});

describe('TrendDetectorAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new TrendDetectorAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new TrendDetectorAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 25 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
