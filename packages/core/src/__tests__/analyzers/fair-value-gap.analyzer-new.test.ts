import { FairValueGapAnalyzerNew } from '../../analyzers/fair-value-gap.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config/config-new.types';
import { AnalyzerType } from '../../types/analyzer';
import { SignalDirection } from '../../types/enums';

type CandlesInput = Parameters<FairValueGapAnalyzerNew['analyze']>[0];
const asCandles = (value: unknown): CandlesInput => value as CandlesInput;

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.7, priority: 6 };
}

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.5,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
  }));
}

describe('FairValueGapAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on invalid weight', () => {
    const config = { ...createConfig(), weight: 1.5 };
    expect(() => new FairValueGapAnalyzerNew(config)).toThrow();
  });

  test('should throw on invalid priority', () => {
    const config = { ...createConfig(), priority: 11 };
    expect(() => new FairValueGapAnalyzerNew(config)).toThrow();
  });
});

describe('FairValueGapAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const config = { ...createConfig(), enabled: false };
    const analyzer = new FairValueGapAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candles input', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(asCandles(null))).toThrow();
  });
});

describe('FairValueGapAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal with valid candles', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('FAIR_VALUE_GAP_ANALYZER_NEW');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
    expect(signal.weight).toBe(0.7);
  });

  test('should calculate score correctly', () => {
    const config = { ...createConfig(), weight: 0.5 };
    const analyzer = new FairValueGapAnalyzerNew(config);
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * 0.5, 1);
  });
});

describe('FairValueGapAnalyzerNew - State Management Tests', () => {
  test('should return state snapshot', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const state = analyzer.getStateSnapshot();

    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
    expect(state.lastSignal).toBeNull();
  });

  test('should return a cloned last signal in state snapshot', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    const state = analyzer.getStateSnapshot();

    expect(state.lastSignal).toEqual(signal);
    expect(state.lastSignal).not.toBe(signal);
  });

  test('should have null signal initially', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset state', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const candles = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('FairValueGapAnalyzerNew - IAnalyzer Interface Tests', () => {
  test('should implement getType()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getType()).toBe(AnalyzerType.FAIR_VALUE_GAP);
  });

  test('should implement isReady()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    const notReady = createCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const ready = createCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    expect(analyzer.isReady(notReady)).toBe(false);
    expect(analyzer.isReady(ready)).toBe(true);
  });

  test('should implement getMinCandlesRequired()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getMinCandlesRequired()).toBeGreaterThan(0);
  });

  test('should implement isEnabled()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should implement getWeight()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getWeight()).toBe(0.7);
  });

  test('should implement getPriority()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getPriority()).toBe(6);
  });

  test('should implement getMaxConfidence()', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    expect(analyzer.getMaxConfidence()).toBe(0.95);
  });
});


describe('FairValueGapAnalyzerNew - Three-candle gap definition', () => {
  // Gap is between candle 1 and candle 3; candle 2 is the impulse candle.
  function flatBase(count: number): Candle[] {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: i * 60000, open: 100, high: 100.5, low: 99.5, close: 100, volume: 1000,
    }));
  }

  test('detects bullish FVG when candle1.high < candle3.low', () => {
    const candles = [
      ...flatBase(25),
      { timestamp: 25 * 60000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
      { timestamp: 26 * 60000, open: 100.5, high: 104, low: 100.5, close: 103.5, volume: 1000 },
      { timestamp: 27 * 60000, open: 103.5, high: 105, low: 102, close: 104.5, volume: 1000 },
    ];
    const signal = new FairValueGapAnalyzerNew(createConfig()).analyze(candles);
    expect(signal.direction).toBe(SignalDirection.LONG);
  });

  test('detects bearish FVG when candle1.low > candle3.high', () => {
    const candles = [
      ...flatBase(25),
      { timestamp: 25 * 60000, open: 100, high: 101, low: 99, close: 99.5, volume: 1000 },
      { timestamp: 26 * 60000, open: 99.5, high: 99.5, low: 96, close: 96.5, volume: 1000 },
      { timestamp: 27 * 60000, open: 96.5, high: 98, low: 95, close: 95.5, volume: 1000 },
    ];
    const signal = new FairValueGapAnalyzerNew(createConfig()).analyze(candles);
    expect(signal.direction).toBe(SignalDirection.SHORT);
  });

  test('no FVG when candle3 overlaps candle1 even if candle2 gapped', () => {
    const candles = [
      ...flatBase(25),
      { timestamp: 25 * 60000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
      { timestamp: 26 * 60000, open: 101.5, high: 103, low: 101.5, close: 102, volume: 1000 },
      { timestamp: 27 * 60000, open: 102, high: 102.5, low: 100.5, close: 101, volume: 1000 },
    ];
    const signal = new FairValueGapAnalyzerNew(createConfig()).analyze(candles);
    expect(signal.direction).toBe(SignalDirection.HOLD);
  });
});
