/**
 * Volume Calculator Tests
 */

import { VolumeCalculator } from '../../analyzers/volume.calculator';
import { LoggerService, LogLevel, Candle } from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandle(volume: number, timestamp: number = Date.now()): Candle {
  return {
    timestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume,
  };
}

function createCandles(volumes: number[]): Candle[] {
  return volumes.map((v, i) => createCandle(v, Date.now() + i * 60000));
}

// ============================================================================
// TESTS
// ============================================================================

describe('VolumeCalculator', () => {
  let calculator: VolumeCalculator;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    calculator = new VolumeCalculator(logger, 20);
  });

  // ============================================================================
  // TEST 1: Insufficient Data
  // ============================================================================

  describe('calculate - insufficient data', () => {
    it('should return noVolumeData when not enough candles', () => {
      const candles = createCandles([100, 200, 300]); // Only 3 candles, need 20

      const result = calculator.calculate(candles);

      expect(result.currentVolume).toBe(0);
      expect(result.avgVolume).toBe(0);
      expect(result.volumeRatio).toBe(0);
      expect(result.isLowVolume).toBe(false);
      expect(result.isHighVolume).toBe(false);
      expect(result.volumeModifier).toBe(1.0);
    });
  });

  // ============================================================================
  // TEST 2: Normal Volume
  // ============================================================================

  describe('calculate - normal volume', () => {
    it('should detect normal volume (1x avg)', () => {
      // Average: 1000, Current: 1000 (ratio 1.0)
      const volumes = Array(19).fill(1000);
      volumes.push(1000); // Current = avg
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.currentVolume).toBe(1000);
      expect(result.avgVolume).toBe(1000);
      expect(result.volumeRatio).toBe(1.0);
      expect(result.isLowVolume).toBe(false);
      expect(result.isHighVolume).toBe(false);
      expect(result.volumeModifier).toBe(1.0); // No modifier
    });

    it('should detect normal volume (1.5x avg)', () => {
      // Average: 1000, Current: 1500 (ratio 1.5)
      const volumes = Array(19).fill(1000);
      volumes.push(1500);
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.currentVolume).toBe(1500);
      expect(result.avgVolume).toBe(1025); // (19*1000 + 1500) / 20
      expect(result.volumeRatio).toBeCloseTo(1.46, 2);
      expect(result.isLowVolume).toBe(false);
      expect(result.isHighVolume).toBe(false);
      expect(result.volumeModifier).toBe(1.0); // Still normal
    });
  });

  // ============================================================================
  // TEST 3: Low Volume
  // ============================================================================

  describe('calculate - low volume', () => {
    it('should detect low volume (0.4x avg)', () => {
      // Average: (19*1000 + 400) / 20 = 970, Current: 400
      const volumes = Array(19).fill(1000);
      volumes.push(400);
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.currentVolume).toBe(400);
      expect(result.avgVolume).toBe(970);
      expect(result.volumeRatio).toBeCloseTo(0.41, 2);
      expect(result.isLowVolume).toBe(true); // < 0.5x
      expect(result.isHighVolume).toBe(false);
      expect(result.volumeModifier).toBe(0.9); // -10%
    });

    it('should detect low volume (exactly 0.5x avg)', () => {
      // Average: (19*1000 + 500) / 20 = 975, Current: 500
      const volumes = Array(19).fill(1000);
      volumes.push(500);
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.avgVolume).toBe(975);
      expect(result.volumeRatio).toBeCloseTo(0.51, 2);
      expect(result.isLowVolume).toBe(false); // >= 0.5x
      expect(result.volumeModifier).toBe(1.0);
    });
  });

  // ============================================================================
  // TEST 4: High Volume
  // ============================================================================

  describe('calculate - high volume', () => {
    it('should detect high volume (2.5x avg)', () => {
      // Average: (19*1000 + 2500) / 20 = 1075, Current: 2500
      const volumes = Array(19).fill(1000);
      volumes.push(2500);
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.currentVolume).toBe(2500);
      expect(result.avgVolume).toBe(1075);
      expect(result.volumeRatio).toBeCloseTo(2.33, 2);
      expect(result.isLowVolume).toBe(false);
      expect(result.isHighVolume).toBe(true); // > 2x
      expect(result.volumeModifier).toBe(1.1); // +10%
    });

    it('should detect high volume (exactly 2x avg)', () => {
      // Average: (19*1000 + 2000) / 20 = 1050, Current: 2000
      const volumes = Array(19).fill(1000);
      volumes.push(2000);
      const candles = createCandles(volumes);

      const result = calculator.calculate(candles);

      expect(result.avgVolume).toBe(1050);
      expect(result.volumeRatio).toBeCloseTo(1.90, 2);
      expect(result.isHighVolume).toBe(false); // Not > 2x
      expect(result.volumeModifier).toBe(1.0);
    });
  });

  // ============================================================================
  // TEST 5: Custom Rolling Period
  // ============================================================================

  describe('calculate - custom rolling period', () => {
    it('should use custom rolling period (10)', () => {
      const customCalculator = new VolumeCalculator(logger, 10);

      // 10 candles with volume 500, current 1000
      const volumes = Array(9).fill(500);
      volumes.push(1000);
      const candles = createCandles(volumes);

      const result = customCalculator.calculate(candles);

      expect(result.avgVolume).toBe(550); // (9*500 + 1000) / 10
      expect(result.volumeRatio).toBeCloseTo(1.82, 2);
    });
  });
});
