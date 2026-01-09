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

describe('VolumeProfileAnalyzerNew - Functional: High Volume Up', () => {
  it('should detect high volume bullish candle', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const baseVol = Array.from({ length: 20 }, () => 1000);
    const upMove = Array.from({ length: 4 }, (_, i) => 100 + i * 0.5);
    const spike = [101]; // High volume spike up
    const closes = [...Array(20).fill(100), ...upMove, ...spike];
    const volumes = [...baseVol, 1000, 1000, 1000, 1000, 3000]; // High volume on last candle
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect sustained high volume uptrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.4);
    const volumes = Array.from({ length: 25 }, (_, i) => 1000 + (i > 20 ? 2000 : 0));
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: High Volume Down', () => {
  it('should detect high volume bearish candle', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const baseVol = Array.from({ length: 20 }, () => 1000);
    const downMove = Array.from({ length: 4 }, (_, i) => 100 - i * 0.5);
    const spike = [99]; // High volume spike down
    const closes = [...Array(20).fill(100), ...downMove, ...spike];
    const volumes = [...baseVol, 1000, 1000, 1000, 1000, 3000]; // High volume on last candle
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect sustained high volume downtrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 - i * 0.4);
    const volumes = Array.from({ length: 25 }, (_, i) => 1000 + (i > 20 ? 2000 : 0));
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Normal Volume Activity', () => {
  it('should analyze consistent normal volume uptrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.3);
    const volumes = Array.from({ length: 25 }, () => 1000); // Consistent normal volume
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should analyze consistent normal volume downtrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 - i * 0.3);
    const volumes = Array.from({ length: 25 }, () => 1000); // Consistent normal volume
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Volume Spikes at Key Levels', () => {
  it('should detect volume spike at support level', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const baseVol = Array.from({ length: 15 }, () => 1000);
    const decline = Array.from({ length: 9 }, (_, i) => 100 - i * 0.3);
    const support = [96.3];
    const closes = [...Array(15).fill(100), ...decline, ...support];
    const volumes = [...baseVol, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2500]; // Spike at support
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect volume spike at resistance level', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const baseVol = Array.from({ length: 15 }, () => 1000);
    const rise = Array.from({ length: 9 }, (_, i) => 100 + i * 0.3);
    const resistance = [102.7];
    const closes = [...Array(15).fill(100), ...rise, ...resistance];
    const volumes = [...baseVol, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2500]; // Spike at resistance
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Volume Confirmation', () => {
  it('should detect high volume on breakout up', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.4) * 1);
    const breakup = Array.from({ length: 9 }, (_, i) => 101 + i * 0.5);
    const closes = [...range, ...breakup];
    const volumes = Array.from({ length: 24 }, (_, i) => i >= 15 ? 2000 : 1000);
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect high volume on breakdown down', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const range = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i * 0.4) * 1);
    const breakdown = Array.from({ length: 9 }, (_, i) => 99 - i * 0.5);
    const closes = [...range, ...breakdown];
    const volumes = Array.from({ length: 24 }, (_, i) => i >= 15 ? 2000 : 1000);
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Volume Pattern Changes', () => {
  it('should handle increasing volume during uptrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.5);
    const volumes = Array.from({ length: 25 }, (_, i) => 1000 + i * 50); // Gradually increasing
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle decreasing volume during uptrend', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.5);
    const volumes = Array.from({ length: 25 }, (_, i) => 2000 - i * 50); // Gradually decreasing
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Volume on Reversals', () => {
  it('should detect high volume on reversal from down to up', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const down = Array.from({ length: 12 }, (_, i) => 100 - i * 0.5);
    const bottom = [94];
    const up = Array.from({ length: 12 }, (_, i) => 94 + i * 0.5);
    const closes = [...down, ...bottom, ...up];
    const volumes = Array.from({ length: 25 }, (_, i) => i === 12 ? 3000 : 1000); // Spike on reversal
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect high volume on reversal from up to down', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const up = Array.from({ length: 12 }, (_, i) => 100 + i * 0.5);
    const peak = [106];
    const down = Array.from({ length: 12 }, (_, i) => 106 - i * 0.5);
    const closes = [...up, ...peak, ...down];
    const volumes = Array.from({ length: 25 }, (_, i) => i === 12 ? 3000 : 1000); // Spike on reversal
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('VolumeProfileAnalyzerNew - Functional: Unusual Volume Events', () => {
  it('should handle extreme volume spike', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const stable = Array.from({ length: 20 }, () => 100);
    const spike = [101];
    const after = Array.from({ length: 4 }, () => 100.5);
    const closes = [...stable, ...spike, ...after];
    const volumes = Array.from({ length: 25 }, (_, i) => i === 20 ? 10000 : 1000); // Extreme spike
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle very low volume period', () => {
    const analyzer = new VolumeProfileAnalyzerNew(createConfig());
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.3);
    const volumes = Array.from({ length: 25 }, () => 100); // Very low volume
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
