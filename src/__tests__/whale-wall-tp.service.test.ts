/**
 * Tests for Whale Wall TP Service
 */

import { WhaleWallTPService, WhaleWallTPConfig } from '../services/whale-wall-tp.service';
import { SignalDirection, LoggerService, OrderBookWall } from '../types';

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

const createWall = (
  side: 'BID' | 'ASK',
  price: number,
  percentOfTotal: number,
  distance: number,
): OrderBookWall => ({
  side,
  price,
  quantity: 1000,
  percentOfTotal,
  distance,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('WhaleWallTPService', () => {
  let service: WhaleWallTPService;
  let mockLogger: Partial<LoggerService>;

  const defaultConfig: Partial<WhaleWallTPConfig> = {
    enabled: true,
    minWallPercent: 5,
    maxDistancePercent: 2.0,
    minDistancePercent: 0.3,
    tpTargeting: {
      enabled: true,
      alignmentThresholdPercent: 0.5,
      scaleToWall: true,
      minWallSizeForTP: 8,
    },
    slProtection: {
      enabled: true,
      moveSlBehindWall: true,
      bufferPercent: 0.1,
      minWallSizeForSL: 10,
    },
    qualityValidation: {
      enabled: false,
      rejectSpoofing: true,
      boostIceberg: true,
      icebergBoostFactor: 1.2,
      minStrength: 0.3,
    },
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    service = new WhaleWallTPService(mockLogger as LoggerService, defaultConfig);
  });

  // ==========================================================================
  // BASIC TESTS
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should return no adjustment when disabled', () => {
      const disabledService = new WhaleWallTPService(mockLogger as LoggerService, {
        enabled: false,
      });

      const result = disabledService.adjustTPSL([], 100, SignalDirection.LONG, 105, 95);

      expect(result.tpAdjusted).toBe(false);
      expect(result.slAdjusted).toBe(false);
    });

    it('should return no adjustment when no walls provided', () => {
      const result = service.adjustTPSL([], 100, SignalDirection.LONG, 105, 95);

      expect(result.tpAdjusted).toBe(false);
      expect(result.slAdjusted).toBe(false);
      expect(result.wallsAnalyzed).toBe(0);
    });

    it('should filter walls below minimum size', () => {
      const walls = [createWall('ASK', 105, 3, 5)]; // 3% < 5% min

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 108, 95);

      expect(result.qualifiedWalls).toBe(0);
    });

    it('should filter walls beyond max distance', () => {
      const walls = [createWall('ASK', 110, 10, 10)]; // 10% > 2% max distance

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 108, 95);

      expect(result.qualifiedWalls).toBe(0);
    });

    it('should filter walls too close', () => {
      const walls = [createWall('ASK', 100.1, 10, 0.1)]; // 0.1% < 0.3% min distance

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 108, 95);

      expect(result.qualifiedWalls).toBe(0);
    });
  });

  // ==========================================================================
  // TP TARGETING TESTS
  // ==========================================================================

  describe('TP Targeting', () => {
    it('should adjust TP to ASK wall for LONG trade', () => {
      const walls = [
        createWall('ASK', 101, 10, 1.0), // ASK wall at 101, 10% of volume, 1% distance
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 101.5, 95);

      // Wall at 101 is within alignment threshold of TP at 101.5
      expect(result.tpAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(101);
      expect(result.tpWall?.side).toBe('ASK');
    });

    it('should adjust TP to BID wall for SHORT trade', () => {
      const walls = [
        createWall('BID', 99, 10, 1.0), // BID wall at 99, 10% of volume, 1% distance
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.SHORT, 98.5, 105);

      // Wall at 99 is within alignment threshold of TP at 98.5
      expect(result.tpAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(99);
      expect(result.tpWall?.side).toBe('BID');
    });

    it('should scale TP to blocking wall', () => {
      const walls = [
        createWall('ASK', 101.5, 12, 1.5), // ASK wall at 101.5, between entry (100) and TP (105)
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 95);

      expect(result.tpAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(101.5);
      expect(result.tpReason).toContain('blocking');
    });

    it('should not adjust TP when wall is too small', () => {
      const walls = [
        createWall('ASK', 101, 6, 1.0), // 6% < 8% min for TP
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 101.5, 95);

      expect(result.tpAdjusted).toBe(false);
    });

    it('should pick closest wall as TP target for LONG', () => {
      const walls = [
        createWall('ASK', 102, 10, 2.0),
        createWall('ASK', 101, 12, 1.0), // Closer
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 95);

      expect(result.tpAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(101); // Closest wall
    });
  });

  // ==========================================================================
  // SL PROTECTION TESTS
  // ==========================================================================

  describe('SL Protection', () => {
    it('should move SL behind BID wall for LONG trade', () => {
      const walls = [
        createWall('BID', 98.5, 12, 1.5), // BID wall at 98.5, protecting LONG, 1.5% distance
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 97);

      // Wall at 98.5 is between entry (100) and SL (97)
      // SL should move just below wall (98.5 - buffer)
      expect(result.slAdjusted).toBe(true);
      expect(result.adjustedSLPrice).toBeCloseTo(98.4015, 2); // 98.5 - 0.1%
      expect(result.slWall?.side).toBe('BID');
    });

    it('should move SL behind ASK wall for SHORT trade', () => {
      const walls = [
        createWall('ASK', 101.5, 12, 1.5), // ASK wall at 101.5, protecting SHORT
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.SHORT, 95, 103);

      // Wall at 101.5 is between entry (100) and SL (103)
      expect(result.slAdjusted).toBe(true);
      expect(result.adjustedSLPrice).toBeCloseTo(101.6015, 2); // 101.5 + 0.1%
      expect(result.slWall?.side).toBe('ASK');
    });

    it('should not adjust SL when wall is too small', () => {
      const walls = [
        createWall('BID', 98.5, 8, 1.5), // 8% < 10% min for SL
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 97);

      expect(result.slAdjusted).toBe(false);
    });

    it('should not adjust SL when wall is not between entry and SL', () => {
      const walls = [
        createWall('BID', 96, 12, 4), // Wall at 96, but distance 4% exceeds max 2%
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 97);

      expect(result.slAdjusted).toBe(false);
    });

    it('should not move SL further from entry', () => {
      const walls = [
        createWall('BID', 98.2, 12, 1.8), // Wall at 98.2, 1.8% distance
      ];

      // Original SL at 99 is already tighter than wall-based SL (~98.1)
      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 99);

      // Should not adjust because wall-protected SL would be looser
      expect(result.slAdjusted).toBe(false);
    });
  });

  // ==========================================================================
  // COMBINED ADJUSTMENTS
  // ==========================================================================

  describe('Combined TP and SL Adjustments', () => {
    it('should adjust both TP and SL when valid walls exist', () => {
      const walls = [
        createWall('ASK', 101.5, 10, 1.5), // TP target
        createWall('BID', 98.5, 12, 1.5), // SL protection
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 102, 97);

      expect(result.tpAdjusted).toBe(true);
      expect(result.slAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(101.5);
      expect(result.adjustedSLPrice).toBeCloseTo(98.4015, 2); // 98.5 - 0.1%
    });

    it('should handle multiple walls and pick best ones', () => {
      const walls = [
        createWall('ASK', 105, 8, 5), // Too far (exceeds maxDistancePercent 2%)
        createWall('ASK', 101.5, 15, 1.5), // Good TP target
        createWall('BID', 96, 8, 4), // Too far (exceeds maxDistancePercent 2%)
        createWall('BID', 98.5, 15, 1.5), // Good SL protection
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 97);

      expect(result.tpAdjusted).toBe(true);
      expect(result.adjustedTPPrice).toBe(101.5);
      expect(result.slAdjusted).toBe(true);
      expect(result.adjustedSLPrice).toBeCloseTo(98.4015, 2);
    });
  });

  // ==========================================================================
  // DIRECTION-SPECIFIC TESTS
  // ==========================================================================

  describe('Direction-Specific Wall Filtering', () => {
    it('should only consider ASK walls for LONG TP', () => {
      const walls = [
        createWall('BID', 101, 10, 1.0), // Wrong side for LONG TP
        createWall('ASK', 101.5, 10, 1.5), // Correct side
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 102, 95);

      if (result.tpAdjusted) {
        expect(result.tpWall?.side).toBe('ASK');
      }
    });

    it('should only consider BID walls for SHORT TP', () => {
      const walls = [
        createWall('ASK', 99, 10, 1.0), // Wrong side for SHORT TP
        createWall('BID', 98.5, 10, 1.5), // Correct side
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.SHORT, 98, 105);

      if (result.tpAdjusted) {
        expect(result.tpWall?.side).toBe('BID');
      }
    });

    it('should only consider BID walls for LONG SL protection', () => {
      const walls = [
        createWall('ASK', 98.5, 12, 1.5), // Wrong side
        createWall('BID', 98.5, 12, 1.5), // Correct side
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 97);

      if (result.slAdjusted) {
        expect(result.slWall?.side).toBe('BID');
      }
    });

    it('should only consider ASK walls for SHORT SL protection', () => {
      const walls = [
        createWall('BID', 101.5, 12, 1.5), // Wrong side
        createWall('ASK', 101.5, 12, 1.5), // Correct side
      ];

      const result = service.adjustTPSL(walls, 100, SignalDirection.SHORT, 95, 103);

      if (result.slAdjusted) {
        expect(result.slWall?.side).toBe('ASK');
      }
    });
  });

  // ==========================================================================
  // TP ARRAY ADJUSTMENT
  // ==========================================================================

  describe('TP Array Adjustment', () => {
    it('should apply TP adjustment to first take profit', () => {
      const takeProfits = [
        { level: 1, percent: 2, sizePercent: 50, price: 102, hit: false },
        { level: 2, percent: 4, sizePercent: 50, price: 104, hit: false },
      ];

      const adjustment = {
        tpAdjusted: true,
        adjustedTPPrice: 101.5,
        originalTPPrice: 102,
        slAdjusted: false,
        wallsAnalyzed: 1,
        qualifiedWalls: 1,
      };

      const result = service.applyTPAdjustment(
        takeProfits,
        adjustment,
        100,
        SignalDirection.LONG,
      );

      expect(result[0].price).toBe(101.5);
      expect(result[0].percent).toBeCloseTo(1.5, 1);
      expect(result[1].price).toBe(104); // Unchanged
    });

    it('should not modify TPs when no adjustment', () => {
      const takeProfits = [
        { level: 1, percent: 2, sizePercent: 100, price: 102, hit: false },
      ];

      const adjustment = {
        tpAdjusted: false,
        slAdjusted: false,
        wallsAnalyzed: 0,
        qualifiedWalls: 0,
      };

      const result = service.applyTPAdjustment(
        takeProfits,
        adjustment,
        100,
        SignalDirection.LONG,
      );

      expect(result[0].price).toBe(102);
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const defaultService = new WhaleWallTPService(mockLogger as LoggerService);

      const config = defaultService.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.minWallPercent).toBe(5);
      expect(config.tpTargeting.enabled).toBe(true);
      expect(config.slProtection.enabled).toBe(true);
    });

    it('should merge partial config with defaults', () => {
      const partialService = new WhaleWallTPService(mockLogger as LoggerService, {
        minWallPercent: 10,
        tpTargeting: {
          enabled: true,
          alignmentThresholdPercent: 1.0,
          scaleToWall: false,
          minWallSizeForTP: 15,
        },
      });

      const config = partialService.getConfig();

      expect(config.minWallPercent).toBe(10);
      expect(config.tpTargeting.alignmentThresholdPercent).toBe(1.0);
      expect(config.tpTargeting.scaleToWall).toBe(false);
      expect(config.slProtection.enabled).toBe(true); // Default preserved
    });

    it('should disable TP targeting when configured', () => {
      const service = new WhaleWallTPService(mockLogger as LoggerService, {
        tpTargeting: {
          enabled: false,
          alignmentThresholdPercent: 0.5,
          scaleToWall: true,
          minWallSizeForTP: 8,
        },
      });

      const walls = [createWall('ASK', 104, 10, 4)];
      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 95);

      expect(result.tpAdjusted).toBe(false);
    });

    it('should disable SL protection when configured', () => {
      const service = new WhaleWallTPService(mockLogger as LoggerService, {
        slProtection: {
          enabled: false,
          moveSlBehindWall: true,
          bufferPercent: 0.1,
          minWallSizeForSL: 10,
        },
      });

      const walls = [createWall('BID', 97, 12, 3)];
      const result = service.adjustTPSL(walls, 100, SignalDirection.LONG, 105, 94);

      expect(result.slAdjusted).toBe(false);
    });
  });
});
