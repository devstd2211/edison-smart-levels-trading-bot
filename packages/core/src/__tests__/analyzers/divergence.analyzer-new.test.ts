import { DivergenceAnalyzerNew } from '../../analyzers/divergence.analyzer-new';
import type { Candle } from '../../types/core';
import type { DivergenceAnalyzerConfigNew } from '../../types/config/config-new.types';
import { SignalDirection } from '../../types/enums';

type ConfigInput = ConstructorParameters<typeof DivergenceAnalyzerNew>[0];
type CandlesInput = Parameters<DivergenceAnalyzerNew['analyze']>[0];
const asConfig = (value: unknown): ConfigInput => value as ConfigInput;
const asCandles = (value: unknown): CandlesInput => value as CandlesInput;

function createConfig(): DivergenceAnalyzerConfigNew {
  return { enabled: true, weight: 0.8, priority: 7, maxConfidence: 0.95 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.5,
    high: close + 1.5,
    low: close - 1.5,
    close,
    volume: 1000,
  }));
}

describe('DivergenceAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() } as Partial<ConfigInput>;
    delete config.enabled;
    expect(() => new DivergenceAnalyzerNew(asConfig(config))).toThrow();
  });

  test('should throw on invalid weight', () => {
    const config = { ...createConfig(), weight: 1.5 };
    expect(() => new DivergenceAnalyzerNew(config)).toThrow();
  });

  test('should throw on invalid priority', () => {
    const config = { ...createConfig(), priority: 0 };
    expect(() => new DivergenceAnalyzerNew(config)).toThrow();
  });

  test('should throw on invalid maxConfidence', () => {
    const config = { ...createConfig(), maxConfidence: 1.5 };
    expect(() => new DivergenceAnalyzerNew(config)).toThrow();
  });
});

describe('DivergenceAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const config = { ...createConfig(), enabled: false };
    const analyzer = new DivergenceAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candles input', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(asCandles(null))).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle data', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    (candles[25] as unknown as { high?: number }).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('DivergenceAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('DIVERGENCE_ANALYZER_NEW');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
    expect(signal.weight).toBe(0.8);
  });

  test('should calculate score correctly', () => {
    const config = { ...createConfig(), weight: 0.6 };
    const analyzer = new DivergenceAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * 0.6, 1);
  });

  test('should track last signal', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('DivergenceAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset state', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return config in state', () => {
    const config = createConfig();
    const analyzer = new DivergenceAnalyzerNew(config);
    const state = analyzer.getStateSnapshot();
    expect(state.config.maxConfidence).toBe(0.95);
    expect(state.config.weight).toBe(0.8);
  });

  test('should return last signal snapshots instead of live references', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const signal = analyzer.analyze(createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5)));

    const state = analyzer.getStateSnapshot();

    expect(state.lastSignal).toEqual(signal);
    expect(state.lastSignal).not.toBe(signal);
  });
});

describe('DivergenceAnalyzerNew - Edge Cases Tests', () => {
  test('should handle flat prices', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should handle zero weight', () => {
    const config = { ...createConfig(), weight: 0 };
    const analyzer = new DivergenceAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle large price moves', () => {
    const analyzer = new DivergenceAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 10));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

