import { LevelAnalyzerNew } from '../../analyzers/level.analyzer-new';
import type { Candle } from '../../types/core';
import type { LevelAnalyzerConfigNew } from '../../types/config/config-new.types';

type ConfigInput = ConstructorParameters<typeof LevelAnalyzerNew>[0];
type CandlesInput = Parameters<LevelAnalyzerNew['analyze']>[0];
const asConfig = (value: unknown): ConfigInput => value as ConfigInput;
const asCandles = (value: unknown): CandlesInput => value as CandlesInput;

function createConfig(): LevelAnalyzerConfigNew {
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

describe('LevelAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() } as Partial<ConfigInput>;
    delete config.enabled;
    expect(() => new LevelAnalyzerNew(asConfig(config))).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new LevelAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new LevelAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('LevelAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new LevelAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(asCandles(null))).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i));
    (candles[15] as unknown as { close?: number }).close = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('LevelAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('LEVEL_ANALYZER_NEW');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.7);
  });

  test('should track last signal', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('LevelAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state snapshot', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const state = analyzer.getStateSnapshot();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });

  test('should return a cloned last signal in state snapshot', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);

    const state = analyzer.getStateSnapshot();
    expect(state.lastSignal).not.toBeNull();
    expect(state.lastSignal).not.toBe(analyzer.getLastSignal());
  });
});

describe('LevelAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new LevelAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandles(Array.from({ length: 35 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new LevelAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 35 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

