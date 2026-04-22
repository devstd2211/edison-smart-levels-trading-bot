/**
 * Volume Profile Service Tests (PHASE 4 Feature 3)
 * Tests POC, VAH, VAL calculation from volume distribution
 */

import type { VolumeProfileService } from '../../services/volume-profile.service';
import { VolumeProfileConfig, LoggerService } from '../../types/legacy';
import {
  createVolumeProfileCandle,
  createVolumeProfileCandlesFromSpecs,
  createManagedVolumeProfileContext,
  type VolumeProfileServiceRuntime,
} from '../helpers/volume-profile-test.utils';

describe('VolumeProfileService', () => {
  let service: VolumeProfileServiceRuntime['service'];
  let logger: VolumeProfileServiceRuntime['logger'];
  let config: VolumeProfileServiceRuntime['config'];
  let cleanup: VolumeProfileServiceRuntime['cleanup'];
  let createService: VolumeProfileServiceRuntime['createLegacyService'];

  beforeEach(() => {
    ({
      service,
      logger,
      config,
      cleanup,
      createLegacyService: createService,
    } = createManagedVolumeProfileContext({
      withErrorHandler: false,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with disabled config', () => {
      const disabledService = createService({
        configOverrides: { ...config, enabled: false },
      });
      expect(disabledService).toBeDefined();
    });
  });

  describe('calculate() - basic functionality', () => {
    it('should calculate volume profile from candles', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 105, close: 102, volume: 1000 },
        { low: 102, high: 107, close: 105, volume: 500 },
        { low: 98, high: 103, close: 101, volume: 800 },
      ]);

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
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 101, close: 100.5, volume: 5000 },
        { low: 105, high: 106, close: 105.5, volume: 1000 },
      ]);

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      // POC should be around 100-101 (where most volume is)
      expect(result!.poc).toBeGreaterThanOrEqual(100);
      expect(result!.poc).toBeLessThanOrEqual(101);
    });

    it('should calculate VAH >= VAL', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 110, close: 105, volume: 1000 },
        { low: 105, high: 115, close: 110, volume: 1000 },
      ]);

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should have POC within VAH-VAL range', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 110, close: 105, volume: 2000 },
        { low: 108, high: 118, close: 113, volume: 1000 },
      ]);

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      // POC should be in value area
      expect(result!.poc).toBeGreaterThanOrEqual(result!.val);
      expect(result!.poc).toBeLessThanOrEqual(result!.vah);
    });
  });

  describe('calculate() - value area (70%)', () => {
    it('should calculate value area containing ~70% of volume', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 110, close: 105, volume: 10000 },
      ]);

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
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 105, close: 102, volume: 1000 },
        { low: 105, high: 110, close: 107, volume: 1000 },
        { low: 110, high: 115, close: 112, volume: 1000 },
        { low: 115, high: 120, close: 117, volume: 5000 },
      ]);

      const service2Candles = createService({
        configOverrides: { ...config, lookbackCandles: 2 },
      });
      const result = service2Candles.calculate(candles);

      expect(result).not.toBeNull();
      // Should only analyze last 2 candles: total = 1000 + 5000 = 6000
      expect(result!.totalVolume).toBeCloseTo(6000, 0);
    });

    it('should handle lookback > candles.length', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 105, close: 102, volume: 1000 },
        { low: 105, high: 110, close: 107, volume: 1000 },
      ]);

      const service100Candles = createService({
        configOverrides: { ...config, lookbackCandles: 100 },
      });
      const result = service100Candles.calculate(candles);

      expect(result).not.toBeNull();
      // Should use all 2 candles
      expect(result!.totalVolume).toBeCloseTo(2000, 0);
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
      expect(result!.totalVolume).toBeCloseTo(1000, 0);
      expect(result!.poc).toBeGreaterThan(0);
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should handle candle with zero volume', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 105, close: 102, volume: 0 },
        { low: 105, high: 110, close: 107, volume: 1000 },
      ]);

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.totalVolume).toBeCloseTo(1000, 0);
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

      const service01Tick = createService({
        configOverrides: { ...config, priceTickSize: 0.1 },
      });
      const result = service01Tick.calculate(candles);

      expect(result).not.toBeNull();
      // With 0.1 tick size, should have 2 levels: 100, 100.1
      expect(result!.nodes.length).toBeLessThanOrEqual(2);
    });

    it('should create more nodes with smaller tick size', () => {
      const candles = [createVolumeProfileCandle(100, 101, 100.5, 1000)]; // 1.0 range

      const service01Tick = createService({
        configOverrides: { ...config, priceTickSize: 0.1 },
      });
      const result01 = service01Tick.calculate(candles);

      const service001Tick = createService({
        configOverrides: { ...config, priceTickSize: 0.01 },
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
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 110, close: 105, volume: 10000 },
      ]);

      const result = service.calculate(candles);

      expect(result).not.toBeNull();
      expect(result!.nodes.length).toBeGreaterThan(1);

      // Check sorting: each node should have >= volume than next
      for (let i = 0; i < result!.nodes.length - 1; i++) {
        expect(result!.nodes[i].volume).toBeGreaterThanOrEqual(result!.nodes[i + 1].volume);
      }
    });

    it('should have POC as first node (highest volume)', () => {
      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100, high: 110, close: 105, volume: 5000 },
        { low: 105, high: 115, close: 110, volume: 3000 },
      ]);

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
      const disabledService = createService({
        configOverrides: { ...config, enabled: false },
      });

      const candles = [createVolumeProfileCandle(100, 110, 105, 1000)];
      const result = disabledService.calculate(candles);

      expect(result).toBeNull();
    });
  });
});
