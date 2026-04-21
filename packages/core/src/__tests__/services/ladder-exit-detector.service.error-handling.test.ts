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

import { ErrorHandler } from '../../errors/ErrorHandler';
import { ConfigurationError } from '../../errors/DomainErrors';
import {
  LoggerService,
  PositionSide,
  ExitType,
} from '../../types/legacy';
import {
  asLadderExitPosition,
  asLadderExitPrice,
  asLadderExitTakeProfits,
  createManagedLadderExitContext,
  createLadderExitScenarioHarness,
  createLadderExitTpOrderHistory,
  queueLadderExitOrderHistory,
  type LadderExitErrorHandlingRuntime,
} from '../helpers/ladder-exit-detector-test.utils';

describe('LadderExitDetectorService - Error Handling (Phase 8.9.27)', () => {
  type LadderExitScenarioFactory = (options?: {
    withErrorHandler?: boolean;
    side?: PositionSide;
    entryPrice?: number;
    quantity?: number;
  }) => ReturnType<typeof createLadderExitScenarioHarness>;
  let logger: LoggerService;
  let bybitService: LadderExitErrorHandlingRuntime['bybitService'];
  let createScenario: LadderExitScenarioFactory;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let cleanup: LadderExitErrorHandlingRuntime['cleanup'];

  beforeEach(() => {
    const state: LadderExitErrorHandlingRuntime = createManagedLadderExitContext();
    ({ logger, bybitService, cleanup } = state);
    createScenario = (options = {}) =>
      createLadderExitScenarioHarness({
        logger,
        bybitService,
        withErrorHandler: options.withErrorHandler,
        side: options.side,
        entryPrice: options.entryPrice,
        quantity: options.quantity,
      });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // INPUT VALIDATION WITH THROW STRATEGY
  // ========================================================================

  describe('Input Validation (THROW Strategy)', () => {
    it('should throw ConfigurationError for missing position in detectLadderTPHit', () => {
      const { service } = createScenario();

      expect(() => {
        service.detectLadderTPHit(asLadderExitPosition(null), 100);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for position without symbol', () => {
      const { service, position } = createScenario();
      position.symbol = '';

      expect(() => {
        service.detectLadderTPHit(position, 100.5);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid price (NaN)', () => {
      const { service, position } = createScenario();

      expect(() => {
        service.detectLadderTPHit(position, NaN);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for null price', () => {
      const { service, position } = createScenario();

      expect(() => {
        service.detectLadderTPHit(position, asLadderExitPrice(null));
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError in identifyTPLevel for missing position', () => {
      const { service } = createScenario();

      expect(() => {
        service.identifyTPLevel(100.5, asLadderExitPosition(undefined));
      }).toThrow(ConfigurationError);
    });

    it('should handle validation errors without ErrorHandler (backward compatibility)', () => {
      const { service } = createScenario({ withErrorHandler: false });

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
      const { service, position } = createScenario();

      // TP1 is at 100.08
      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for LONG position', () => {
      const { service, position } = createScenario();

      // TP2 is at 100.15
      const tpLevel = service.detectLadderTPHit(position, 100.15);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for LONG position', () => {
      const { service, position } = createScenario();

      // TP3 is at 100.25
      const tpLevel = service.detectLadderTPHit(position, 100.25);
      expect(tpLevel).toBe(3);
    });

    it('should return undefined when no TP is hit', () => {
      const { service, position } = createScenario();

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
      const { service, position } = createScenario({ side: PositionSide.SHORT });

      // SHORT TP1 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.92);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for SHORT position', () => {
      const { service, position } = createScenario({ side: PositionSide.SHORT });

      // SHORT TP2 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.85);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for SHORT position', () => {
      const { service, position } = createScenario({ side: PositionSide.SHORT });

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
      const { service, position } = createScenario();

      // Price between TP1 (100.08) and TP2 (100.15)
      const tpLevel = service.identifyTPLevel(100.11, position);
      expect([1, 2]).toContain(tpLevel);
    });

    it('should default to TP1 when execution price is below all TPs', () => {
      const { service, position } = createScenario();

      const tpLevel = service.identifyTPLevel(100.01, position);
      expect(tpLevel).toBe(1);
    });

    it('should identify TP3 when execution price is above all TPs', () => {
      const { service, position } = createScenario();

      const tpLevel = service.identifyTPLevel(100.3, position);
      expect(tpLevel).toBe(3);
    });
  });

  // ========================================================================
  // MISSING TP LEVELS (SKIP STRATEGY)
  // ========================================================================

  describe('Missing TP Levels (SKIP Strategy)', () => {
    it('should return undefined for detectLadderTPHit when no TP levels exist', () => {
      const { service, position } = createScenario();
      position.takeProfits = [];

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should default to TP1 for identifyTPLevel when no TP levels exist', () => {
      const { service, position } = createScenario();
      position.takeProfits = [];

      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);
    });

    it('should handle missing TP levels without ErrorHandler (backward compatibility)', () => {
      const { service, position } = createScenario({ withErrorHandler: false });
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
      const { service, position } = createScenario();
      const mockOrders = queueLadderExitOrderHistory(bybitService, [
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
      expect(bybitService.getOrderHistory).toHaveBeenCalledTimes(1);
    });

    it('should fallback on API failure after retries', async () => {
      const { service, position } = createScenario();

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
      const { service, position } = createScenario();

      bybitService.getOrderHistory.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Stop Loss exit type', async () => {
      const { service, position } = createScenario();
      queueLadderExitOrderHistory(bybitService, [
        { price: '99.8', orderType: 'Market', stopOrderType: 'StopLoss', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should handle Trailing Stop exit type', async () => {
      const { service, position } = createScenario();
      queueLadderExitOrderHistory(bybitService, [
        { price: '100.12', orderType: 'Market', stopOrderType: 'TrailingStop', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TRAILING_STOP);
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const { service, position } = createScenario({ withErrorHandler: false });
      queueLadderExitOrderHistory(bybitService, [
        { price: '100.25', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_3);
    });
  });

  // ========================================================================
  // COMPLETE LADDER EXECUTION DETECTION
  // ========================================================================

  describe('Complete Ladder Execution Detection', () => {
    it('should detect complete ladder execution with all 3 TP levels hit', async () => {
      const { service, position } = createScenario();

      const mockOrders = createLadderExitTpOrderHistory(['100.08', '100.15', '100.25']);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(true);
    });

    it('should return false when only 2 TP levels hit', async () => {
      const { service, position } = createScenario();

      const mockOrders = createLadderExitTpOrderHistory(['100.08', '100.15']);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should return false when ladder is incomplete', async () => {
      const { service, position } = createScenario();
      position.takeProfits = position.takeProfits?.slice(0, 2); // Only 2 TP levels

      const mockOrders = createLadderExitTpOrderHistory(['100.08']);

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should fetch order history if not provided and detect ladder', async () => {
      const { service, position } = createScenario();
      queueLadderExitOrderHistory(bybitService, [
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
        { price: '100.15', orderType: 'Limit', reduceOnly: true },
        { price: '100.25', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.isCompleteLadderExecuted(position);

      expect(result).toBe(true);
      expect(bybitService.getOrderHistory).toHaveBeenCalled();
    });

    it('should handle API failure in isCompleteLadderExecuted gracefully', async () => {
      const { service, position } = createScenario();

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
      const { service, position } = createScenario();
      const logSpy = jest.spyOn(logger, 'info');

      service.detectLadderTPHit(position, 100.08);

      expect(logSpy).toHaveBeenCalledWith('🎯 Ladder TP level hit detected', expect.any(Object));
      logSpy.mockRestore();
    });

    it('should log warnings for missing TP levels', async () => {
      const { service, position } = createScenario();
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
      const { service, position } = createScenario();
      position.takeProfits = asLadderExitTakeProfits(undefined);

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should handle price parsing error in exit type detection', async () => {
      const { service, position } = createScenario();

      // Order with unparseable price
      queueLadderExitOrderHistory(bybitService, [
        { price: 'invalid_price', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      // Should fallback to TP1
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
    });

    it('should handle empty order history gracefully', async () => {
      const { service, position } = createScenario();

      bybitService.getOrderHistory.mockResolvedValueOnce([]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Manual close order type correctly', async () => {
      const { service, position } = createScenario();
      queueLadderExitOrderHistory(bybitService, [
        { price: '100.12', orderType: 'Market', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });
  });

  // ========================================================================
  // INTEGRATION SCENARIOS
  // ========================================================================

  describe('Integration Scenarios', () => {
    it('should handle full workflow: detect → identify → analyze', async () => {
      const { service, position } = createScenario();

      // Step 1: Detect TP1 hit (at or above target price)
      const tpHit = service.detectLadderTPHit(position, 100.08);
      expect(tpHit).toBe(1);

      // Step 2: Identify TP level from execution price
      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);

      // Step 3: Analyze full execution
      queueLadderExitOrderHistory(bybitService, [
        { price: '100.08', orderType: 'Limit', reduceOnly: true },
      ]);

      const result = await service.analyzeExitExecution(position);
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
    });

    it('should handle cascading failures with retry and fallback', async () => {
      const { service, position } = createScenario();

      // Simulate API failure
      bybitService.getOrderHistory.mockRejectedValue(new Error('Network error'));

      const result = await service.analyzeExitExecution(position);

      // Should fallback to MANUAL
      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle multiple rapid detections', () => {
      const { service, position } = createScenario();

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

