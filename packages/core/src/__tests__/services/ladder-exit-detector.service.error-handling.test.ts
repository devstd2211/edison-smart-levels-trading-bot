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
  LogLevel,
  SignalDirection,
  PositionSide,
  Position,
  ExitType,
  BybitOrder,
} from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';

// ============================================================================
// MOCKS & HELPERS
// ============================================================================

type MockBybitService = {
  getOrderHistory: jest.Mock;
  closePosition: jest.Mock;
};

const createMockBybitService = (): MockBybitService => {
  return {
    getOrderHistory: jest.fn().mockResolvedValue([]),
    closePosition: jest.fn().mockResolvedValue(undefined),
  };
};

const createMockPosition = (
  side: PositionSide,
  entryPrice: number,
  quantity: number = 1,
): Position => {
  const slPrice = side === PositionSide.LONG ? entryPrice * 0.998 : entryPrice * 1.002;

  // Create 3 TP levels
  const tpOffset1 = side === PositionSide.LONG ? entryPrice * 0.0008 : -entryPrice * 0.0008;
  const tpOffset2 = side === PositionSide.LONG ? entryPrice * 0.0015 : -entryPrice * 0.0015;
  const tpOffset3 = side === PositionSide.LONG ? entryPrice * 0.0025 : -entryPrice * 0.0025;

  return {
    id: 'APEXUSDT_' + side,
    symbol: 'APEXUSDT',
    side,
    entryPrice,
    quantity,
    stopLoss: {
      price: slPrice,
      initialPrice: slPrice,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, percent: 0.08, sizePercent: 33, price: entryPrice + tpOffset1, hit: false },
      { level: 2, percent: 0.15, sizePercent: 33, price: entryPrice + tpOffset2, hit: false },
      { level: 3, percent: 0.25, sizePercent: 34, price: entryPrice + tpOffset3, hit: false },
    ],
    leverage: 10,
    marginUsed: 100,
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'ORDER_123',
    reason: 'Test',
    status: 'OPEN',
  };
};

const createMockOrder = (
  symbol: string,
  price: string,
  orderType: string = 'Limit',
  stopOrderType?: string,
  reduceOnly: boolean = true
): BybitOrder => ({
  orderId: 'ORDER_' + Math.random().toString(36).substring(7),
  symbol,
  orderType,
  stopOrderType,
  price,
  orderStatus: 'Filled',
  reduceOnly,
  createdTime: Date.now(),
  updatedTime: Date.now(),
  qty: '1',
  cumExecQty: '1',
  avgPrice: price,
  side: 'Buy',
  positionIdx: 0,
  orderLinkId: '',
  triggerPrice: '',
  triggerDirection: 0,
  triggerBy: '',
  timeInForce: 'GTC',
  isLiquidation: false,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('LadderExitDetectorService - Error Handling (Phase 8.9.27)', () => {
  const asPosition = (value: unknown): Position => value as Position;
  const asPrice = (value: unknown): number => value as number;
  const asTakeProfits = (
    value: unknown
  ): Position['takeProfits'] => value as Position['takeProfits'];

  let logger: LoggerService;
  let bybitService: MockBybitService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    bybitService = createMockBybitService();
    errorHandler = new ErrorHandler(logger);
  });

  // ========================================================================
  // INPUT VALIDATION WITH THROW STRATEGY
  // ========================================================================

  describe('Input Validation (THROW Strategy)', () => {
    it('should throw ConfigurationError for missing position in detectLadderTPHit', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);

      expect(() => {
        service.detectLadderTPHit(asPosition(null), 100);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for position without symbol', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      position.symbol = '';

      expect(() => {
        service.detectLadderTPHit(position, 100.5);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid price (NaN)', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      expect(() => {
        service.detectLadderTPHit(position, NaN);
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for null price', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      expect(() => {
        service.detectLadderTPHit(position, asPrice(null));
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError in identifyTPLevel for missing position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);

      expect(() => {
        service.identifyTPLevel(100.5, asPosition(undefined));
      }).toThrow(ConfigurationError);
    });

    it('should handle validation errors without ErrorHandler (backward compatibility)', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange);

      expect(() => {
        service.detectLadderTPHit(asPosition(null), 100);
      }).toThrow(ConfigurationError);
    });
  });

  // ========================================================================
  // TP LEVEL DETECTION (LONG POSITIONS)
  // ========================================================================

  describe('TP Level Detection - LONG Positions', () => {
    it('should detect TP1 hit for LONG position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // TP1 is at 100.08
      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for LONG position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // TP2 is at 100.15
      const tpLevel = service.detectLadderTPHit(position, 100.15);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for LONG position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // TP3 is at 100.25
      const tpLevel = service.detectLadderTPHit(position, 100.25);
      expect(tpLevel).toBe(3);
    });

    it('should return undefined when no TP is hit', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.SHORT, 100);

      // SHORT TP1 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.92);
      expect(tpLevel).toBe(1);
    });

    it('should detect TP2 hit for SHORT position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.SHORT, 100);

      // SHORT TP2 is below entry
      const tpLevel = service.detectLadderTPHit(position, 99.85);
      expect(tpLevel).toBe(2);
    });

    it('should detect TP3 hit for SHORT position', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.SHORT, 100);

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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // Price between TP1 (100.08) and TP2 (100.15)
      const tpLevel = service.identifyTPLevel(100.11, position);
      expect([1, 2]).toContain(tpLevel);
    });

    it('should default to TP1 when execution price is below all TPs', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const tpLevel = service.identifyTPLevel(100.01, position);
      expect(tpLevel).toBe(1);
    });

    it('should identify TP3 when execution price is above all TPs', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const tpLevel = service.identifyTPLevel(100.3, position);
      expect(tpLevel).toBe(3);
    });
  });

  // ========================================================================
  // MISSING TP LEVELS (SKIP STRATEGY)
  // ========================================================================

  describe('Missing TP Levels (SKIP Strategy)', () => {
    it('should return undefined for detectLadderTPHit when no TP levels exist', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      position.takeProfits = [];

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should default to TP1 for identifyTPLevel when no TP levels exist', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      position.takeProfits = [];

      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);
    });

    it('should handle missing TP levels without ErrorHandler (backward compatibility)', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange);
      const position = createMockPosition(PositionSide.LONG, 100);
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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
      expect(bybitService.getOrderHistory).toHaveBeenCalledTimes(1);
    });

    it('should fallback on API failure after retries', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      bybitService.getOrderHistory.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Stop Loss exit type', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '99.8', 'Market', 'StopLoss', true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should handle Trailing Stop exit type', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.12', 'Market', 'TrailingStop', true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.TRAILING_STOP);
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.25', 'Limit', undefined, true),
      ];
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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
        createMockOrder('APEXUSDT', '100.15', 'Limit', undefined, true),
        createMockOrder('APEXUSDT', '100.25', 'Limit', undefined, true),
      ];

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(true);
    });

    it('should return false when only 2 TP levels hit', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
        createMockOrder('APEXUSDT', '100.15', 'Limit', undefined, true),
      ];

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should return false when ladder is incomplete', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      position.takeProfits = position.takeProfits?.slice(0, 2); // Only 2 TP levels

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
      ];

      const result = await service.isCompleteLadderExecuted(
        position,
        mockOrders
      );

      expect(result).toBe(false);
    });

    it('should fetch order history if not provided and detect ladder', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
        createMockOrder('APEXUSDT', '100.15', 'Limit', undefined, true),
        createMockOrder('APEXUSDT', '100.25', 'Limit', undefined, true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.isCompleteLadderExecuted(position);

      expect(result).toBe(true);
      expect(bybitService.getOrderHistory).toHaveBeenCalled();
    });

    it('should handle API failure in isCompleteLadderExecuted gracefully', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      const logSpy = jest.spyOn(logger, 'info');

      service.detectLadderTPHit(position, 100.08);

      expect(logSpy).toHaveBeenCalledWith('🎯 Ladder TP level hit detected', expect.any(Object));
      logSpy.mockRestore();
    });

    it('should log warnings for missing TP levels', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);
      position.takeProfits = asTakeProfits(undefined);

      const tpLevel = service.detectLadderTPHit(position, 100.08);
      expect(tpLevel).toBeUndefined();
    });

    it('should handle price parsing error in exit type detection', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // Order with unparseable price
      const mockOrders = [
        createMockOrder('APEXUSDT', 'invalid_price', 'Limit', undefined, true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);

      // Should fallback to TP1
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
      expect(result.tpLevel).toBe(1);
    });

    it('should handle empty order history gracefully', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      bybitService.getOrderHistory.mockResolvedValueOnce([]);

      const result = await service.analyzeExitExecution(position);

      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle Manual close order type correctly', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      const mockOrders = [
        createMockOrder('APEXUSDT', '100.12', 'Market', undefined, true),
      ];
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
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // Step 1: Detect TP1 hit (at or above target price)
      const tpHit = service.detectLadderTPHit(position, 100.08);
      expect(tpHit).toBe(1);

      // Step 2: Identify TP level from execution price
      const tpLevel = service.identifyTPLevel(100.08, position);
      expect(tpLevel).toBe(1);

      // Step 3: Analyze full execution
      const mockOrders = [
        createMockOrder('APEXUSDT', '100.08', 'Limit', undefined, true),
      ];
      bybitService.getOrderHistory.mockResolvedValueOnce(mockOrders);

      const result = await service.analyzeExitExecution(position);
      expect(result.exitType).toBe(ExitType.TAKE_PROFIT_1);
    });

    it('should handle cascading failures with retry and fallback', async () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

      // Simulate API failure
      bybitService.getOrderHistory.mockRejectedValue(new Error('Network error'));

      const result = await service.analyzeExitExecution(position);

      // Should fallback to MANUAL
      expect(result.exitType).toBe(ExitType.MANUAL);
    });

    it('should handle multiple rapid detections', () => {
      const service = new LadderExitDetectorService(logger, bybitService as unknown as IExchange, errorHandler);
      const position = createMockPosition(PositionSide.LONG, 100);

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

