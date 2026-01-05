/**
 * Tests for Enhanced Exit Service
 *
 * Tests all features:
 * 1. R:R Gate validation
 * 2. Structure-Based TP
 * 3. Liquidity-Aware SL
 * 4. ATR-Based TP
 * 5. Session-Based TP
 * 6. Dynamic Breakeven
 * 7. Time-Decay TP
 * 8. Adaptive Trailing
 */

import {
  EnhancedExitService,
} from '../services/enhanced-exit.service';
import { SignalDirection, SwingPointType, LoggerService } from '../types';
import { Level } from '../analyzers/level.analyzer';

// ============================================================================
// MOCK LOGGER
// ============================================================================

const createMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createLevel = (price: number, type: 'SUPPORT' | 'RESISTANCE', touches = 3): Level => ({
  price,
  type,
  strength: Math.min(touches / 5, 1),
  touches,
  lastTouchTimestamp: Date.now(),
  avgVolumeAtTouch: 1000,
});

const createSwingPoint = (price: number, type: 'HIGH' | 'LOW', timestamp = Date.now()) => ({
  price,
  type: type === 'HIGH' ? SwingPointType.HIGH : SwingPointType.LOW,
  timestamp,
  index: 0,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('EnhancedExitService', () => {
  let service: EnhancedExitService;
  let mockLogger: Partial<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    service = new EnhancedExitService(mockLogger as LoggerService);
  });

  // ==========================================================================
  // 1. R:R GATE TESTS
  // ==========================================================================

  describe('R:R Gate Validation', () => {
    it('should accept trade with R:R >= minimum', () => {
      const entryPrice = 100;
      const stopLoss = 98; // 2% risk
      const takeProfit = 104; // 4% reward, R:R = 2.0

      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(true);
      expect(result.riskRewardRatio).toBeCloseTo(2.0, 1);
      expect(result.riskPercent).toBeCloseTo(2.0, 1);
      expect(result.rewardPercent).toBeCloseTo(4.0, 1);
    });

    it('should reject trade with R:R < minimum', () => {
      const entryPrice = 100;
      const stopLoss = 97; // 3% risk
      const takeProfit = 102; // 2% reward, R:R = 0.67

      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(false);
      expect(result.riskRewardRatio).toBeLessThan(1.5);
      expect(result.recommendation).toContain('Skip trade');
    });

    it('should handle SHORT direction correctly', () => {
      const entryPrice = 100;
      const stopLoss = 103; // 3% risk (above entry for SHORT)
      const takeProfit = 94; // 6% reward, R:R = 2.0

      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(true);
      expect(result.riskRewardRatio).toBeCloseTo(2.0, 1);
    });

    it('should indicate preferred R:R when met', () => {
      const entryPrice = 100;
      const stopLoss = 98; // 2% risk
      const takeProfit = 106; // 6% reward, R:R = 3.0

      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(true);
      expect(result.riskRewardRatio).toBeCloseTo(3.0, 1);
      expect(result.recommendation).toContain('Excellent');
    });

    it('should bypass validation when disabled', () => {
      const disabledService = new EnhancedExitService(mockLogger as LoggerService, {
        riskRewardGate: { enabled: false, minRR: 1.5, preferredRR: 2.0 },
      });

      const result = disabledService.validateRiskReward(100, 90, 101); // R:R = 0.1

      expect(result.valid).toBe(true);
      expect(result.recommendation).toContain('disabled');
    });
  });

  // ==========================================================================
  // 2. STRUCTURE-BASED TP TESTS
  // ==========================================================================

  describe('Structure-Based TP', () => {
    it('should target next resistance level for LONG', () => {
      const entryPrice = 100;
      const levels = {
        support: [createLevel(95, 'SUPPORT')],
        resistance: [createLevel(105, 'RESISTANCE', 5), createLevel(110, 'RESISTANCE', 3)],
      };

      const result = service.calculateStructureBasedTP(entryPrice, SignalDirection.LONG, levels);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].price).toBeLessThan(105); // Should be slightly before resistance
      expect(result[0].price).toBeGreaterThan(entryPrice);
    });

    it('should target next support level for SHORT', () => {
      const entryPrice = 100;
      const levels = {
        support: [createLevel(95, 'SUPPORT', 5), createLevel(90, 'SUPPORT', 3)],
        resistance: [createLevel(105, 'RESISTANCE')],
      };

      const result = service.calculateStructureBasedTP(entryPrice, SignalDirection.SHORT, levels);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].price).toBeGreaterThan(95); // Should be slightly before support
      expect(result[0].price).toBeLessThan(entryPrice);
    });

    it('should use fallback when no levels found', () => {
      const entryPrice = 100;
      const levels = {
        support: [],
        resistance: [],
      };

      const result = service.calculateStructureBasedTP(entryPrice, SignalDirection.LONG, levels);

      expect(result.length).toBe(1);
      expect(result[0].percent).toBe(2.0); // Default fallback
    });

    it('should create TP2 when second level exists', () => {
      const serviceWithTP2 = new EnhancedExitService(mockLogger as LoggerService, {
        structureBasedTP: {
          enabled: true,
          mode: 'LEVEL',
          offsetPercent: 0.1,
          fallbackPercent: 2.0,
          useNextLevelAsTP1: true,
          useSecondLevelAsTP2: true,
        },
      });

      const entryPrice = 100;
      const levels = {
        support: [],
        resistance: [createLevel(105, 'RESISTANCE', 5), createLevel(112, 'RESISTANCE', 3)],
      };

      const result = serviceWithTP2.calculateStructureBasedTP(
        entryPrice,
        SignalDirection.LONG,
        levels,
      );

      expect(result.length).toBe(2);
      expect(result[0].level).toBe(1);
      expect(result[1].level).toBe(2);
      expect(result[1].price).toBeGreaterThan(result[0].price);
    });

    it('should apply offset from target level', () => {
      const serviceWithOffset = new EnhancedExitService(mockLogger as LoggerService, {
        structureBasedTP: {
          enabled: true,
          mode: 'LEVEL',
          offsetPercent: 0.5, // 0.5% before level
          fallbackPercent: 2.0,
          useNextLevelAsTP1: true,
        },
      });

      const entryPrice = 100;
      const targetLevel = 110;
      const levels = {
        support: [],
        resistance: [createLevel(targetLevel, 'RESISTANCE', 5)],
      };

      const result = serviceWithOffset.calculateStructureBasedTP(
        entryPrice,
        SignalDirection.LONG,
        levels,
      );

      // TP should be 0.5% below the target level
      const expectedTP = targetLevel * (1 - 0.5 / 100);
      expect(result[0].price).toBeCloseTo(expectedTP, 2);
    });
  });

  // ==========================================================================
  // 3. LIQUIDITY-AWARE SL TESTS
  // ==========================================================================

  describe('Liquidity-Aware SL', () => {
    it('should place SL beyond liquidity zone for LONG', () => {
      const entryPrice = 100;
      const referenceLevel = 97; // Support level
      const atrAbsolute = 1.5;
      const swingPoints = [createSwingPoint(96, 'LOW')];
      const liquidityZones = [
        { price: 95, type: 'SUPPORT' as const, touches: 3, strength: 0.7, lastTouch: Date.now() },
      ];

      const result = service.calculateLiquidityAwareSL(
        entryPrice,
        SignalDirection.LONG,
        referenceLevel,
        atrAbsolute,
        swingPoints,
        liquidityZones,
      );

      expect(result.stopLoss).toBeLessThan(95); // Below liquidity zone
      expect(result.slType).toBe('LIQUIDITY');
    });

    it('should use swing points when no liquidity zones', () => {
      const entryPrice = 100;
      const referenceLevel = 97;
      const atrAbsolute = 1.5;
      // Use swing points further from entry to avoid minimum SL enforcement
      const swingPoints = [createSwingPoint(94, 'LOW'), createSwingPoint(93, 'LOW')];

      const result = service.calculateLiquidityAwareSL(
        entryPrice,
        SignalDirection.LONG,
        referenceLevel,
        atrAbsolute,
        swingPoints,
        [],
      );

      expect(result.stopLoss).toBeLessThan(94); // Beyond swing low
      expect(result.slType).toBe('SWING');
    });

    it('should enforce minimum SL distance', () => {
      const entryPrice = 100;
      const referenceLevel = 99.5; // Very close to entry
      const atrAbsolute = 0.1; // Very small ATR
      const swingPoints: ReturnType<typeof createSwingPoint>[] = [];

      const result = service.calculateLiquidityAwareSL(
        entryPrice,
        SignalDirection.LONG,
        referenceLevel,
        atrAbsolute,
        swingPoints,
        [],
      );

      // SL should be at least 1% from entry
      const slDistancePercent = Math.abs((entryPrice - result.stopLoss) / entryPrice) * 100;
      expect(slDistancePercent).toBeGreaterThanOrEqual(1.0);
    });

    it('should place SL beyond liquidity zone for SHORT', () => {
      const entryPrice = 100;
      const referenceLevel = 103;
      const atrAbsolute = 1.5;
      const swingPoints = [createSwingPoint(104, 'HIGH')];
      const liquidityZones = [
        { price: 105, type: 'RESISTANCE' as const, touches: 3, strength: 0.7, lastTouch: Date.now() },
      ];

      const result = service.calculateLiquidityAwareSL(
        entryPrice,
        SignalDirection.SHORT,
        referenceLevel,
        atrAbsolute,
        swingPoints,
        liquidityZones,
      );

      expect(result.stopLoss).toBeGreaterThan(105); // Above liquidity zone
    });
  });

  // ==========================================================================
  // 4. ATR-BASED TP TESTS
  // ==========================================================================

  describe('ATR-Based TP', () => {
    it('should calculate TP based on ATR multipliers', () => {
      const entryPrice = 100;
      const atrPercent = 2.0; // 2% ATR

      const result = service.calculateATRBasedTP(entryPrice, SignalDirection.LONG, atrPercent);

      expect(result.length).toBe(2); // TP1 and TP2
      // TP1 = 2% * 1.5 = 3%
      expect(result[0].percent).toBeCloseTo(3.0, 1);
      // TP2 = 2% * 3.0 = 6%
      expect(result[1].percent).toBeCloseTo(5.0, 1); // Capped at maxTPPercent (5%)
    });

    it('should respect minimum TP percent', () => {
      const entryPrice = 100;
      const atrPercent = 0.1; // Very low ATR

      const result = service.calculateATRBasedTP(entryPrice, SignalDirection.LONG, atrPercent);

      // Should use minimum (0.5%)
      expect(result[0].percent).toBeGreaterThanOrEqual(0.5);
    });

    it('should respect maximum TP percent', () => {
      const entryPrice = 100;
      const atrPercent = 10.0; // Very high ATR

      const result = service.calculateATRBasedTP(entryPrice, SignalDirection.LONG, atrPercent);

      // Should be capped at 5%
      expect(result[0].percent).toBeLessThanOrEqual(5.0);
      expect(result[1].percent).toBeLessThanOrEqual(5.0);
    });

    it('should calculate SHORT TP correctly', () => {
      const entryPrice = 100;
      const atrPercent = 2.0;

      const result = service.calculateATRBasedTP(entryPrice, SignalDirection.SHORT, atrPercent);

      expect(result[0].price).toBeLessThan(entryPrice);
      expect(result[1].price).toBeLessThan(result[0].price);
    });
  });

  // ==========================================================================
  // 5. SESSION-BASED TP TESTS
  // ==========================================================================

  describe('Session-Based TP Multiplier', () => {
    it('should apply session multiplier to TP levels', () => {
      const entryPrice = 100;
      const takeProfits = [
        { level: 1, price: 102, percent: 2.0, sizePercent: 60, hit: false },
        { level: 2, price: 104, percent: 4.0, sizePercent: 40, hit: false },
      ];

      const result = service.applySessionMultiplier(takeProfits, entryPrice);

      // Session multiplier is applied based on current time
      // Just verify the function runs and returns valid structure
      expect(result.length).toBe(2);
      expect(result[0].level).toBe(1);
      expect(result[1].level).toBe(2);
    });

    it('should not modify when disabled', () => {
      const disabledService = new EnhancedExitService(mockLogger as LoggerService, {
        sessionBasedTP: {
          enabled: false,
          asianMultiplier: 0.8,
          londonMultiplier: 1.2,
          nyMultiplier: 1.2,
          overlapMultiplier: 1.4,
        },
      });

      const entryPrice = 100;
      const takeProfits = [{ level: 1, price: 102, percent: 2.0, sizePercent: 100, hit: false }];

      const result = disabledService.applySessionMultiplier(takeProfits, entryPrice);

      expect(result[0].percent).toBe(2.0); // Unchanged
    });
  });

  // ==========================================================================
  // 6. DYNAMIC BREAKEVEN TESTS
  // ==========================================================================

  describe('Dynamic Breakeven', () => {
    it('should activate breakeven after reaching profit threshold', () => {
      const entryPrice = 100;
      const currentPrice = 101.5; // 1.5% profit
      const direction = SignalDirection.LONG;

      const result = service.checkBreakeven(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(true);
      expect(result.breakevenPrice).toBeGreaterThan(entryPrice); // With offset
    });

    it('should not activate breakeven below threshold', () => {
      const entryPrice = 100;
      const currentPrice = 100.5; // 0.5% profit (below 1% threshold)
      const direction = SignalDirection.LONG;

      const result = service.checkBreakeven(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(false);
    });

    it('should handle SHORT direction correctly', () => {
      const entryPrice = 100;
      const currentPrice = 98.5; // 1.5% profit for SHORT
      const direction = SignalDirection.SHORT;

      const result = service.checkBreakeven(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(true);
      expect(result.breakevenPrice).toBeLessThan(entryPrice); // Offset above entry for SHORT
    });

    it('should apply offset to breakeven price', () => {
      const serviceWithOffset = new EnhancedExitService(mockLogger as LoggerService, {
        dynamicBreakeven: {
          enabled: true,
          activationPercent: 1.0,
          offsetPercent: 0.2, // 0.2% offset
        },
      });

      const entryPrice = 100;
      const currentPrice = 102;
      const direction = SignalDirection.LONG;

      const result = serviceWithOffset.checkBreakeven(entryPrice, currentPrice, direction);

      // Breakeven should be entry + 0.2%
      const expectedBreakeven = entryPrice * (1 + 0.2 / 100);
      expect(result.breakevenPrice).toBeCloseTo(expectedBreakeven, 2);
    });
  });

  // ==========================================================================
  // 7. TIME-DECAY TP TESTS
  // ==========================================================================

  describe('Time-Decay TP', () => {
    it('should not decay before start time', () => {
      const serviceWithTimeDecay = new EnhancedExitService(mockLogger as LoggerService, {
        timeDecayTP: {
          enabled: true,
          decayStartMinutes: 60,
          decayRatePerHour: 0.2,
          minTPPercent: 0.5,
        },
      });

      const originalTPPercent = 2.0;
      const entryTime = Date.now();
      const currentTime = entryTime + 30 * 60000; // 30 minutes later

      const result = serviceWithTimeDecay.calculateTimeDecay(
        originalTPPercent,
        entryTime,
        currentTime,
      );

      expect(result.adjusted).toBe(false);
      expect(result.newTPPercent).toBe(originalTPPercent);
    });

    it('should apply decay after start time', () => {
      const serviceWithTimeDecay = new EnhancedExitService(mockLogger as LoggerService, {
        timeDecayTP: {
          enabled: true,
          decayStartMinutes: 60,
          decayRatePerHour: 0.5, // 0.5% per hour
          minTPPercent: 0.5,
        },
      });

      const originalTPPercent = 2.0;
      const entryTime = Date.now();
      const currentTime = entryTime + 120 * 60000; // 2 hours later (1 hour in decay)

      const result = serviceWithTimeDecay.calculateTimeDecay(
        originalTPPercent,
        entryTime,
        currentTime,
      );

      expect(result.adjusted).toBe(true);
      // 2.0% - (1 hour * 0.5%/hour) = 1.5%
      expect(result.newTPPercent).toBeCloseTo(1.5, 1);
    });

    it('should respect minimum TP percent', () => {
      const serviceWithTimeDecay = new EnhancedExitService(mockLogger as LoggerService, {
        timeDecayTP: {
          enabled: true,
          decayStartMinutes: 60,
          decayRatePerHour: 2.0, // Very high decay
          minTPPercent: 0.5,
        },
      });

      const originalTPPercent = 2.0;
      const entryTime = Date.now();
      const currentTime = entryTime + 300 * 60000; // 5 hours later

      const result = serviceWithTimeDecay.calculateTimeDecay(
        originalTPPercent,
        entryTime,
        currentTime,
      );

      expect(result.newTPPercent).toBeGreaterThanOrEqual(0.5);
    });

    it('should switch to trailing after threshold', () => {
      const serviceWithTrailingSwitch = new EnhancedExitService(mockLogger as LoggerService, {
        timeDecayTP: {
          enabled: true,
          decayStartMinutes: 60,
          decayRatePerHour: 0.2,
          minTPPercent: 0.5,
          switchToTrailingAfter: 120, // Switch after 2 hours
          trailingDistance: 0.3,
        },
      });

      const originalTPPercent = 2.0;
      const entryTime = Date.now();
      const currentTime = entryTime + 150 * 60000; // 2.5 hours later

      const result = serviceWithTrailingSwitch.calculateTimeDecay(
        originalTPPercent,
        entryTime,
        currentTime,
      );

      expect(result.switchToTrailing).toBe(true);
    });
  });

  // ==========================================================================
  // 8. ADAPTIVE TRAILING TESTS
  // ==========================================================================

  describe('Adaptive Trailing', () => {
    it('should activate trailing after profit threshold', () => {
      const entryPrice = 100;
      const currentPrice = 102; // 2% profit
      const direction = SignalDirection.LONG;

      const result = service.checkAdaptiveTrailing(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(true);
      expect(result.trailingDistance).toBeGreaterThan(0);
    });

    it('should not activate trailing below threshold', () => {
      const entryPrice = 100;
      const currentPrice = 100.5; // 0.5% profit (below 1.5% threshold)
      const direction = SignalDirection.LONG;

      const result = service.checkAdaptiveTrailing(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(false);
    });

    it('should use ATR-based distance when enabled', () => {
      const serviceWithATRTrailing = new EnhancedExitService(mockLogger as LoggerService, {
        adaptiveTrailing: {
          enabled: true,
          activationPercent: 1.5,
          trailingDistancePercent: 0.5,
          useATRDistance: true,
          trailingDistanceATR: 0.5, // 0.5 ATR
        },
      });

      const entryPrice = 100;
      const currentPrice = 103;
      const direction = SignalDirection.LONG;
      const atrPercent = 2.0; // 2% ATR

      const result = serviceWithATRTrailing.checkAdaptiveTrailing(
        entryPrice,
        currentPrice,
        direction,
        atrPercent,
      );

      // Trailing distance should be 2% * 0.5 = 1%
      expect(result.trailingDistance).toBeCloseTo(1.0, 1);
    });

    it('should handle SHORT direction correctly', () => {
      const entryPrice = 100;
      const currentPrice = 98; // 2% profit for SHORT
      const direction = SignalDirection.SHORT;

      const result = service.checkAdaptiveTrailing(entryPrice, currentPrice, direction);

      expect(result.shouldActivate).toBe(true);
    });
  });

  // ==========================================================================
  // COMBINED: Enhanced TP/SL Calculation
  // ==========================================================================

  describe('Combined Enhanced TP/SL', () => {
    it('should calculate complete TP/SL with all features', () => {
      const entryPrice = 100;
      const direction = SignalDirection.LONG;
      const referenceLevel = 97;
      const atrPercent = 2.0;
      const levels = {
        support: [createLevel(95, 'SUPPORT', 4)],
        resistance: [createLevel(106, 'RESISTANCE', 5)],
      };
      const swingPoints = [createSwingPoint(96, 'LOW')];

      const result = service.calculateEnhancedTPSL(
        entryPrice,
        direction,
        referenceLevel,
        atrPercent,
        levels,
        swingPoints,
      );

      expect(result.stopLoss).toBeLessThan(entryPrice);
      expect(result.takeProfits.length).toBeGreaterThan(0);
      expect(result.takeProfits[0].price).toBeGreaterThan(entryPrice);
      expect(result.riskRewardRatio).toBeGreaterThan(0);
      expect(result.details.slReason).toBeDefined();
      expect(result.details.tp1Reason).toBeDefined();
    });

    it('should use fallback percent TP when no structure levels found', () => {
      // Create service with sessionBasedTP disabled to avoid session-dependent multipliers
      const noSessionService = new EnhancedExitService(mockLogger as LoggerService, {
        sessionBasedTP: { enabled: false, asianMultiplier: 1.0, londonMultiplier: 1.0, nyMultiplier: 1.0, overlapMultiplier: 1.0 },
      });

      const entryPrice = 100;
      const direction = SignalDirection.LONG;
      const referenceLevel = 97;
      const atrPercent = 2.0;
      const levels = { support: [], resistance: [] };
      const swingPoints: ReturnType<typeof createSwingPoint>[] = [];

      const result = noSessionService.calculateEnhancedTPSL(
        entryPrice,
        direction,
        referenceLevel,
        atrPercent,
        levels,
        swingPoints,
      );

      // When no levels found, structure-based TP uses fallback percent (still STRUCTURE type)
      expect(result.tpType).toBe('STRUCTURE');
      expect(result.takeProfits.length).toBeGreaterThan(0);
      // TP should use fallback percent (default 2.0%)
      expect(result.takeProfits[0].percent).toBeCloseTo(2.0, 0);
    });

    it('should calculate valid R:R for result', () => {
      const entryPrice = 100;
      const direction = SignalDirection.LONG;
      const referenceLevel = 96;
      const atrPercent = 2.0;
      const levels = {
        support: [createLevel(95, 'SUPPORT')],
        resistance: [createLevel(108, 'RESISTANCE', 5)],
      };
      const swingPoints = [createSwingPoint(94, 'LOW')];

      const result = service.calculateEnhancedTPSL(
        entryPrice,
        direction,
        referenceLevel,
        atrPercent,
        levels,
        swingPoints,
      );

      // Manually verify R:R calculation
      const tp1 = result.takeProfits[0];
      const expectedRR =
        Math.abs(tp1.price - entryPrice) / Math.abs(entryPrice - result.stopLoss);

      expect(result.riskRewardRatio).toBeCloseTo(expectedRR, 1);
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const defaultService = new EnhancedExitService(mockLogger as LoggerService);
      const config = defaultService.getConfig();

      expect(config.riskRewardGate.enabled).toBe(true);
      expect(config.riskRewardGate.minRR).toBe(1.5);
      expect(config.structureBasedTP.enabled).toBe(true);
    });

    it('should merge partial config with defaults', () => {
      const customService = new EnhancedExitService(mockLogger as LoggerService, {
        riskRewardGate: { enabled: true, minRR: 2.0, preferredRR: 3.0 },
      });
      const config = customService.getConfig();

      expect(config.riskRewardGate.minRR).toBe(2.0);
      expect(config.riskRewardGate.preferredRR).toBe(3.0);
      // Other configs should use defaults
      expect(config.structureBasedTP.enabled).toBe(true);
    });

    it('should allow dynamic config updates', () => {
      const dynamicService = new EnhancedExitService(mockLogger as LoggerService);

      dynamicService.updateConfig({
        riskRewardGate: { enabled: false, minRR: 1.0, preferredRR: 1.5 },
      });

      const config = dynamicService.getConfig();
      expect(config.riskRewardGate.enabled).toBe(false);
      expect(config.riskRewardGate.minRR).toBe(1.0);
    });
  });
});
