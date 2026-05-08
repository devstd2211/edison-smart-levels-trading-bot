import { LiquiditySweepAnalyzerNew } from '../../analyzers/liquidity-sweep.analyzer-new';
import type { Candle } from '../../types/core';
import type { LiquiditySweepAnalyzerConfigNew } from '../../types/config/config-new.types';

type ConfigInput = ConstructorParameters<typeof LiquiditySweepAnalyzerNew>[0];
type CandlesInput = Parameters<LiquiditySweepAnalyzerNew['analyze']>[0];
const asConfig = (value: unknown): ConfigInput => value as ConfigInput;
const asCandles = (value: unknown): CandlesInput => value as CandlesInput;

function createConfig(): LiquiditySweepAnalyzerConfigNew {
  return { enabled: true, weight: 0.65, priority: 6 };
}

function createCandlesWithWicks(closes: number[], lows?: number[], highs?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs ? highs[i] : close + 0.5,
    low: lows ? lows[i] : close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('LiquiditySweepAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() } as Partial<ConfigInput>;
    delete config.enabled;
    expect(() => new LiquiditySweepAnalyzerNew(asConfig(config))).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new LiquiditySweepAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new LiquiditySweepAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('LiquiditySweepAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new LiquiditySweepAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(asCandles(null))).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i));
    (candles[15] as unknown as { high?: number }).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('LiquiditySweepAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('LIQUIDITY_SWEEP_ANALYZER_NEW');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.65);
  });

  test('should track last signal', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('LiquiditySweepAnalyzerNew - State Management Tests', () => {
  test('should return state snapshot', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const state = analyzer.getStateSnapshot();

    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
    expect(state.lastSignal).toBeNull();
  });

  test('should return a cloned last signal in state snapshot', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    const state = analyzer.getStateSnapshot();

    expect(state.lastSignal).toEqual(signal);
    expect(state.lastSignal).not.toBe(signal);
  });

  test('should have null signal initially', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('LiquiditySweepAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new LiquiditySweepAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices', () => {
    const analyzer = new LiquiditySweepAnalyzerNew(createConfig());
    const candles = createCandlesWithWicks(Array.from({ length: 30 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

