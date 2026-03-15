/**
 * Volume Profile Service Tests (PHASE 4 Feature 3)
 * Tests POC, VAH, VAL calculation from volume distribution
 */

import type { VolumeProfileService } from '../../services/volume-profile.service';
import { VolumeProfileConfig, Candle, LoggerService } from '../../types/legacy';
import {
  createVolumeProfileCandle,
  createVolumeProfileHarness,
  createVolumeProfileService,
} from '../helpers/volume-profile-test.utils';

describe('VolumeProfileService', () => {
  let service: VolumeProfileService;
  let logger: LoggerService;
  let config: VolumeProfileConfig;

  beforeEach(() => {
    ({ service, logger, config } = createVolumeProfileHarness({ withErrorHandler: false }));
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with disabled config', () => {
      const disabledService = createVolumeProfileService({
        configOverrides: { ...config, enabled: false },
        logger,
        withErrorHandler: false,
      });
      expect(disabledService).toBeDefined();
    });
  });

  describe('calculate() - basic functionality', () => {
    it('should calculate volume profile from candles', () => {
      const candles = [
        createVolumeProfileCandle(100, 105, 102, 1000), // Distribute 1000 vol across 100-105
        createVolumeProfileCandle(102, 107, 105, 500),  // Distribute 500 vol across 102-107
        createVolumeProfileCandle(98, 103, 101, 800),   // Distribute 800 vol across 98-103
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.poc).toBeGreaterThan(0);
      expect(result!.vah).toBeGreaterThan(0);
      expect(result!.val).toBeGreaterThan(0);
      expect(result!.totalVolume).toBeCloseTo(2300, 0); // 1000 + 500 + 800 (with floating point tolerance)
      expect(result!.nodes.length).toBeGreaterThan(0);
    });

    it('should return POC as price with highest volume', () => {
      // Create candles where price 100-101 gets most volume
      const candles = [
        createVolumeProfileCandle(100, 101, 100.5, 5000), // Heavy volume at 100-101
        createVolumeProfileCandle(105, 106, 105.5, 1000), // Light volume at 105-106
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      // POC should be around 100-101 (where most volume is)
      expect(result!.poc).toBeGreaterThanOrEqual(100);
      expect(result!.poc).toBeLessThanOrEqual(101);
    });

    it('should calculate VAH >= VAL', () => {
      const candles = [
        createVolumeProfileCandle(100, 110, 105, 1000),
        createVolumeProfileCandle(105, 115, 110, 1000),
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should have POC within VAH-VAL range', () => {
      const candles = [
        createVolumeProfileCandle(100, 110, 105, 2000),
        createVolumeProfileCandle(108, 118, 113, 1000),
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      // POC should be in value area
      expect(result!.poc).toBeGreaterThanOrEqual(result!.val);
      expect(result!.poc).toBeLessThanOrEqual(result!.vah);
    });
  });

  describe('calculate() - value area (70%)', () => {
    it('should calculate value area containing ~70% of volume', () => {
      const candles = [
        createVolumeProfileCandle(100, 110, 105, 10000), // Total: 10000
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();

      // Value area should contain approximately 70% of total volume
      const valueNodes = result!.nodes.filter(
        (n) => n.price >= result!.val && n.price <= result!.vah,
      );
      const valueVolume = valueNodes.reduce((sum, n) => sum + n.volume, 0);
      const percent = (valueVolume / result!.totalVolume) * 100;

      // Should be at least 70%
      expect(percent).toBeGreaterThanOrEqual(70);
    });
  });

  describe('calculate() - lookback parameter', () => {
    it('should use only last N candles', () => {
      const candles = [
        createVolumeProfileCandle(100, 105, 102, 1000), // Old candle 1
        createVolumeProfileCandle(105, 110, 107, 1000), // Old candle 2
        createVolumeProfileCandle(110, 115, 112, 1000), // Old candle 3
        createVolumeProfileCandle(115, 120, 117, 5000), // Recent candle (should dominate)
      ];

      const service2Candles = createVolumeProfileService({
        configOverrides: { ...config, lookbackCandles: 2 },
        logger,
        withErrorHandler: false,
      });
      const result = service2Candles.calculate(candles);

      expect(result).not.toBeNull();
      // Should only analyze last 2 candles: total = 1000 + 5000 = 6000
      expect(result!.totalVolume).toBe(6000);
    });

    it('should handle lookback > candles.length', () => {
      const candles = [
        createVolumeProfileCandle(100, 105, 102, 1000),
        createVolumeProfileCandle(105, 110, 107, 1000),
      ];

      const service100Candles = createVolumeProfileService({
        configOverrides: { ...config, lookbackCandles: 100 },
        logger,
        withErrorHandler: false,
      });
      const result = service100Candles.calculate(candles);

      expect(result).not.toBeNull();
      // Should use all 2 candles
      expect(result!.totalVolume).toBe(2000);
    });
  });

  describe('calculate() - edge cases', () => {
    it('should handle empty candles array', () => {
      // Phase 8.9.47: Now throws ValidationError instead of returning null
      expect(() => {
        service.calculate([]);
      }).toThrow();
    });

    it('should handle single candle', () => {
      const candles = [createVolumeProfileCandle(100, 105, 102, 1000)];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.totalVolume).toBe(1000);
      expect(result!.poc).toBeGreaterThan(0);
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should handle candle with zero volume', () => {
      const candles = [
        createVolumeProfileCandle(100, 105, 102, 0), // Zero volume
        createVolumeProfileCandle(105, 110, 107, 1000),
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.totalVolume).toBe(1000);
    });

    it('should handle candle with high = low (single price)', () => {
      const candles = [createVolumeProfileCandle(100, 100, 100, 1000)]; // Single price level

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.poc).toBe(100);
      expect(result!.val).toBe(100);
      expect(result!.vah).toBe(100);
    });
  });

  describe('calculate() - price tick size', () => {
    it('should respect tick size for price levels', () => {
      const candles = [createVolumeProfileCandle(100, 100.1, 100.05, 1000)]; // 0.1 range

      const service01Tick = createVolumeProfileService({
        configOverrides: { ...config, priceTickSize: 0.1 },
        logger,
        withErrorHandler: false,
      });
      const result = service01Tick.calculate(candles);

      expect(result).not.toBeNull();
      // With 0.1 tick size, should have 2 levels: 100, 100.1
      expect(result!.nodes.length).toBeLessThanOrEqual(2);
    });

    it('should create more nodes with smaller tick size', () => {
      const candles = [createVolumeProfileCandle(100, 101, 100.5, 1000)]; // 1.0 range

      const service01Tick = createVolumeProfileService({
        configOverrides: { ...config, priceTickSize: 0.1 },
        logger,
        withErrorHandler: false,
      });
      const result01 = service01Tick.calculate(candles);

      const service001Tick = createVolumeProfileService({
        configOverrides: { ...config, priceTickSize: 0.01 },
        logger,
        withErrorHandler: false,
      });
      const result001 = service001Tick.calculate(candles);

      expect(result01).not.toBeNull();
      expect(result001).not.toBeNull();

      // Smaller tick size = more price levels
      expect(result001!.nodes.length).toBeGreaterThan(result01!.nodes.length);
    });
  });

  describe('calculate() - nodes sorting', () => {
    it('should sort nodes by volume (descending)', () => {
      const candles = [
        createVolumeProfileCandle(100, 110, 105, 10000),
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.nodes.length).toBeGreaterThan(1);

      // Check sorting: each node should have >= volume than next
      for (let i = 0; i < result!.nodes.length - 1; i++) {
        expect(result!.nodes[i].volume).toBeGreaterThanOrEqual(result!.nodes[i + 1].volume);
      }
    });

    it('should have POC as first node (highest volume)', () => {
      const candles = [
        createVolumeProfileCandle(100, 110, 105, 5000),
        createVolumeProfileCandle(105, 115, 110, 3000),
      ];

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      // POC should match first node's price
      expect(result!.poc).toBe(result!.nodes[0].price);
      // First node should have highest volume
      expect(result!.nodes[0].volume).toBe(Math.max(...result!.nodes.map((n) => n.volume)));
    });
  });

  describe('calculate() - disabled mode', () => {
    it('should return null when disabled', () => {
      const disabledService = createVolumeProfileService({
        configOverrides: { ...config, enabled: false },
        logger,
        withErrorHandler: false,
      });

      const candles = [createVolumeProfileCandle(100, 110, 105, 1000)];
      const result = disabledService.calculate(candles);

      expect(result).toBeNull();
    });
  });
});
