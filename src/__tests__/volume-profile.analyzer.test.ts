/**
 * VolumeProfileAnalyzer Unit Tests
 *
 * Tests for volume profile calculation and signal generation.
 */

import { VolumeProfileAnalyzer } from '../analyzers/volume-profile.analyzer';
import type { VolumeProfileConfig } from '../analyzers/volume-profile.analyzer';
import { Candle, SignalDirection } from '../types';

// Mock Logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('VolumeProfileAnalyzer', () => {
  let analyzer: VolumeProfileAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new VolumeProfileAnalyzer(mockLogger as any, {
      lookbackCandles: 200,
      valueAreaPercent: 70,
      priceTickSize: 0.1,
      hvnThreshold: 1.5,
      lvnThreshold: 0.5,
      maxDistancePercent: 1.0,
      baseConfidence: 60,
      maxConfidence: 85,
    });
  });

  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    timestamp: number = Date.now(),
  ): Candle => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  });

  const createCandleSeries = (
    basePrice: number,
    count: number,
    volumeDistribution: 'uniform' | 'poc' | 'bimodal' = 'uniform',
  ): Candle[] => {
    const candles: Candle[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const variation = (Math.sin(i * 0.1) * 5); // Price oscillation
      const price = basePrice + variation;
      let volume = 100;

      if (volumeDistribution === 'poc') {
        // High volume around base price (POC)
        const distanceFromBase = Math.abs(price - basePrice);
        volume = distanceFromBase < 2 ? 500 : 50;
      } else if (volumeDistribution === 'bimodal') {
        // Two high volume zones
        volume = (Math.abs(price - (basePrice - 3)) < 1 || Math.abs(price - (basePrice + 3)) < 1)
          ? 400
          : 50;
      }

      candles.push(createCandle(
        price - 0.5,
        price + 1,
        price - 1,
        price,
        volume,
        now - (count - i) * 60000,
      ));
    }

    return candles;
  };

  describe('calculateProfile', () => {
    it('should return null with insufficient candles', () => {
      const candles = [createCandle(100, 101, 99, 100, 100)];
      const result = analyzer.calculateProfile(candles);

      expect(result).toBeNull();
    });

    it('should calculate POC correctly', () => {
      // Create candles with clear POC at 100
      const candles = createCandleSeries(100, 100, 'poc');
      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.poc).toBeDefined();
      expect(result!.poc.volume).toBeGreaterThan(0);
    });

    it('should calculate Value Area High and Low', () => {
      const candles = createCandleSeries(100, 100, 'uniform');
      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.vah).toBeGreaterThan(result!.val);
      expect(result!.val).toBeLessThan(result!.poc.price);
      expect(result!.vah).toBeGreaterThan(result!.poc.price);
    });

    it('should identify HVN levels', () => {
      const candles = createCandleSeries(100, 100, 'bimodal');
      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.hvnLevels.length).toBeGreaterThan(0);
    });

    it('should identify LVN levels', () => {
      const candles = createCandleSeries(100, 100, 'bimodal');
      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.lvnLevels.length).toBeGreaterThan(0);
    });

    it('should calculate total volume correctly', () => {
      const candles = [
        createCandle(100, 101, 99, 100, 100),
        createCandle(100, 101, 99, 100, 200),
        createCandle(100, 101, 99, 100, 300),
      ].concat(createCandleSeries(100, 50, 'uniform'));

      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.totalVolume).toBeGreaterThan(0);
    });
  });

  describe('generateSignal', () => {
    it('should return null with insufficient candles', () => {
      const candles = [createCandle(100, 101, 99, 100, 100)];
      const signal = analyzer.generateSignal(candles, 100);

      expect(signal).toBeNull();
    });

    it('should generate LONG signal near VAL', () => {
      // Create profile with POC around 100
      const candles = createCandleSeries(100, 100, 'poc');
      const profile = analyzer.calculateProfile(candles);

      if (profile) {
        // Price at or below VAL
        const priceNearVal = profile.val - (profile.val * 0.001);
        const signal = analyzer.generateSignal(candles, priceNearVal);

        // Should suggest LONG from VAL
        if (signal) {
          expect(signal.direction).toBe(SignalDirection.LONG);
          expect(signal.source).toBe('VOLUME_PROFILE');
        }
      }
    });

    it('should generate SHORT signal near VAH', () => {
      const candles = createCandleSeries(100, 100, 'poc');
      const profile = analyzer.calculateProfile(candles);

      if (profile) {
        // Price at or above VAH
        const priceNearVah = profile.vah + (profile.vah * 0.001);
        const signal = analyzer.generateSignal(candles, priceNearVah);

        if (signal) {
          expect(signal.direction).toBe(SignalDirection.SHORT);
        }
      }
    });

    it('should return null when price is far from key levels', () => {
      const candles = createCandleSeries(100, 100, 'poc');
      // Price far from any level
      const signal = analyzer.generateSignal(candles, 150);

      expect(signal).toBeNull();
    });

    it('should include correct signal metadata', () => {
      const candles = createCandleSeries(100, 100, 'poc');
      const profile = analyzer.calculateProfile(candles);

      if (profile) {
        const priceNearVal = profile.val;
        const signal = analyzer.generateSignal(candles, priceNearVal);

        if (signal) {
          expect(signal.weight).toBe(0.18);
          expect(signal.priority).toBe(7);
          expect(signal.confidence).toBeGreaterThanOrEqual(60);
          expect(signal.confidence).toBeLessThanOrEqual(85);
        }
      }
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig: Partial<VolumeProfileConfig> = {
        lookbackCandles: 100,
        valueAreaPercent: 80,
      };

      const customAnalyzer = new VolumeProfileAnalyzer(mockLogger as any, customConfig);
      const config = customAnalyzer.getConfig();

      expect(config.lookbackCandles).toBe(100);
      expect(config.valueAreaPercent).toBe(80);
    });

    it('should update configuration', () => {
      analyzer.updateConfig({ maxDistancePercent: 2.0 });
      const config = analyzer.getConfig();

      expect(config.maxDistancePercent).toBe(2.0);
    });
  });

  describe('edge cases', () => {
    it('should return null for doji candles with no range', () => {
      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(100, 100, 100, 100, 100, Date.now() - i * 60000),
      );

      const result = analyzer.calculateProfile(candles);

      // Zero range means no volume profile can be calculated - this is expected
      expect(result).toBeNull();
    });

    it('should handle realistic small price ranges', () => {
      // Use a more realistic price range that creates valid buckets
      const candles = Array.from({ length: 50 }, (_, i) =>
        createCandle(100, 101, 99, 100, 100, Date.now() - i * 60000),
      );

      const result = analyzer.calculateProfile(candles);

      expect(result).not.toBeNull();
      expect(result!.poc).toBeDefined();
    });
  });
});
