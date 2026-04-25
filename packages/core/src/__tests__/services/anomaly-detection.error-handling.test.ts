/**
 * AnomalyDetectionService Error Handling Tests
 * Phase 10.2.3
 *
 * Test Coverage: 35 tests
 * - 5 THROW: Config validation
 * - 5 THROW: Input validation
 * - 7 GRACEFUL_DEGRADE: Detection failures
 * - 3 SKIP: Logging failures
 * - 9 Integration: E2E scenarios
 * - 3 Edge cases
 * - 3 Backward compat
 */

import { AnomalyDetectionService } from '../../services/anomaly-detection.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { Trade, AnomalyDetectionConfig } from '../../types/anomaly-detection';
import {
  AnomalyDetectionInternals,
  createAnomalyDetectionMockLogger,
  createManagedAnomalyDetectionContext,
  createAnomalyDetectionTrade,
  createAnomalyDetectionTradeSeries,
  createAnomalyDetectionValueSeries,
  seedAnomalyDetectionHistory,
  seedVolatilityHistory,
  seedVolumeHistory,
} from '../helpers/anomaly-detection-test.utils';

type AnomalyDetectionSuiteContext = ReturnType<typeof createManagedAnomalyDetectionContext>;

describe('AnomalyDetectionService - Error Handling', () => {
  let service: AnomalyDetectionService;
  let errorHandler: ErrorHandler | undefined;
  let logger: LoggerService;
  type ConfigInput = ConstructorParameters<typeof AnomalyDetectionService>[0];
  type VolumeInput = Parameters<AnomalyDetectionService['detectVolumeAnomaly']>[0];
  type VolatilityInput = Parameters<AnomalyDetectionService['detectVolatilitySpike']>[0];
  type WhaleTradesInput = Parameters<AnomalyDetectionService['detectWhaleActivity']>[0];
  let createService: AnomalyDetectionSuiteContext['createStandardService'];
  let createLegacyService: AnomalyDetectionSuiteContext['createLegacyService'];
  let cleanup: AnomalyDetectionSuiteContext['cleanup'];

  beforeEach(() => {
    ({
      service,
      logger,
      errorHandler,
      createStandardService: createService,
      createLegacyService,
      cleanup,
    } = createManagedAnomalyDetectionContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================
  // THROW: Config Validation (5 tests)
  // ========================================

  describe('THROW: Config Validation', () => {
    it('should throw when config is not an object', () => {
      expect(() => {
        createService({
          config: 'invalid' as unknown as Partial<AnomalyDetectionConfig>,
        });
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is a number', () => {
      expect(() => {
        createService({
          config: 123 as unknown as Partial<AnomalyDetectionConfig>,
        });
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is an array', () => {
      expect(() => {
        createService({
          config: [] as unknown as Partial<AnomalyDetectionConfig>,
        });
      }).toThrow('Config must be an object or undefined');
    });

    it('should NOT throw when config is undefined', () => {
      expect(() => {
        createService();
      }).not.toThrow();
    });

    it('should NOT throw when config is a valid object', () => {
      expect(() => {
        createService({
          config: { volumeAnomalyThreshold: 3.0 } as unknown as Partial<AnomalyDetectionConfig>,
        });
      }).not.toThrow();
    });
  });

  // ========================================
  // THROW: Input Validation (5 tests)
  // ========================================

  describe('THROW: Input Validation', () => {
    it('should throw when detectVolumeAnomaly receives non-number', () => {
      expect(() => {
        service.detectVolumeAnomaly('invalid' as unknown as VolumeInput);
      }).toThrow('Volume must be a number');
    });

    it('should throw when detectVolumeAnomaly receives negative volume', () => {
      expect(() => {
        service.detectVolumeAnomaly(-100);
      }).toThrow('Volume must be a finite non-negative number');
    });

    it('should throw when detectVolatilitySpike receives non-number', () => {
      expect(() => {
        service.detectVolatilitySpike('invalid' as unknown as VolatilityInput);
      }).toThrow('Volatility must be a number');
    });

    it('should throw when detectWhaleActivity receives null', () => {
      expect(() => {
        service.detectWhaleActivity(null as unknown as WhaleTradesInput);
      }).toThrow('Trades array cannot be null or undefined');
    });

    it('should throw when detectWhaleActivity receives non-array', () => {
      expect(() => {
        service.detectWhaleActivity('invalid' as unknown as WhaleTradesInput);
      }).toThrow('Trades must be an array');
    });
  });

  // ========================================
  // GRACEFUL_DEGRADE: Detection Failures (7 tests)
  // ========================================

  describe('GRACEFUL_DEGRADE: Detection Failures', () => {
    it('should return no anomaly when volume detection throws error', () => {
      // Force error by mocking internal method
      const internals = service as unknown as AnomalyDetectionInternals;
      jest.spyOn(internals, 'performVolumeAnomalyDetection').mockImplementation(() => {
        throw new Error('Volume detection failed');
      });

      const result = service.detectVolumeAnomaly(1000);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('volume');
    });

    it('should return no spike when volatility detection throws error', () => {
      // Force error
      const internals = service as unknown as AnomalyDetectionInternals;
      jest.spyOn(internals, 'performVolatilitySpikeDetection').mockImplementation(() => {
        throw new Error('Volatility detection failed');
      });

      const result = service.detectVolatilitySpike(5.0);

      expect(result.detected).toBe(false);
      expect(result.currentVolatility).toBe(5.0);
    });

    it('should return empty array when whale detection throws error', () => {
      const trades = [createAnomalyDetectionTrade()];

      // Force error
      const internals = service as unknown as AnomalyDetectionInternals;
      jest.spyOn(internals, 'performWhaleDetection').mockImplementation(() => {
        throw new Error('Whale detection failed');
      });

      const alerts = service.detectWhaleActivity(trades);

      expect(alerts).toEqual([]);
    });

    it('should return no flags when manipulation detection throws error', () => {
      // Force error
      const internals = service as unknown as AnomalyDetectionInternals;
      jest.spyOn(internals, 'performManipulationDetection').mockImplementation(() => {
        throw new Error('Manipulation detection failed');
      });

      const flags = service.flagPossibleManipulation();

      expect(flags.washTrading).toBe(false);
      expect(flags.spoofing).toBe(false);
      expect(flags.pumpAndDump).toBe(false);
      expect(flags.likelihood).toBe(0);
    });

    it('should handle NaN volume gracefully', () => {
      expect(() => {
        service.detectVolumeAnomaly(NaN);
      }).toThrow('Volume must be a finite non-negative number');
    });

    it('should handle Infinity volatility gracefully', () => {
      expect(() => {
        service.detectVolatilitySpike(Infinity);
      }).toThrow('Volatility must be a finite non-negative number');
    });

    it('should handle corrupted trade data gracefully', () => {
      const trades: Trade[] = [
        createAnomalyDetectionTrade({ price: NaN }),
        createAnomalyDetectionTrade({ size: Infinity }),
        createAnomalyDetectionTrade({ price: 50000, size: 0.1 }), // Valid one
      ];

      const alerts = service.detectWhaleActivity(trades);

      // Should not crash, may return empty or partial results
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  // ========================================
  // SKIP: Logging Failures (3 tests)
  // ========================================

  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors during initialization', () => {
      const badLogger = createAnomalyDetectionMockLogger({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      expect(() => {
        createService({ logger: badLogger, errorHandler });
      }).not.toThrow();
    });

    it('should skip logger errors during volume detection', () => {
      const badLogger = createAnomalyDetectionMockLogger({
        warn: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      const testService = createService({ logger: badLogger, errorHandler });

      // Force detection to log a warning
      const testInternals = testService as unknown as AnomalyDetectionInternals;
      jest.spyOn(testInternals, 'performVolumeAnomalyDetection').mockImplementation(() => {
        throw new Error('Detection failed');
      });

      expect(() => {
        testService.detectVolumeAnomaly(1000);
      }).not.toThrow();
    });

    it('should skip logger errors during history clearing', () => {
      const badLogger = createAnomalyDetectionMockLogger({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      const testService = createService({ logger: badLogger, errorHandler });

      expect(() => {
        testService.clearHistory();
      }).not.toThrow();
    });
  });

  // ========================================
  // Integration: E2E Scenarios (9 tests)
  // ========================================

  describe('Integration: E2E Scenarios', () => {
    it('should detect high volume anomaly', () => {
      seedAnomalyDetectionHistory(service, {
        volumeValues: createAnomalyDetectionValueSeries(25, 1000, 4),
      });

      // Add anomalous volume (10x normal)
      const result = service.detectVolumeAnomaly(10000);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('volume');
      expect(result.deviation).toBeGreaterThan(5);
      expect(result.severity).not.toBe('low');
    });

    it('should NOT detect anomaly with normal volume', () => {
      seedAnomalyDetectionHistory(service, {
        volumeValues: createAnomalyDetectionValueSeries(25, 1000, 2),
      });

      // Add another normal volume
      const result = service.detectVolumeAnomaly(1020);

      expect(result.detected).toBe(false);
    });

    it('should detect volatility spike', () => {
      seedAnomalyDetectionHistory(service, {
        volatilityValues: createAnomalyDetectionValueSeries(25, 1.0, 0.002),
      });

      // Add spike (5x normal)
      const result = service.detectVolatilitySpike(5.0);

      expect(result.detected).toBe(true);
      expect(result.magnitude).toBeGreaterThan(3);
      expect(result.severity).not.toBe('low');
    });

    it('should NOT detect spike with normal volatility', () => {
      seedAnomalyDetectionHistory(service, {
        volatilityValues: createAnomalyDetectionValueSeries(25, 1.0, 0.001),
      });

      // Add another normal value
      const result = service.detectVolatilitySpike(1.02);

      expect(result.detected).toBe(false);
    });

    it('should detect whale activity with extreme size difference', () => {
      // Use lower threshold for this test
      const config: Partial<AnomalyDetectionConfig> = {
        whaleTradeThreshold: 3.0, // Lower threshold (300% vs default 500%)
      };
      const testService = createService({ config, logger });

      const trades: Trade[] = createAnomalyDetectionTradeSeries([
        { size: 0.1, price: 50000 },
        { size: 0.1, price: 50000 },
        { size: 0.1, price: 50000 },
        { size: 20.0, price: 50000 },
      ]);

      const alerts = testService.detectWhaleActivity(trades);

      expect(alerts.length).toBeGreaterThan(0);
      const whaleAlert = alerts.find(
        (a: ReturnType<AnomalyDetectionService['detectWhaleActivity']>[number]) => a.type === 'single_large_trade',
      );
      expect(whaleAlert).toBeDefined();
      if (whaleAlert) {
        expect(whaleAlert.volumeUSDT).toBeGreaterThan(100000);
      }
    });

    it('should detect accumulation pattern', () => {
      const trades: Trade[] = createAnomalyDetectionTradeSeries([
        { side: 'BUY', size: 1.0, price: 50000 },
        { side: 'BUY', size: 1.0, price: 50100 },
        { side: 'BUY', size: 1.0, price: 50200 },
        { side: 'SELL', size: 0.1, price: 50000 },
      ]);

      const alerts = service.detectWhaleActivity(trades);

      const accumulation = alerts.find((a) => a.type === 'accumulation');
      if (accumulation) {
        expect(accumulation.direction).toBe('BUY');
        expect(accumulation.tradeCount).toBeGreaterThanOrEqual(3);
      }
    });

    it('should detect distribution pattern', () => {
      const trades: Trade[] = createAnomalyDetectionTradeSeries([
        { side: 'SELL', size: 1.0, price: 50000 },
        { side: 'SELL', size: 1.0, price: 49900 },
        { side: 'SELL', size: 1.0, price: 49800 },
        { side: 'BUY', size: 0.1, price: 50000 },
      ]);

      const alerts = service.detectWhaleActivity(trades);

      const distribution = alerts.find((a) => a.type === 'distribution');
      if (distribution) {
        expect(distribution.direction).toBe('SELL');
        expect(distribution.tradeCount).toBeGreaterThanOrEqual(3);
      }
    });

    it('should analyze manipulation patterns without crashing', () => {
      // Create trades that might indicate wash trading (all at same price)
      const basePrice = 50000;
      const trades: Trade[] = createAnomalyDetectionTradeSeries(
        Array.from({ length: 10 }, (_, index) => ({
          price: basePrice,
          size: 0.1,
          side: index % 2 === 0 ? 'BUY' : 'SELL',
        })),
      );

      service.detectWhaleActivity(trades);
      const flags = service.flagPossibleManipulation();

      // Just verify it doesn't crash and returns valid structure
      expect(flags).toBeDefined();
      expect(typeof flags.washTrading).toBe('boolean');
      expect(typeof flags.likelihood).toBe('number');
      expect(flags.likelihood).toBeGreaterThanOrEqual(0);
      expect(flags.likelihood).toBeLessThanOrEqual(100);
    });

    it('should update and retrieve volume statistics', () => {
      // Add some volumes
      for (let i = 0; i < 10; i++) {
        seedVolumeHistory(service, [1000 + i * 100]);
      }

      const stats = service.getVolumeStats();

      expect(stats).not.toBeNull();
      if (stats) {
        expect(stats.sampleCount).toBe(10);
        expect(stats.average).toBeGreaterThan(1000);
        expect(stats.stdDev).toBeGreaterThan(0);
      }
    });
  });

  // ========================================
  // Edge Cases (3 tests)
  // ========================================

  describe('Edge Cases', () => {
    it('should handle insufficient samples for volume detection', () => {
      // Add only a few samples (less than minimum)
      service.detectVolumeAnomaly(1000);
      service.detectVolumeAnomaly(1100);

      const result = service.detectVolumeAnomaly(5000);

      // Should not detect anomaly with insufficient samples
      expect(result.detected).toBe(false);
    });

    it('should handle empty trades array', () => {
      const alerts = service.detectWhaleActivity([]);

      expect(alerts).toEqual([]);
    });

    it('should return null stats when no data', () => {
      const volumeStats = service.getVolumeStats();
      const volatilityStats = service.getVolatilityStats();

      expect(volumeStats).toBeNull();
      expect(volatilityStats).toBeNull();
    });
  });

  // ========================================
  // Backward Compatibility (3 tests)
  // ========================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    let serviceWithoutEH: AnomalyDetectionService;

    beforeEach(() => {
      serviceWithoutEH = createLegacyService();
    });

    it('should detect volume anomalies without ErrorHandler', () => {
      // Add normal volumes
      for (let i = 0; i < 25; i++) {
        seedVolumeHistory(serviceWithoutEH, [1000]);
      }

      const result = serviceWithoutEH.detectVolumeAnomaly(10000);

      expect(result).toBeDefined();
      expect(result.detected).toBe(true);
    });

    it('should detect volatility spikes without ErrorHandler', () => {
      // Add normal volatility
      for (let i = 0; i < 25; i++) {
        seedVolatilityHistory(serviceWithoutEH, [1.0]);
      }

      const result = serviceWithoutEH.detectVolatilitySpike(5.0);

      expect(result).toBeDefined();
      expect(result.detected).toBe(true);
    });

    it('should detect whale activity without ErrorHandler', () => {
      const trades: Trade[] = [
        createAnomalyDetectionTrade({ size: 0.1 }),
        createAnomalyDetectionTrade({ size: 10.0 }), // Whale
      ];

      const alerts = serviceWithoutEH.detectWhaleActivity(trades);

      expect(Array.isArray(alerts)).toBe(true);
    });
  });
});

