/**
 * Volume Indicator NEW - Technical Tests
 * Tests code execution, configuration validation, and volume calculations
 */

import { VolumeIndicatorNew } from '../../indicators/volume.indicator-new';
import type { Candle } from '../../types/core';
import type { VolumeIndicatorConfigNew } from '../../types/config-new.types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCandle(volume: number, close: number = 100): Candle {
  return {
    open: 100,
    high: 102,
    low: 98,
    close,
    volume,
    timestamp: Date.now(),
  };
}

function createCandles(volumes: number[]): Candle[] {
  return volumes.map((vol) => createCandle(vol));
}

// ============================================================================
// CONFIGURATION VALIDATION TESTS
// ============================================================================

describe('VolumeIndicatorNew - Configuration Validation', () => {
  test('should throw on missing enabled property', () => {
    const config = { period: 20 } as any;
    expect(() => new VolumeIndicatorNew(config)).toThrow();
  });

  test('should throw on missing period property', () => {
    const config = { enabled: true } as any;
    expect(() => new VolumeIndicatorNew(config)).toThrow();
  });

  test('should throw on invalid period (0)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 0 };
    expect(() => new VolumeIndicatorNew(config)).toThrow(
      '[VOLUME_INDICATOR] Missing or invalid: period (number >= 1)',
    );
  });

  test('should throw on negative period', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: -5 };
    expect(() => new VolumeIndicatorNew(config)).toThrow();
  });

  test('should throw on non-numeric period', () => {
    const config = { enabled: true, period: 'twenty' } as any;
    expect(() => new VolumeIndicatorNew(config)).toThrow();
  });

  test('should accept valid configuration', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 20 };
    const indicator = new VolumeIndicatorNew(config);
    expect(indicator).toBeDefined();
  });

  test('should accept disabled configuration', () => {
    const config: VolumeIndicatorConfigNew = { enabled: false, period: 20 };
    const indicator = new VolumeIndicatorNew(config);
    expect(indicator).toBeDefined();
    expect(indicator.isEnabled()).toBe(false);
  });
});

// ============================================================================
// INITIALIZATION AND BASIC FUNCTIONALITY
// ============================================================================

describe('VolumeIndicatorNew - Initialization', () => {
  test('should throw when calling getValue() before calculate()', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);

    expect(() => indicator.getValue()).toThrow('[VOLUME_INDICATOR] Not initialized');
  });

  test('should throw when calling update() before calculate()', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candle = createCandle(1000);

    expect(() => indicator.update(candle)).toThrow('[VOLUME_INDICATOR] Not initialized');
  });

  test('should throw when indicator is disabled', () => {
    const config: VolumeIndicatorConfigNew = { enabled: false, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    expect(() => indicator.calculate(candles)).toThrow(
      '[VOLUME_INDICATOR] Indicator is disabled',
    );
  });

  test('should initialize after calculate()', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    const result = indicator.calculate(candles);
    expect(result).toBeDefined();
    expect(result.average).toBeGreaterThan(0);
  });
});

// ============================================================================
// VOLUME CALCULATION TESTS
// ============================================================================

describe('VolumeIndicatorNew - Volume Calculations', () => {
  test('should calculate correct average volume', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1100, 900, 1200, 800];
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    const expectedAverage = (1000 + 1100 + 900 + 1200 + 800) / 5; // 1000
    expect(result.average).toBeCloseTo(expectedAverage, 2);
  });

  test('should calculate volume ratio correctly', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 2000]; // Average = 1200, ratio = 2000/1200 = 1.67
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.ratio).toBeCloseTo(1.67, 1);
  });

  test('should calculate strength (0-100 scale)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 1000]; // All equal
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.strength).toBeCloseTo(50, 1); // 50 = average (ratio 1.0 * 50)
  });

  test('should handle very high volume spike', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [100, 100, 100, 100, 10000]; // Average = 2080, ratio = 10000/2080 = 4.81
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.ratio).toBeGreaterThan(4);
    expect(result.strength).toBe(100); // Clamped to 100
  });

  test('should handle very low volume', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 10]; // Very low last candle
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.ratio).toBeLessThan(0.1);
    expect(result.strength).toBeLessThan(10);
  });

  test('should handle zero volume gracefully', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 0]; // Zero volume
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.ratio).toBe(0);
    expect(result.strength).toBe(0);
  });
});

// ============================================================================
// VOLUME UPDATE TESTS
// ============================================================================

describe('VolumeIndicatorNew - Update Method', () => {
  test('should update average on new candle', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 3 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1000, 1000]);

    indicator.calculate(candles);
    const before = indicator.getValue();

    const newCandle = createCandle(2000);
    indicator.update(newCandle);
    const after = indicator.getValue();

    expect(after.average).toBeGreaterThan(before.average);
  });

  test('should maintain rolling average with period', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 3 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([100, 200, 300]);

    indicator.calculate(candles);
    const first = indicator.getValue();
    expect(first.average).toBeCloseTo(200, 1);

    // Update with 400 - should have [200, 300, 400] average = 300
    indicator.update(createCandle(400));
    const second = indicator.getValue();
    expect(second.average).toBeCloseTo(300, 1);

    // Update with 500 - should have [300, 400, 500] average = 400
    indicator.update(createCandle(500));
    const third = indicator.getValue();
    expect(third.average).toBeCloseTo(400, 1);
  });

  test('should throw on invalid candle', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    indicator.calculate(candles);

    const invalidCandle = { ...createCandle(1000), volume: -100 };
    expect(() => indicator.update(invalidCandle)).toThrow();
  });

  test('should throw on null candle', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    indicator.calculate(candles);
    expect(() => indicator.update(null as any)).toThrow();
  });
});

// ============================================================================
// VOLUME CLASSIFICATION TESTS
// ============================================================================

describe('VolumeIndicatorNew - Volume Classification', () => {
  test('should classify very low volume (< 0.3x)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 200]; // 0.2x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.getClassification()).toBe('very_low');
  });

  test('should classify low volume (0.3-0.7x)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 500]; // 0.5x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.getClassification()).toBe('low');
  });

  test('should classify normal volume (0.7-1.3x)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 1000]; // 1.0x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.getClassification()).toBe('normal');
  });

  test('should classify high volume (1.3-2.0x)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 1500]; // 1.5x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.getClassification()).toBe('high');
  });

  test('should classify very high volume (> 2.0x)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 3000]; // 3.0x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.getClassification()).toBe('very_high');
  });
});

// ============================================================================
// THRESHOLD TESTS
// ============================================================================

describe('VolumeIndicatorNew - Threshold Methods', () => {
  test('should detect above average volume', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 1500];
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.isAboveAverage(1.0)).toBe(true);
  });

  test('should detect below average volume', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 500];
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.isBelowAverage(1.0)).toBe(true);
  });

  test('should support custom threshold', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1000, 1000, 1000, 1500]; // 1.5x average
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    expect(indicator.isAboveAverage(1.0)).toBe(true);
    expect(indicator.isAboveAverage(2.0)).toBe(false); // 1.5x < 2.0x
  });
});

// ============================================================================
// TREND TESTS
// ============================================================================

describe('VolumeIndicatorNew - Volume Trend', () => {
  test('should detect increasing trend (> 10% increase)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1100, 900, 1200, 800];
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    indicator.update(createCandle(900)); // 800 -> 900 = +12.5%
    expect(indicator.getTrend()).toBe('increasing');
  });

  test('should detect decreasing trend (< -10% decrease)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1100, 900, 1200, 800];
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    indicator.update(createCandle(700)); // 800 -> 700 = -12.5%
    expect(indicator.getTrend()).toBe('decreasing');
  });

  test('should detect stable trend (within ±10%)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000, 1100, 900, 1200, 800];
    const candles = createCandles(volumes);

    indicator.calculate(candles);
    indicator.update(createCandle(810)); // 800 -> 810 = +1.25%
    expect(indicator.getTrend()).toBe('stable');
  });

  test('should throw on trend immediately after calculate (only 1 candle history)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 1 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000]);

    indicator.calculate(candles);
    // getTrend needs at least 2 candles (previous and current)
    expect(() => indicator.getTrend()).toThrow('[VOLUME_INDICATOR] Not enough data for trend analysis');
  });
});

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('VolumeIndicatorNew - Input Validation', () => {
  test('should throw on invalid candles input (not array)', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);

    expect(() => indicator.calculate({} as any)).toThrow(
      '[VOLUME_INDICATOR] Invalid candles input',
    );
  });

  test('should throw on not enough candles', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900]); // Only 3, need 5

    expect(() => indicator.calculate(candles)).toThrow('Not enough candles');
  });

  test('should throw on invalid volume in candle', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, -800]); // Negative volume

    expect(() => indicator.calculate(candles)).toThrow('[VOLUME_INDICATOR] Invalid volume');
  });

  test('should throw on null candle in array', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200]) as any;
    candles.push(null);

    expect(() => indicator.calculate(candles)).toThrow('[VOLUME_INDICATOR] Invalid volume');
  });
});

// ============================================================================
// STATE MANAGEMENT TESTS
// ============================================================================

describe('VolumeIndicatorNew - State Management', () => {
  test('should return correct state', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    indicator.calculate(candles);
    const state = indicator.getState();

    expect(state.initialized).toBe(true);
    expect(state.average).toBeGreaterThan(0);
    expect(state.volumeCount).toBe(5);
  });

  test('should reset state', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    indicator.calculate(candles);
    indicator.reset();
    const state = indicator.getState();

    expect(state.initialized).toBe(false);
    expect(state.average).toBe(0);
    expect(state.volumeCount).toBe(0);
  });

  test('should throw after reset', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000, 1100, 900, 1200, 800]);

    indicator.calculate(candles);
    indicator.reset();

    expect(() => indicator.getValue()).toThrow('[VOLUME_INDICATOR] Not initialized');
  });
});

// ============================================================================
// CONFIG RETRIEVAL TESTS
// ============================================================================

describe('VolumeIndicatorNew - Config Retrieval', () => {
  test('should return correct config', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 20 };
    const indicator = new VolumeIndicatorNew(config);

    const returnedConfig = indicator.getConfig();
    expect(returnedConfig.enabled).toBe(true);
    expect(returnedConfig.period).toBe(20);
  });

  test('should return correct config when disabled', () => {
    const config: VolumeIndicatorConfigNew = { enabled: false, period: 10 };
    const indicator = new VolumeIndicatorNew(config);

    const returnedConfig = indicator.getConfig();
    expect(returnedConfig.enabled).toBe(false);
    expect(returnedConfig.period).toBe(10);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('VolumeIndicatorNew - Edge Cases', () => {
  test('should handle period of 1', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 1 };
    const indicator = new VolumeIndicatorNew(config);
    const candles = createCandles([1000]);

    const result = indicator.calculate(candles);
    expect(result.average).toBe(1000);
    expect(result.ratio).toBe(1);
  });

  test('should handle large period', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 1000 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = Array(1000).fill(1000);
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.average).toBe(1000);
  });

  test('should handle very large volume values', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 3 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [1000000, 2000000, 3000000];
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.average).toBeCloseTo(2000000, -2);
  });

  test('should handle very small volume values', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 3 };
    const indicator = new VolumeIndicatorNew(config);
    const volumes = [0.1, 0.2, 0.15];
    const candles = createCandles(volumes);

    const result = indicator.calculate(candles);
    expect(result.average).toBeGreaterThan(0);
  });
});
