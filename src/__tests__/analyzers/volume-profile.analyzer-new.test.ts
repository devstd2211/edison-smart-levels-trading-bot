import { VolumeProfileAnalyzerNew } from '../../analyzers/volume-profile.analyzer-new';
import type { Candle } from '../../types/core';
import type { VolumeProfileAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): VolumeProfileAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 5 };
}

function createCandlesWithVolume(closes: number[], volumes: number[] = []): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: volumes[i] ?? 1000,
  }));
}

describe('VolumeProfileAnalyzerNew - Configuration Tests', () => {
  test('should create with valid config', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled', () => {
    const config = { ...createConfig() };
    delete (config as any).enabled;
    expect(() => new VolumeProfileAnalyzerNew(config as any)).toThrow();
  });

  test('should throw on invalid weight', () => {
    expect(() => new VolumeProfileAnalyzerNew({ ...createConfig(), weight: 1.5 })).toThrow();
  });

  test('should throw on invalid priority', () => {
    expect(() => new VolumeProfileAnalyzerNew({ ...createConfig(), priority: 15 })).toThrow();
  });
});

describe('VolumeProfileAnalyzerNew - Input Validation Tests', () => {
  test('should throw when disabled', () => {
    const analyzer = new VolumeProfileAnalyzerNew({ ...createConfig(), enabled: false });
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on null input', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    expect(() => analyzer.analyze(null as any)).toThrow();
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 15 }, (_, i) => 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow();
  });

  test('should throw on invalid candle', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i));
    (candles[10] as any).volume = undefined;
    expect(() => analyzer.analyze(candles)).toThrow();
  });
});

describe('VolumeProfileAnalyzerNew - Signal Generation Tests', () => {
  test('should generate signal', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.source).toBe('VOLUME_PROFILE_ANALYZER');
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should calculate score correctly', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe((signal.confidence / 100) * 0.75);
  });

  test('should track last signal', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });
});

describe('VolumeProfileAnalyzerNew - State Management Tests', () => {
  test('should have null signal initially', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should reset', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i * 0.5));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const state = analyzer.getState();
    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(false);
  });
});

describe('VolumeProfileAnalyzerNew - Edge Cases Tests', () => {
  test('should handle zero weight', () => {
    const analyzer = new VolumeProfileAnalyzerNew({ ...createConfig(), weight: 0 });
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, (_, i) => 100 + i));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices with normal volume', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const candles = createCandlesWithVolume(Array.from({ length: 25 }, () => 100));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
