/**
 * Error Handling Tests for LadderExitDetectorService (Phase 8.9.27)
 *
 * Coverage:
 * - Input validation with THROW strategy
 * - API calls with RETRY strategy
 * - TP level detection
 * - Complete ladder execution analysis
 * - Logging failures with SKIP strategy
 * - Backward compatibility without ErrorHandler
 * - Integration scenarios with cascading failures
 */

import { LadderExitDetectorService } from '../../services/ladder-exit-detector.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { ConfigurationError } from '../../errors/DomainErrors';
import {
  LoggerService,
  SignalDirection,
  PositionSide,
  ExitType,
} from '../../types/legacy';
import {
  asLadderExitPosition,
  asLadderExitPrice,
  asLadderExitTakeProfits,
  createLadderExitHarness,
  createLadderExitOrderHistory,
  createLadderExitOrder,
  createLadderExitPosition,
  createLadderExitService,
} from '../helpers/ladder-exit-detector-test.utils';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('LadderExitDetectorService - Error Handling (Phase 8.9.27)', () => {
  let logger: LoggerService;
  let bybitService: ReturnType<typeof createLadderExitHarness>['bybitService'];
  let errorHandler: ErrorHandler;
  let createService: (options?: { errorHandler?: ErrorHandler }) => LadderExitDetectorService;

  beforeEach(() => {
    const harness = createLadderExitHarness();
    logger = harness.logger;
    bybitService = harness.bybitService;
    errorHandler = harness.errorHandler;
    createService = (options = {}) =>
      createLadderExitService({
        logger,
        bybitService,
        errorHandler: options.errorHandler,
      });
  });

  // ========================================================================
  // INPUT VALIDATION WITH THROW STRATEGY
  // ========================================================================

  describe('Input Validation (THROW Strategy)', () => {
    it('should throw ConfigurationError for missing position in detectLadderTPHit', () => {
      const service = createService({ errorHandler });

      expect(() => {
        service.detectLadderTPHit(asLadderExitPosition(null), 100);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for position without symbol', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.symbol = '';

      expect(() => {
        service.detectLadderTPHit(position, 100.5);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid price (NaN)', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      expect(() => {
        service.detectLadderTPHit(position, NaN);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for null price', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      expect(() => {
        service.detectLadderTPHit(position, asLadderExitPrice(null));
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError in identifyTPLevel for missing position', () => {
      const service = createService({ errorHandler });

      expect(() => {
        service.identifyTPLevel(100.5, asLadderExitPosition(undefined));
      }).toThrow(ConfigurationError);
    });

    it('should handle validation errors without ErrorHandler (backward compatibility)', () => {
      const service = createService();

      expect(() => {
        service.detectLadderTPHit(asLadderExitPosition(null), 100);
      }).toThrow(ConfigurationError);
    });
  });

  // ========================================================================
  // TP LEVEL DETECTION (LONG POSITIONS)
  // ========================================================================

  describe('TP Level Detection - LONG Positions', () => {
    it('should detect TP1 hit for LONG position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // TP1 is at 100.08
      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for LONG position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // TP2 is at 100.15
      const tpLevel = service.detectLadderTPHit(position, 100.15);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for LONG position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // TP3 is at 100.25
      const tpLevel = service.detectLadderTPHit(position, 100.25);
      expect(tpLevel).toBe(3);
    });

    it('should return undefined when no TP is hit', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Price below all TP levels
      const tpLevel = service.detectLadderTPHit(position, 99.99);
      expect(tpLevel).toBeUndefined();
    });
  });

  // ========================================================================
  // TP LEVEL DETECTION (SHORT POSITIONS)
  // ========================================================================

  describe('TP Level Detection - SHORT Positions', () => {
    it('should detect TP1 hit for SHORT position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.SHORT, 100);

      // SHORT TP1 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.92);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for SHORT position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.SHORT, 100);

      // SHORT TP2 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.85);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for SHORT position', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.SHORT, 100);

      // SHORT TP3 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.75);
      expect(tpLevel).toBe(3);
    });
  });

  // ========================================================================
  // TP LEVEL IDENTIFICATION
  // ========================================================================

  describe('TP Level Identification', () => {
    it('should identify closest TP level when price is between levels', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Price between TP1 (100.08) and TP2 (100.15)
      const tpLevel = service.identifyTPLevel(100.11, position);
      expect([1, 2]).toContain(tpLevel);
    });

    it('should default to TP1 when execution price is below all TPs', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const tpLevel = service.identifyTPLevel(100.01, position);
      expect(tpLevel).toBe(1);
    });

    it('should identify TP3 when execution price is above all TPs', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const tpLevel = service.identifyTPLevel(100.3, position);
      expect(tpLevel).toBe(3);
    });
  });

  // ========================================================================
  // MISSING TP LEVELS (SKIP STRATEGY)
  // ========================================================================

  describe('Missing TP Levels (SKIP Strategy)', () => {
    it('should return undefined for detectLadderTPHit when no TP levels exist', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = [];

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should default to TP1 for identifyTPLevel when no TP levels exist', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = [];

      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);
    });

    it('should handle missing TP levels without ErrorHandler (backward compatibility)', () => {
      const service = createService();
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = [];

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });
  });

  // ========================================================================
  // ANALYZE EXIT EXECUTION WITH RETRY STRATEGY
  // ========================================================================

  describe('Analyze Exit Execution (RETRY Strategy)', () => {
    it('should fetch order history and detect TP exit', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
      expect(bybitService.getOrderHistory).toHaveBeenCalledTimes(1);
    });

    it('should fallback on API failure after retries', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // API fails all retries
      bybitService.getOrderHistory.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.analyzeExitExecution(position);

      // Should fallback to MANUAL
      expect(result.exitType).toBe(ExitType.MANUAL);
      // Should have attempted retries
      expect(bybitService.getOrderHistory.mock.calls.length).toBeGreaterThan(0);
    });

    it('should fallback to MANUAL when API fails after retries', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      bybitService.getOrderHistory.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Stop Loss exit type', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '99.8', orderType: 'Market', stopOrderType: 'StopLoss', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should handle Trailing Stop exit type', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.12', orderType: 'Market', stopOrderType: 'TrailingStop', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TRAILING_STOP);
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const service = createService();
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.25', orderType: 'Limit', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_3);
    });
  });

  // ========================================================================
  // COMPLETE LADDER EXECUTION DETECTION
  // ========================================================================

  describe('Complete Ladder Execution Detection', () => {
    it('should detect complete ladder execution with all 3 TP levels hit', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
        { price: '100.15', orderType: 'Limit', reduceOnly: true },
        { price: '100.25', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(true);
    });

    it('should return false when only 2 TP levels hit', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
        { price: '100.15', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should return false when ladder is incomplete', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = position.takeProfits?.slice(0, 2); // Only 2 TP levels

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should fetch order history if not provided and detect ladder', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
        { price: '100.15', orderType: 'Limit', reduceOnly: true },
        { price: '100.25', orderType: 'Limit', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.isCompleteLadderExecuted(position);

      expect(result).toBe(true);
      expect(bybitService.getOrderHistory).toHaveBeenCalled();
    });

    it('should handle API failure in isCompleteLadderExecuted gracefully', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      bybitService.getOrderHistory.mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await service.isCompleteLadderExecuted(position);

      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // LOGGING INTEGRATION
  // ========================================================================

  describe('Logging Integration', () => {
    it('should log TP hit detection', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      const logSpy = jest.spyOn(logger, 'info');

      service.detectLadderTPHit(position, 100.08);

      expect(logSpy).toHaveBeenCalledWith('🎯 Ladder TP level hit detected', expect.any(Object));
      logSpy.mockRestore();
    });

    it('should log warnings for missing TP levels', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = [];
      const warnSpy = jest.spyOn(logger, 'warn');

      const result = await service.analyzeExitExecution(position);

      expect(result).toBeDefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ========================================================================
  // EDGE CASES & ERROR SCENARIOS
  // ========================================================================

  describe('Edge Cases & Error Scenarios', () => {
    it('should handle position with undefined takeProfits gracefully', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);
      position.takeProfits = asLadderExitTakeProfits(undefined);

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should handle price parsing error in exit type detection', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Order with unparseable price
      const mockOrders = createLadderExitOrderHistory([
        { price: 'invalid_price', orderType: 'Limit', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      // Should fallback to TP1
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
    });

    it('should handle empty order history gracefully', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      bybitService.getOrderHistory.mockResolvedValueOnce([]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Manual close order type correctly', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      const mockOrders = createLadderExitOrderHistory([
        { price: '100.12', orderType: 'Market', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });
  });

  // ========================================================================
  // INTEGRATION SCENARIOS
  // ========================================================================

  describe('Integration Scenarios', () => {
    it('should handle full workflow: detect → identify → analyze', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Step 1: Detect TP1 hit (at or above target price)
      const tpHit = service.detectLadderTPHit(position, 100.08);
      expect(tpHit).toBe(1);

      // Step 2: Identify TP level from execution price
      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);

      // Step 3: Analyze full execution
      const mockOrders = createLadderExitOrderHistory([
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
      ]);
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
    });

    it('should handle cascading failures with retry and fallback', async () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Simulate API failure
      bybitService.getOrderHistory.mockRejectedValue(new Error('Network error'));

      const result = await service.analyzeExitExecution(position);

      // Should fallback to MANUAL
      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle multiple rapid detections', () => {
      const service = createService({ errorHandler });
      const position = createLadderExitPosition(PositionSide.LONG, 100);

      // Test various price points across TP levels
      // With 0.05% tolerance (100 * 0.0005 = 0.05)
      // TP1 at 100.08, TP2 at 100.15, TP3 at 100.25
      const results = [
        service.detectLadderTPHit(position, 99.99), // Below all (no hit)
        service.detectLadderTPHit(position, 100.08), // At TP1
        service.detectLadderTPHit(position, 100.25), // At TP3
        service.detectLadderTPHit(position, 100.30), // Above TP3 (still matches TP3)
      ];

      expect(results).toEqual([undefined, 1, 3, 3]);
    });
  });
});

