/**
 * Integration Tests for StructureAwareExitService
 *
 * Tests:
 * 1. Structure detection from multiple sources (swing points, liquidity zones, HVN)
 * 2. Priority ordering (Liquidity > HVN > Swings)
 * 3. Dynamic TP2 calculation with buffer and constraints
 * 4. Edge cases: no structure found, structure too close, structure too far
 */

import { StructureAwareExitService } from '../../services/structure-aware-exit.service';
import { LoggerService, SignalDirection, SwingPointType, StructureAwareExitConfig, LiquidityZone, SwingPoint } from '../../types/legacy';
import {
  createStructureAwareExitConfig,
  createManagedStructureAwareExitContext,
  createStructureAwareLiquidityZone,
  createStructureAwareSwingPoint,
  createStructureAwareVolumeProfile,
  ManagedStructureAwareExitContext,
} from '../helpers/structure-aware-exit-test.utils';

describe('StructureAwareExitService', () => {
  type StructureAwareExitRuntime = Pick<ManagedStructureAwareExitContext, 'logger'>;
  type StructureAwareExitFactories = Pick<ManagedStructureAwareExitContext, 'createService'>;
  type StructureAwareExitFixtures = {
    runtime: StructureAwareExitRuntime;
    factories: StructureAwareExitFactories;
  };
  let service: StructureAwareExitService;
  let mockLogger: LoggerService;
  let defaultConfig: StructureAwareExitConfig;
  let createService: StructureAwareExitFactories['createService'];
  let managedContext: ManagedStructureAwareExitContext;

  beforeEach(() => {
    defaultConfig = createStructureAwareExitConfig();
    managedContext = createManagedStructureAwareExitContext({
      config: defaultConfig,
      withErrorHandler: false,
    });
    const runtime: StructureAwareExitRuntime = {
      logger: managedContext.logger,
    };
    const factories: StructureAwareExitFactories = {
      createService: managedContext.createService,
    };
    ({ logger: mockLogger } = runtime);
    ({ createService } = factories);
    service = createService({
      config: defaultConfig,
      logger: mockLogger,
      withErrorHandler: false,
    });
  });

  afterEach(() => {
    managedContext.cleanup();
  });

  // ============================================================================
  // TEST GROUP 1: Structure Detection
  // ============================================================================

  describe('detectNearestResistance', () => {
    it('should find nearest swing high for LONG when no other sources available', () => {
      const swingPoints: SwingPoint[] = [
        createStructureAwareSwingPoint(2.05, SwingPointType.HIGH),
        createStructureAwareSwingPoint(2.08, SwingPointType.HIGH),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, [], null);

      expect(result).toBeTruthy();
      expect(result!.price).toBe(2.05);
      expect(result!.type).toBe('SWING_POINT');
      expect(result!.strength).toBe(0.5);
    });

    it('should prioritize liquidity zones over swing points', () => {
      const swingPoints: SwingPoint[] = [
        createStructureAwareSwingPoint(2.05, SwingPointType.HIGH),
      ];

      const liquidityZones: LiquidityZone[] = [
        createStructureAwareLiquidityZone(2.039),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, liquidityZones, null);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('LIQUIDITY_ZONE');
      expect(result!.price).toBe(2.039);
      expect(result!.strength).toBe(0.75);
    });

    it('should filter out weak liquidity zones below minZoneStrength', () => {
      const liquidityZones: LiquidityZone[] = [
        { ...createStructureAwareLiquidityZone(2.045), strength: 0.4, touches: 1 }, // Below minZoneStrength (0.6)
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], liquidityZones, null);

      expect(result).toBeNull(); // Weak zone filtered, no swing points
    });

    it('should find nearest structure among multiple candidates (proximity-based)', () => {
      const liquidityZones: LiquidityZone[] = [
        { ...createStructureAwareLiquidityZone(2.08), strength: 0.7, touches: 2 },
        createStructureAwareLiquidityZone(2.039),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], liquidityZones, null);

      expect(result).toBeTruthy();
      expect(result!.price).toBe(2.039); // Nearest, not 2.08
    });

    it('should detect SHORT support correctly (inverted logic)', () => {
      const swingPoints: SwingPoint[] = [
        createStructureAwareSwingPoint(1.95, SwingPointType.LOW),
        createStructureAwareSwingPoint(1.92, SwingPointType.LOW),
      ];

      const result = service.detectNearestResistance(2.0, SignalDirection.SHORT, swingPoints, [], null);

      expect(result).toBeTruthy();
      expect(result!.price).toBe(1.95); // Nearest LOW below 2.0
      expect(result!.type).toBe('SWING_POINT');
    });

    it('should return null when no suitable structures found', () => {
      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], [], null);

      expect(result).toBeNull();
    });

    it('should handle HVN levels from volume profile', () => {
      const volumeProfile = createStructureAwareVolumeProfile([
        { price: 2.045, volume: 1000 },
        { price: 2.05, volume: 2000 },
        { price: 2.06, volume: 500 },
      ]);

      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, [], [], volumeProfile);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('VOLUME_HVN');
      expect(result!.price).toBe(2.05); // Highest volume HVN that passes avg filter
    });
  });

  // ============================================================================
  // TEST GROUP 2: Dynamic TP2 Calculation
  // ============================================================================

  describe('calculateDynamicTP2', () => {
    it('should apply buffer correctly before resistance', () => {
      const structureLevel = {
        price: 2.1,
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      // TP2 = 2.1 - (2.1 * 0.004) = 2.0916
      expect(result.price).toBeCloseTo(2.0916, 4);
      expect(result.percent).toBeCloseTo(4.58, 1); // (2.0916 - 2.0) / 2.0 * 100
      expect(result.wasConstrained).toBe(false);
    });

    it('should apply minTP2Percent constraint when structure too close', () => {
      const structureLevel = {
        price: 2.01,
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      expect(result.percent).toBe(2.0); // Constrained to minTP2Percent
      expect(result.price).toBeCloseTo(2.04, 2); // 2.0 * 1.02
      expect(result.wasConstrained).toBe(true);
    });

    it('should apply maxTP2Percent constraint when structure too far', () => {
      const structureLevel = {
        price: 2.15,
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      expect(result.percent).toBe(6.0); // Constrained to maxTP2Percent
      expect(result.price).toBeCloseTo(2.12, 2); // 2.0 * 1.06
      expect(result.wasConstrained).toBe(true);
    });

    it('should work correctly for SHORT positions (inverted logic)', () => {
      const structureLevel = {
        price: 1.9,
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.SHORT, structureLevel);

      // TP2 = 1.9 + (1.9 * 0.004) = 1.9076
      expect(result.price).toBeCloseTo(1.9076, 4);
      expect(result.percent).toBeCloseTo(4.62, 1); // (2.0 - 1.9076) / 2.0 * 100
      expect(result.wasConstrained).toBe(false);
    });

    it('should return confidence from structure strength', () => {
      const structureLevel = {
        price: 2.039,
        type: 'LIQUIDITY_ZONE' as const,
        strength: 0.85,
      };

      const result = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      expect(result.confidence).toBe(0.85);
      expect(result.structureType).toBe('LIQUIDITY_ZONE');
    });

    it('should log calculation details', () => {
      const structureLevel = {
        price: 2.04,
        type: 'SWING_POINT' as const,
        strength: 0.8,
      };

      service.calculateDynamicTP2(2.0, SignalDirection.LONG, structureLevel);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dynamic TP2 calculated'),
        expect.objectContaining({
          entryPrice: expect.any(String),
          structurePrice: expect.any(String),
          tp2Percent: expect.any(String),
          wasConstrained: expect.any(String),
        }),
      );
    });
  });

  // ============================================================================
  // TEST GROUP 3: Trailing Stop Configuration
  // ============================================================================

  describe('trailing stop helpers', () => {
    it('should return true when trailing stop enabled', () => {
      const result = service.shouldActivateTrailing();
      expect(result).toBe(true);
    });

    it('should return false when trailing stop disabled', () => {
      const disabledConfig = createStructureAwareExitConfig({
        trailingStopAfterTP1: { enabled: false },
      });
      const disabledService = createService({
        config: disabledConfig,
        logger: mockLogger,
        withErrorHandler: false,
      });

      const result = disabledService.shouldActivateTrailing();
      expect(result).toBe(false);
    });

    it('should return correct trailing distance', () => {
      const result = service.getTrailingDistance();
      expect(result).toBe(0.8);
    });
  });

  // ============================================================================
  // TEST GROUP 4: Integration Scenarios
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle complete flow: detect structure → calculate TP2', () => {
      const swingPoints: SwingPoint[] = [
        createStructureAwareSwingPoint(2.05, SwingPointType.HIGH),
      ];

      const liquidityZones: LiquidityZone[] = [
        createStructureAwareLiquidityZone(2.039),
      ];

      // Step 1: Detect
      const structure = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, liquidityZones, null);

      expect(structure).toBeTruthy();
      expect(structure!.price).toBe(2.039);

      // Step 2: Calculate TP2
      const tp2 = service.calculateDynamicTP2(2.0, SignalDirection.LONG, structure!);

      // 2.039 - (2.039 * 0.004) = 2.03184, which is 1.592% - constrained to minTP2Percent (2.0%)
      // Final TP2 = 2.0 * 1.02 = 2.04
      expect(tp2.price).toBeCloseTo(2.04, 2);
      expect(tp2.percent).toBe(2.0); // Constrained to min
      expect(tp2.structureType).toBe('LIQUIDITY_ZONE');
      expect(tp2.confidence).toBe(0.75);
      expect(tp2.wasConstrained).toBe(true);
    });

    it('realistic scenario: stuck position example from bug report', () => {
      // Scenario: Entry at 2.00, Resistance at 2.0399
      const entryPrice = 2.0;
      const currentPrice = 2.0177;

      const liquidityZones: LiquidityZone[] = [
        createStructureAwareLiquidityZone(2.0399),
      ];

      // Detect structure
      const structure = service.detectNearestResistance(currentPrice, SignalDirection.LONG, [], liquidityZones, null);

      expect(structure).toBeTruthy();
      expect(structure!.price).toBeCloseTo(2.0399, 4);

      // Calculate dynamic TP2
      const tp2 = service.calculateDynamicTP2(entryPrice, SignalDirection.LONG, structure!);

      // Expected: 2.0399 - (2.0399 * 0.004) ≈ 2.0358
      // Calculated percent: (2.0358 - 2.0) / 2.0 * 100 ≈ 1.79%
      // This is less than minTP2Percent (2.0%), so it gets constrained
      expect(tp2.wasConstrained).toBe(true);
      expect(tp2.percent).toBe(2.0); // Constrained to min
      expect(tp2.price).toBeCloseTo(2.04, 2); // 2.0 * 1.02
    });

    it('should work with multiple structure sources (priority test)', () => {
      // Setup: Entry 2.0, all structure types available
      const swingPoints: SwingPoint[] = [
        createStructureAwareSwingPoint(2.08, SwingPointType.HIGH),
      ];

      const liquidityZones: LiquidityZone[] = [
        createStructureAwareLiquidityZone(2.039),
      ];

      const volumeProfile = createStructureAwareVolumeProfile([
        { price: 2.045, volume: 1000 },
        { price: 2.055, volume: 2000 },
      ]);

      // Should pick liquidity zone (highest priority among structures at similar distance)
      const result = service.detectNearestResistance(2.0, SignalDirection.LONG, swingPoints, liquidityZones, volumeProfile);

      expect(result!.type).toBe('LIQUIDITY_ZONE');
      expect(result!.price).toBe(2.039);
    });
  });
});
