/**
 * Volume Analyzer NEW - Technical Tests
 */

import { VolumeAnalyzerNew } from '../../analyzers/volume.analyzer-new';
import type { Candle } from '../../types/core';
import type { VolumeAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createDefaultConfig(): VolumeAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.7,
    priority: 4,
    neutralConfidence: 0.3,
  };
}

function createCandle(volume: number): Candle {
  return {
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume,
    timestamp: Date.now(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('VolumeAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).enabled;
    expect(() => new VolumeAnalyzerNew(config as any)).toThrow('[VOLUME_ANALYZER] Missing or invalid: enabled');
  });

  test('should throw on invalid weight', () => {
    const config = { ...createDefaultConfig(), weight: 1.5 };
    expect(() => new VolumeAnalyzerNew(config)).toThrow('[VOLUME_ANALYZER] Missing or invalid: weight');
  });

  test('should throw on invalid priority', () => {
    const config = { ...createDefaultConfig(), priority: 0 };
    expect(() => new VolumeAnalyzerNew(config)).toThrow('[VOLUME_ANALYZER] Missing or invalid: priority');
  });

  test('should throw on invalid neutralConfidence', () => {
    const config = { ...createDefaultConfig(), neutralConfidence: -0.1 };
    expect(() => new VolumeAnalyzerNew(config)).toThrow('[VOLUME_ANALYZER] Missing or invalid: neutralConfidence');
  });

});

describe('VolumeAnalyzerNew - Input Validation Tests', () => {
  test('should throw when analyzer is disabled', () => {
    const config = { ...createDefaultConfig(), enabled: false };
    const analyzer = new VolumeAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    expect(() => analyzer.analyze(candles)).toThrow('[VOLUME_ANALYZER] Analyzer is disabled');
  });

  test('should throw on invalid candles input', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    expect(() => analyzer.analyze(null as any)).toThrow('[VOLUME_ANALYZER] Invalid candles input');
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 10 }, () => createCandle(1000));
    expect(() => analyzer.analyze(candles)).toThrow('[VOLUME_ANALYZER] Not enough candles');
  });

  test('should throw on candle with missing volume', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    (candles[10] as any).volume = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[VOLUME_ANALYZER] Invalid candle');
  });
});

describe('VolumeAnalyzerNew - Signal Generation Tests', () => {
  test('should generate LONG signal on strong volume', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    // Create pattern: low average, high final volume = strong volume signal (> 65)
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(i < 19 ? 500 : 2000) // Low average, high spike at end
    );
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.LONG);
  });

  test('should generate SHORT signal on weak volume', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    // Create pattern: high average volume, then weak volume at end (strength < 35)
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(i < 19 ? 1000 : 100) // High average, very low last candle
    );
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.SHORT);
  });

  test('should generate HOLD signal on neutral volume', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000)); // Consistent volume
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.HOLD);
  });

  test('should calculate correct score', () => {
    const config = { ...createDefaultConfig(), weight: 0.6 };
    const analyzer = new VolumeAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, (_, i) => createCandle(1000 + i * 100));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * config.weight, 1);
  });
});

describe('VolumeAnalyzerNew - Confidence Calculation Tests', () => {
  test('should clamp confidence to maximum value', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, (_, i) => createCandle(2000 + i * 200));
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeLessThanOrEqual(95); // MAX_CONFIDENCE = 0.95 = 95%
  });

  test('should respect minimum confidence floor', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    // Create pattern: high average, then very low volume (very weak)
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(i < 19 ? 1000 : 50) // Very weak volume at end
    );
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });

  test('should use neutralConfidence for neutral zone', () => {
    const config = { ...createDefaultConfig(), neutralConfidence: 0.4 };
    const analyzer = new VolumeAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    const signal = analyzer.analyze(candles);
    // Neutral zone: confidence should be neutralConfidence * 100
    expect(signal.confidence).toBe(40); // 0.4 * 100
  });
});

describe('VolumeAnalyzerNew - State Management Tests', () => {
  test('should track last signal', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });

  test('should initially have null last signal', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state with all config values', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);
    const state = analyzer.getState();
    expect(state.config.weight).toBe(config.weight);
    expect(state.config.priority).toBe(config.priority);
    expect(state.config.neutralConfidence).toBe(config.neutralConfidence);
  });

  test('should reset state', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('VolumeAnalyzerNew - Volume Strength Tests', () => {
  test('should retrieve volume strength (0-100 scale)', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    const strength = analyzer.getVolumeStrength(candles);
    expect(typeof strength).toBe('number');
    expect(strength).toBeGreaterThanOrEqual(0);
    expect(strength).toBeLessThanOrEqual(100);
  });

  test('should detect strong volume (> 65)', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    // Create pattern: low average volume, then spike at end (strength > 65)
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(i < 19 ? 1000 : 2000) // Low average, high spike at end
    );
    expect(analyzer.isStrongVolume(candles)).toBe(true);
  });

  test('should not detect weak volume when volume is normal', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    // Normal consistent volume should be near 50 (ratio of 1.0), not weak
    expect(analyzer.isWeakVolume(candles)).toBe(false);
  });

  test('should respect custom thresholds', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    const strength = analyzer.getVolumeStrength(candles);
    expect(analyzer.isStrongVolume(candles, strength + 10)).toBe(false);
    expect(analyzer.isWeakVolume(candles, strength - 10)).toBe(false);
  });
});

describe('VolumeAnalyzerNew - Edge Cases Tests', () => {
  test('should handle very large volumes', () => {
    const analyzer = new VolumeAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, () => createCandle(1000000));
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle zero weight', () => {
    const config = { ...createDefaultConfig(), weight: 0 };
    const analyzer = new VolumeAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, () => createCandle(1000));
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should maintain consistent config across analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new VolumeAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, () => createCandle(1000));

    analyzer.analyze(candles);
    const state1 = analyzer.getState();
    analyzer.analyze(candles);
    const state2 = analyzer.getState();

    expect(state1.config.weight).toBe(state2.config.weight);
    expect(state1.config.priority).toBe(state2.config.priority);
  });
});
