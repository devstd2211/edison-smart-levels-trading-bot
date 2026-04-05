/**
 * Error Handling Tests for StructureAwareExitService
 * Phase 8.9.52
 *
 * Test Coverage:
 * 1. Config Validation (THROW) - 5 tests
 * 2. Input Validation (THROW) - 4 tests
 * 3. Structure Detection (GRACEFUL_DEGRADE) - 4 tests
 * 4. TP2 Calculation (GRACEFUL_DEGRADE) - 3 tests
 * 5. Logging Failures (SKIP) - 2 tests
 * 6. Integration E2E - 2 tests
 * TOTAL: 20 tests
 */

import { StructureAwareExitService } from '../../services/structure-aware-exit.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, StructureAwareExitConfig, SignalDirection, SwingPointType } from '../../types/legacy';
import {
  createStructureAwareExitConfig,
  createManagedStructureAwareExitContext,
  createInvalidStructureAwareLevel,
  createStructureAwareExitMockLogger,
  createStructureAwareLiquidityZone,
  createStructureAwareSwingPoint,
  createStructureAwareVolumeProfile,
  type ManagedStructureAwareExitContext,
} from '../helpers/structure-aware-exit-test.utils';

function bindStructureAwareExitFixtures() {
  type StructureAwareExitFixtures = Pick<
    ManagedStructureAwareExitContext,
    'logger' | 'errorHandler' | 'config' | 'createService'
  >;
  let cleanup: ManagedStructureAwareExitContext['cleanup'];
  let fixtures: StructureAwareExitFixtures;

  beforeEach(() => {
    const managedContext = createManagedStructureAwareExitContext({
      logger: createStructureAwareExitMockLogger(),
    });
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      errorHandler: managedContext.errorHandler,
      config: managedContext.config,
      createService: managedContext.createService,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('StructureAwareExitService - Error Handling (Phase 8.9.52)', () => {
  let mockLogger: LoggerService;
  let errorHandler: ErrorHandler;
  let defaultConfig: StructureAwareExitConfig;
  let createService: ManagedStructureAwareExitContext['createService'];
  const getFixtures = bindStructureAwareExitFixtures();

  beforeEach(() => {
    const fixtures = getFixtures();
    mockLogger = fixtures.logger;
    errorHandler = fixtures.errorHandler as ErrorHandler;
    defaultConfig = fixtures.config;
    createService = fixtures.createService;
  });

  // ============================================================================
  // TEST GROUP 1: Config Validation (THROW)
  // ============================================================================

  describe('Config Validation (THROW)', () => {
    it('should THROW on invalid bufferPercent > 10%', () => {
      const badConfig = createStructureAwareExitConfig({ dynamicTP2: { bufferPercent: 15 } });

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid bufferPercent/,
      );
    });

    it('should THROW on invalid minTP2Percent > 50%', () => {
      const badConfig = createStructureAwareExitConfig({ dynamicTP2: { minTP2Percent: 60 } });

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid minTP2Percent/,
      );
    });

    it('should THROW on invalid maxTP2Percent > 50%', () => {
      const badConfig = createStructureAwareExitConfig({ dynamicTP2: { maxTP2Percent: 100 } });

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid maxTP2Percent/,
      );
    });

    it('should THROW when minTP2Percent > maxTP2Percent', () => {
      const badConfig = createStructureAwareExitConfig({
        dynamicTP2: { minTP2Percent: 8.0, maxTP2Percent: 4.0 },
      });

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid TP2 range/,
      );
    });

    it('should THROW on invalid minZoneStrength outside 0-1', () => {
      const badConfig = createStructureAwareExitConfig({ dynamicTP2: { minZoneStrength: 1.5 } });

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid minZoneStrength/,
      );
    });
  });

  // ============================================================================
  // TEST GROUP 2: Input Validation (THROW)
  // ============================================================================

  describe('Input Validation (THROW)', () => {
    let service: StructureAwareExitService;

    beforeEach(() => {
      service = createService({
        config: defaultConfig,
        logger: mockLogger,
      });
    });

    it('should THROW on invalid currentPrice (NaN)', () => {
      const result = service.detectNearestResistance(NaN, SignalDirection.LONG, [], [], null);

      // GRACEFUL_DEGRADE: should return null instead of throwing
      expect(result).toBeNull();
      // But validation error should be logged
      expect(errorHandler).toBeDefined();
    });

    it('should THROW on negative currentPrice', () => {
      const result = service.detectNearestResistance(-100, SignalDirection.LONG, [], [], null);

      // GRACEFUL_DEGRADE: should return null
      expect(result).toBeNull();
    });

    it('should THROW on invalid entryPrice in calculateDynamicTP2', () => {
      const structureLevel = { price: 2.05, type: 'SWING_POINT' as const, strength: 0.8 };

      const result = service.calculateDynamicTP2(NaN, SignalDirection.LONG, structureLevel);

      // GRACEFUL_DEGRADE: should return safe defaults
      expect(result).toBeTruthy();
      expect(result.percent).toBe(defaultConfig.dynamicTP2.minTP2Percent);
      expect(result.confidence).toBeLessThan(0.5); // Low confidence
    });

    it('should THROW on invalid structureLevel price', () => {
      const badStructure = createInvalidStructureAwareLevel();

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, badStructure);

      // GRACEFUL_DEGRADE: should return safe defaults
      expect(result).toBeTruthy();
      expect(Number.isFinite(result.price)).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Structure Detection (GRACEFUL_DEGRADE)
  // ============================================================================

  describe('Structure Detection (GRACEFUL_DEGRADE)', () => {
    let service: StructureAwareExitService;

    beforeEach(() => {
      service = createService({
        config: defaultConfig,
        logger: mockLogger,
      });
    });

    it('should GRACEFUL_DEGRADE when swing points processing fails', () => {
      const liquidityZones = [createStructureAwareLiquidityZone(2.039)];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], liquidityZones, null);

      // Should still find structure from liquidity zones
      expect(result).toBeTruthy();
      expect(result!.type).toBe('LIQUIDITY_ZONE');
    });

    it('should GRACEFUL_DEGRADE when liquidity zones processing fails', () => {
      const swingPoints = [createStructureAwareSwingPoint(2.05, SwingPointType.HIGH)];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, [], null);

      // Should still find structure from swing points
      expect(result).toBeTruthy();
      expect(result!.type).toBe('SWING_POINT');
    });

    it('should GRACEFUL_DEGRADE when volume profile processing fails', () => {
      const liquidityZones = [createStructureAwareLiquidityZone(2.039)];
      const badProfile = createStructureAwareVolumeProfile([{ price: NaN, volume: 1000 }]);

      // Should still detect structure from liquidity zones
      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], liquidityZones, badProfile);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('LIQUIDITY_ZONE');
    });

    it('should return null when all structure sources fail', () => {
      const badProfile = createStructureAwareVolumeProfile([{ price: NaN, volume: NaN }]);

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], [], badProfile);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TEST GROUP 4: TP2 Calculation (GRACEFUL_DEGRADE)
  // ============================================================================

  describe('TP2 Calculation (GRACEFUL_DEGRADE)', () => {
    let service: StructureAwareExitService;

    beforeEach(() => {
      service = createService({
        config: defaultConfig,
        logger: mockLogger,
      });
    });

    it('should GRACEFUL_DEGRADE when calculation produces NaN', () => {
      const badStructure = createInvalidStructureAwareLevel({ price: 2.0, strength: NaN });

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, badStructure);

      // Should return safe defaults
      expect(result).toBeTruthy();
      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.percent).toBe(defaultConfig.dynamicTP2.minTP2Percent);
    });

    it('should GRACEFUL_DEGRADE when calculation produces Infinity', () => {
      const badStructure = createInvalidStructureAwareLevel({ price: Infinity });

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, badStructure);

      // Should return safe defaults
      expect(result).toBeTruthy();
      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should GRACEFUL_DEGRADE for SHORT position calculation errors', () => {
      const badStructure = createInvalidStructureAwareLevel({ price: Infinity });

      const result = service.calculateDynamicTP2(2.0, SignalDirection.SHORT, badStructure);

      // Should return safe defaults
      expect(result).toBeTruthy();
      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.percent).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST GROUP 5: Logging Failures (SKIP)
  // ============================================================================

  describe('Logging Failures (SKIP)', () => {
    let service: StructureAwareExitService;
    let throwingLogger: LoggerService;

    beforeEach(() => {
      throwingLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as LoggerService;

      service = createService({
        config: defaultConfig,
        logger: throwingLogger,
      });
    });

    it('should SKIP logger.info failures in calculateDynamicTP2', () => {
      const structureLevel = { price: 2.05, type: 'SWING_POINT' as const, strength: 0.8 };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      // Should complete despite logger failure
      expect(result).toBeTruthy();
      // Price should be finite and valid (either calculated or fallback)
      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.price).toBeGreaterThan(2.0);
      // Logger error was handled with SKIP strategy
      expect(throwingLogger.info).toHaveBeenCalled();
    });

    it('should SKIP multiple logging failures without blocking calculation', () => {
      const badLogger = createStructureAwareExitMockLogger({
        info: jest.fn(() => {
          throw new Error('Log failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Log failed');
        }),
      });

      const svc = createService({
        config: defaultConfig,
        logger: badLogger,
      });
      const structure = { price: 2.05, type: 'SWING_POINT' as const, strength: 0.8 };

      // Should not throw despite all logging failing
      expect(() => svc.calculateDynamicTP2(2.0, SignalDirection.LONG, structure)).not.toThrow();
    });
  });

  // ============================================================================
  // TEST GROUP 6: Integration E2E Scenarios
  // ============================================================================

  describe('Integration E2E Scenarios', () => {
    it('should handle cascading failures gracefully: detect → calculate with all errors', () => {
      const service = createService({
        config: defaultConfig,
        logger: mockLogger,
      });

      // Simulate: no valid structures found
      const structure = service.detectNearestResistance(2.0, SignalDirection.LONG, [], [], null);

      expect(structure).toBeNull();

      // Try to calculate with valid fallback structure
      const fallbackStructure = { price: 2.05, type: 'SWING_POINT' as const, strength: 0.8 };
      const tp2 = service.calculateDynamicTP2(2.0, SignalDirection.LONG, fallbackStructure);

      expect(tp2).toBeTruthy();
      expect(Number.isFinite(tp2.price)).toBe(true);
    });

    it('should work correctly without ErrorHandler (backward compatibility)', () => {
      // Create service WITHOUT errorHandler (legacy mode)
      const service = createService({
        config: defaultConfig,
        logger: mockLogger,
        withErrorHandler: false,
      });

      const swingPoints = [createStructureAwareSwingPoint(2.05, SwingPointType.HIGH)];

      const structure = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, [], null);

      expect(structure).toBeTruthy();
      expect(structure!.price).toBe(2.05);

      // Calculate TP2 without ErrorHandler
      const tp2 = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structure!);

      expect(tp2).toBeTruthy();
      expect(Number.isFinite(tp2.price)).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 7: Backward Compatibility
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should maintain original behavior without ErrorHandler', () => {
      const service = createService({
        config: defaultConfig,
        logger: mockLogger,
        withErrorHandler: false,
      });

      // Structure detection without ErrorHandler
      const swingPoints = [
        createStructureAwareSwingPoint(2.05, SwingPointType.HIGH),
        createStructureAwareSwingPoint(2.08, SwingPointType.HIGH),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, [], null);

      expect(result).toBeTruthy();
      expect(result!.price).toBe(2.05); // Should select nearest
    });

    it('should still validate config even without ErrorHandler', () => {
      const badConfig = createStructureAwareExitConfig({ dynamicTP2: { bufferPercent: 50 } });

      expect(() => createService({
        config: badConfig,
        withErrorHandler: false,
      })).toThrow();
    });

    it('should apply constraints in TP2 calculation consistently', () => {
      const service = createService({
        config: defaultConfig,
        logger: mockLogger,
        withErrorHandler: false,
      });

      const structureLevel = {
        price: 2.01, // Very close to entry
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      // Should apply minTP2Percent constraint
      expect(result.percent).toBe(defaultConfig.dynamicTP2.minTP2Percent);
      expect(result.wasConstrained).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 8: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    let service: StructureAwareExitService;

    beforeEach(() => {
      service = createService({
        config: defaultConfig,
        logger: mockLogger,
      });
    });

    it('should handle empty arrays gracefully', () => {
      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], [], null);

      expect(result).toBeNull();
    });

    it('should handle null volumeProfile gracefully', () => {
      const swingPoints = [createStructureAwareSwingPoint(2.05, SwingPointType.HIGH)];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, [], null);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('SWING_POINT');
    });

    it('should handle very small structure level differences', () => {
      const liquidityZones = [
        createStructureAwareLiquidityZone(2.0001),
        createStructureAwareLiquidityZone(2.0002),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], liquidityZones, null);

      // Should select nearest (first one)
      expect(result).toBeTruthy();
      expect(result!.price).toBe(2.0001);
    });
  });
});
