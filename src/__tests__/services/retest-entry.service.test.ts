/**
 * Tests for RetestEntryService
 *
 * Retest Entry Service - Fibonacci retracement entry after missed impulse
 */

import { RetestEntryService } from '../../services/retest-entry.service';
import { LoggerService } from '../../services/logger.service';
import { LogLevel, RetestConfig, Signal, Candle, SignalDirection, SignalType } from '../../types';

describe('RetestEntryService', () => {
  let service: RetestEntryService;
  let logger: LoggerService;

  const mockConfig: RetestConfig = {
    enabled: true,
    minImpulsePercent: 0.5,
    retestZoneFibStart: 50,
    retestZoneFibEnd: 61.8,
    maxRetestWaitMs: 300000, // 5 minutes
    volumeMultiplier: 0.8,
    requireStructureIntact: true,
  };

  const mockSignal: Signal = {
    direction: SignalDirection.LONG,
    type: SignalType.TREND_FOLLOWING,
    confidence: 85,
    price: 1.1575,
    stopLoss: 1.1475,
    takeProfits: [
      { level: 1, price: 1.1635, percent: 0.5, sizePercent: 33.33, hit: false },
      { level: 2, price: 1.1695, percent: 1.0, sizePercent: 33.33, hit: false },
      { level: 3, price: 1.1815, percent: 2.0, sizePercent: 33.34, hit: false },
    ],
    reason: 'Test signal',
    timestamp: Date.now(),
    marketData: {
      rsi: 60,
      ema20: 1.1500,
      ema50: 1.1450,
      atr: 0.01,
    },
  };

  const mockCandles: Candle[] = [
    { timestamp: Date.now() - 5000, open: 1.1500, high: 1.1510, low: 1.1490, close: 1.1505, volume: 1000 },
    { timestamp: Date.now() - 4000, open: 1.1505, high: 1.1520, low: 1.1500, close: 1.1515, volume: 1000 },
    { timestamp: Date.now() - 3000, open: 1.1515, high: 1.1540, low: 1.1510, close: 1.1535, volume: 1000 },
    { timestamp: Date.now() - 2000, open: 1.1535, high: 1.1560, low: 1.1530, close: 1.1555, volume: 1000 },
    { timestamp: Date.now() - 1000, open: 1.1555, high: 1.1580, low: 1.1550, close: 1.1575, volume: 1000 },
  ];

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    service = new RetestEntryService(mockConfig, logger);
  });

  describe('detectImpulse', () => {
    it('should detect LONG impulse when price moved >0.5%', () => {
      const currentPrice = 1.1575; // +0.65% from 1.1500
      const candles = mockCandles;

      const result = service.detectImpulse('BTCUSDT', currentPrice, candles);

      expect(result.hasImpulse).toBe(true);
      expect(result.impulseStart).toBe(1.1500); // First candle open
      expect(result.impulseEnd).toBe(currentPrice);
    });

    it('should not detect impulse when price moved <0.5%', () => {
      const currentPrice = 1.1550; // +0.43% from 1.1500
      const candles = mockCandles;

      const result = service.detectImpulse('BTCUSDT', currentPrice, candles);

      expect(result.hasImpulse).toBe(false);
    });

    it('should not detect impulse when service disabled', () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const disabledService = new RetestEntryService(disabledConfig, logger);

      const result = disabledService.detectImpulse('BTCUSDT', 1.1600, mockCandles);

      expect(result.hasImpulse).toBe(false);
    });

    it('should handle empty candles array', () => {
      const result = service.detectImpulse('BTCUSDT', 1.1600, []);

      expect(result.hasImpulse).toBe(false);
      expect(result.impulseStart).toBe(0);
      expect(result.impulseEnd).toBe(0);
    });

    it('should use minimum lookback of 5 candles', () => {
      const threeCandles = mockCandles.slice(0, 3);
      const currentPrice = 1.1600;

      const result = service.detectImpulse('BTCUSDT', currentPrice, threeCandles);

      // Should still work with 3 candles
      expect(result.impulseStart).toBe(threeCandles[0].open);
    });

    it('should detect SHORT impulse when price moved down >0.5%', () => {
      const downCandles: Candle[] = [
        { timestamp: Date.now() - 5000, open: 1.2000, high: 1.2010, low: 1.1990, close: 1.1995, volume: 1000 },
        { timestamp: Date.now() - 4000, open: 1.1995, high: 1.2000, low: 1.1980, close: 1.1985, volume: 1000 },
        { timestamp: Date.now() - 3000, open: 1.1985, high: 1.1990, low: 1.1960, close: 1.1965, volume: 1000 },
        { timestamp: Date.now() - 2000, open: 1.1965, high: 1.1970, low: 1.1940, close: 1.1945, volume: 1000 },
        { timestamp: Date.now() - 1000, open: 1.1945, high: 1.1950, low: 1.1920, close: 1.1925, volume: 1000 },
      ];
      const currentPrice = 1.1925; // -0.625% from 1.2000

      const result = service.detectImpulse('BTCUSDT', currentPrice, downCandles);

      expect(result.hasImpulse).toBe(true);
      expect(result.impulseStart).toBe(1.2000);
      expect(result.impulseEnd).toBe(currentPrice);
    });
  });

  describe('createRetestZone', () => {
    it('should create correct Fibonacci zone for LONG', () => {
      const impulseStart = 1.1500;
      const impulseEnd = 1.1600; // +0.01 impulse
      const impulseRange = impulseEnd - impulseStart; // 0.01

      const zone = service.createRetestZone('BTCUSDT', mockSignal, impulseStart, impulseEnd);

      // Fibonacci retracement: 50% = 1.1550, 61.8% = 1.15382
      const expectedZoneLow = impulseEnd - (impulseRange * 0.618); // 61.8% retrace = 1.15382
      const expectedZoneHigh = impulseEnd - (impulseRange * 0.50); // 50% retrace = 1.1550

      expect(zone.symbol).toBe('BTCUSDT');
      expect(zone.direction).toBe(SignalDirection.LONG);
      expect(zone.impulseStart).toBe(impulseStart);
      expect(zone.impulseEnd).toBe(impulseEnd);
      expect(zone.zoneLow).toBeCloseTo(expectedZoneLow, 5);
      expect(zone.zoneHigh).toBeCloseTo(expectedZoneHigh, 5);
      expect(zone.expiresAt).toBe(zone.createdAt + 300000);
    });

    it('should create correct Fibonacci zone for SHORT', () => {
      const shortSignal: Signal = {
        ...mockSignal,
        direction: SignalDirection.SHORT,
      };
      const impulseStart = 1.2000;
      const impulseEnd = 1.1900; // -0.01 impulse
      const impulseRange = Math.abs(impulseEnd - impulseStart); // 0.01

      const zone = service.createRetestZone('ETHUSDT', shortSignal, impulseStart, impulseEnd);

      // Fibonacci retracement: 50% = 1.1950, 61.8% = 1.19618
      const expectedZoneLow = impulseEnd + (impulseRange * 0.50); // 50% retrace = 1.1950
      const expectedZoneHigh = impulseEnd + (impulseRange * 0.618); // 61.8% retrace = 1.19618

      expect(zone.direction).toBe(SignalDirection.SHORT);
      expect(zone.zoneLow).toBeCloseTo(expectedZoneLow, 5);
      expect(zone.zoneHigh).toBeCloseTo(expectedZoneHigh, 5);
    });

    it('should store zone in map', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      expect(service.hasRetestZone('BTCUSDT')).toBe(true);
      const zone = service.getRetestZone('BTCUSDT');
      expect(zone?.symbol).toBe('BTCUSDT');
    });

    it('should use config Fibonacci levels', () => {
      const customConfig = { ...mockConfig, retestZoneFibStart: 38.2, retestZoneFibEnd: 50 };
      const customService = new RetestEntryService(customConfig, logger);

      const impulseRange = 0.01; // 1.1600 - 1.1500
      const zone = customService.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      // 38.2% = 1.15618, 50% = 1.1550
      const expectedZoneLow = 1.1600 - (impulseRange * 0.50); // 50% = 1.1550
      const expectedZoneHigh = 1.1600 - (impulseRange * 0.382); // 38.2% = 1.15618

      expect(zone.zoneLow).toBeCloseTo(expectedZoneLow, 5);
      expect(zone.zoneHigh).toBeCloseTo(expectedZoneHigh, 5);
    });
  });

  describe('checkRetest', () => {
    beforeEach(() => {
      // Create retest zone
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
    });

    it('should return shouldEnter=true when all conditions met', () => {
      const currentPrice = 1.1545; // In zone (50-61.8% retracement)
      const currentVolume = 800; // Calm volume (0.8x avg)
      const avgVolume = 1000;
      const ema20 = 1.1520; // Price above EMA (LONG)
      const seniorTFTrend = 'UP';

      const result = service.checkRetest(
        'BTCUSDT',
        currentPrice,
        currentVolume,
        avgVolume,
        ema20,
        seniorTFTrend,
      );

      expect(result.inZone).toBe(true);
      expect(result.shouldEnter).toBe(true);
      expect(result.reason).toContain('Calm retest');
    });

    it('should return inZone=false when price outside zone', () => {
      const currentPrice = 1.1650; // Above zone

      const result = service.checkRetest('BTCUSDT', currentPrice, 800, 1000, 1.1520, 'UP');

      expect(result.inZone).toBe(false);
      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toContain('outside zone');
    });

    it('should return shouldEnter=false when volume too high', () => {
      const currentPrice = 1.1545;
      const currentVolume = 1200; // > avgVolume (not calm)
      const avgVolume = 1000;

      const result = service.checkRetest('BTCUSDT', currentPrice, currentVolume, avgVolume, 1.1520, 'UP');

      expect(result.inZone).toBe(true);
      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toContain('Volume too high');
    });

    it('should return shouldEnter=false when EMA structure broken', () => {
      const currentPrice = 1.1545;
      const ema20 = 1.1560; // Price below EMA (structure broken for LONG)

      const result = service.checkRetest('BTCUSDT', currentPrice, 800, 1000, ema20, 'UP');

      expect(result.inZone).toBe(true);
      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toContain('EMA structure broken');
    });

    it('should return shouldEnter=false when senior TF not aligned', () => {
      const currentPrice = 1.1545;
      const seniorTFTrend = 'DOWN'; // Not aligned for LONG

      const result = service.checkRetest('BTCUSDT', currentPrice, 800, 1000, 1.1520, seniorTFTrend);

      expect(result.inZone).toBe(true);
      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toContain('Senior TF not aligned');
    });

    it('should handle expired zone', () => {
      const zone = service.getRetestZone('BTCUSDT');
      if (zone) {
        zone.expiresAt = Date.now() - 1000; // Expired 1 second ago
      }

      const result = service.checkRetest('BTCUSDT', 1.1545, 800, 1000, 1.1520, 'UP');

      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toContain('expired');
      expect(service.hasRetestZone('BTCUSDT')).toBe(false); // Should be deleted
    });

    it('should return false when no retest zone exists', () => {
      const result = service.checkRetest('ETHUSDT', 1.1545, 800, 1000, 1.1520, 'UP');

      expect(result.inZone).toBe(false);
      expect(result.shouldEnter).toBe(false);
      expect(result.reason).toBe('No retest zone');
    });

    it('should skip structure check when not required', () => {
      const noStructureConfig = { ...mockConfig, requireStructureIntact: false };
      const noStructureService = new RetestEntryService(noStructureConfig, logger);

      noStructureService.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      const currentPrice = 1.1545;
      const ema20 = 1.1560; // Price below EMA (would fail if checked)
      const seniorTFTrend = 'DOWN'; // Not aligned (would fail if checked)

      const result = noStructureService.checkRetest(
        'BTCUSDT',
        currentPrice,
        800,
        1000,
        ema20,
        seniorTFTrend,
      );

      expect(result.shouldEnter).toBe(true); // Should pass without structure check
    });

    it('should validate SHORT retest conditions', () => {
      const shortSignal: Signal = {
        ...mockSignal,
        direction: SignalDirection.SHORT,
      };

      service.createRetestZone('ETHUSDT', shortSignal, 1.2000, 1.1900);

      const currentPrice = 1.1955; // In zone (50-61.8% retracement)
      const ema20 = 1.1970; // Price below EMA (SHORT structure intact)
      const seniorTFTrend = 'DOWN';

      const result = service.checkRetest('ETHUSDT', currentPrice, 800, 1000, ema20, seniorTFTrend);

      expect(result.inZone).toBe(true);
      expect(result.shouldEnter).toBe(true);
    });
  });

  describe('getRetestZone', () => {
    it('should return zone if exists', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      const zone = service.getRetestZone('BTCUSDT');

      expect(zone).toBeDefined();
      expect(zone?.symbol).toBe('BTCUSDT');
    });

    it('should return undefined if no zone', () => {
      const zone = service.getRetestZone('BTCUSDT');

      expect(zone).toBeUndefined();
    });
  });

  describe('hasRetestZone', () => {
    it('should return true if zone exists', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      expect(service.hasRetestZone('BTCUSDT')).toBe(true);
    });

    it('should return false if no zone', () => {
      expect(service.hasRetestZone('BTCUSDT')).toBe(false);
    });
  });

  describe('clearZone', () => {
    it('should clear retest zone', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
      expect(service.hasRetestZone('BTCUSDT')).toBe(true);

      service.clearZone('BTCUSDT');

      expect(service.hasRetestZone('BTCUSDT')).toBe(false);
    });

    it('should handle clear when no zone exists', () => {
      expect(() => service.clearZone('BTCUSDT')).not.toThrow();
    });
  });

  describe('getAllZones', () => {
    it('should return all zones', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
      service.createRetestZone('ETHUSDT', mockSignal, 1.2000, 1.2100);

      const allZones = service.getAllZones();

      expect(allZones).toHaveLength(2);
      expect(allZones[0].symbol).toBe('BTCUSDT');
      expect(allZones[1].symbol).toBe('ETHUSDT');
    });

    it('should return empty array if no zones', () => {
      const allZones = service.getAllZones();

      expect(allZones).toHaveLength(0);
    });
  });

  describe('cleanExpiredZones', () => {
    it('should remove expired zones', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
      service.createRetestZone('ETHUSDT', mockSignal, 1.2000, 1.2100);

      // Expire BTCUSDT zone
      const btcZone = service.getRetestZone('BTCUSDT');
      if (btcZone) {
        btcZone.expiresAt = Date.now() - 1000;
      }

      service.cleanExpiredZones();

      expect(service.hasRetestZone('BTCUSDT')).toBe(false);
      expect(service.hasRetestZone('ETHUSDT')).toBe(true);
    });

    it('should handle cleanup when no zones', () => {
      expect(() => service.cleanExpiredZones()).not.toThrow();
    });

    it('should not remove non-expired zones', () => {
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      service.cleanExpiredZones();

      expect(service.hasRetestZone('BTCUSDT')).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.minImpulsePercent).toBe(0.5);
      expect(config.retestZoneFibStart).toBe(50);
      expect(config.retestZoneFibEnd).toBe(61.8);

      // Verify it's a copy (not reference)
      config.enabled = false;
      expect(service.getConfig().enabled).toBe(true);
    });
  });
});
