/**
 * Position Sync Service Tests
 * Tests for position synchronization with exchange
 */

import type { PositionSyncService } from '../../services/position-sync.service';
import { LoggerService, Position, PositionSide, ExitType, BybitOrder } from '../../types/legacy';
import {
  createMockPositionSyncExchange,
  createMockPositionSyncExitTypeDetector,
  createMockPositionSyncManager,
  createMockPositionSyncTelegram,
  createMockPositionCloseRecorder,
  createMockSyncedPositions,
  createPositionSyncPosition,
  createPositionSyncHarness,
  createPositionSyncServiceWithHarness,
  createPositionSyncStopLossOrder,
} from '../helpers/position-sync-test.utils';

const createMockPosition = createPositionSyncPosition;

// ============================================================================
// TESTS
// ============================================================================

describe('PositionSyncService', () => {
  let service: PositionSyncService;
  let mockBybit: ReturnType<typeof createMockPositionSyncExchange>;
  let mockPositionManager: ReturnType<typeof createMockPositionSyncManager>;
  let mockExitTypeDetector: ReturnType<typeof createMockPositionSyncExitTypeDetector>;
  let mockTelegram: ReturnType<typeof createMockPositionSyncTelegram>;
  let logger: LoggerService;

  beforeEach(() => {
    jest.clearAllMocks();
    const harness = createPositionSyncHarness();
    service = harness.service;
    mockBybit = harness.mockBybit;
    mockPositionManager = harness.mockPositionManager;
    mockExitTypeDetector = harness.mockExitTypeDetector;
    mockTelegram = harness.mockTelegram;
    logger = harness.logger;
  });

  // ==========================================================================
  // TEST GROUP 1: syncClosedPosition
  // ==========================================================================

  describe('syncClosedPosition', () => {
    it('should fetch order history to determine exit type', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await service.syncClosedPosition(position);

      expect(mockBybit.getOrderHistory).toHaveBeenCalledWith(20); // Default history limit
    });

    it('should determine exit type from order history', async () => {
      const position = createMockPosition();
      const orderHistory: BybitOrder[] = [];
      mockBybit.getOrderHistory.mockResolvedValue(orderHistory);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await service.syncClosedPosition(position);

      expect(mockExitTypeDetector.determineExitTypeFromHistory).toHaveBeenCalledWith(
        orderHistory,
        position,
      );
    });

    it('should get current price for PnL calculation', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await service.syncClosedPosition(position);

      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });

    it('should call closeFullPosition with correct parameters', async () => {
      const position = createMockPosition();
      const currentPrice = 105;
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(currentPrice);
      mockExitTypeDetector.determineExitTypeFromHistory.mockReturnValue(ExitType.TAKE_PROFIT_1);

      const positionExitingService = createMockPositionCloseRecorder();
      const syncService = createPositionSyncServiceWithHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: positionExitingService,
      });

      await syncService.syncClosedPosition(position);

      expect(positionExitingService.closeFullPosition).toHaveBeenCalledWith(
        position,
        currentPrice,
        expect.stringContaining('Position closed on exchange'),
        ExitType.TAKE_PROFIT_1,
      );
    });

    it('should send telegram alert with exit type', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);
      mockExitTypeDetector.determineExitTypeFromHistory.mockReturnValue(ExitType.STOP_LOSS);

      await service.syncClosedPosition(position);

      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('SYNC: Position closed on exchange'),
      );
      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('STOP_LOSS'),
      );
    });

    it('should clear position after successful sync', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await service.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const position = createMockPosition();
      const error = new Error('API error');
      mockBybit.getOrderHistory.mockRejectedValue(error);

      // syncClosedPosition catches errors and clears position
      await service.syncClosedPosition(position);
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle different exit types', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      const exitTypes = [
        ExitType.STOP_LOSS,
        ExitType.TAKE_PROFIT_1,
        ExitType.TAKE_PROFIT_2,
        ExitType.TRAILING_STOP,
        ExitType.MANUAL,
      ];

      for (const exitType of exitTypes) {
        jest.clearAllMocks();
        mockBybit.getOrderHistory.mockResolvedValue([]);
        mockBybit.getCurrentPrice.mockResolvedValue(105);
        mockExitTypeDetector.determineExitTypeFromHistory.mockReturnValue(exitType);

        await service.syncClosedPosition(position);

        expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
          expect.stringContaining(exitType),
        );
      }
    });
  });

  // ==========================================================================
  // TEST GROUP 2: deepSyncCheck
  // ==========================================================================

  describe('deepSyncCheck', () => {
    it('should skip check when position is null', async () => {
      await service.deepSyncCheck(null);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should skip check when position status is CLOSED', async () => {
      const position = createMockPosition();
      position.status = 'CLOSED';

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should skip check for positions < 2 minutes old', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 60000); // 1 minute ago

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should run check for positions >= 2 minutes old', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 121000); // 2+ minutes ago
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).toHaveBeenCalled();
    });

    it('should verify position exists on exchange', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      const exchangePosition = { ...position };
      mockBybit.getPosition.mockResolvedValue(exchangePosition);
      mockBybit.getActiveOrders.mockResolvedValue([
        createPositionSyncStopLossOrder() as unknown as BybitOrder,
      ]);

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).toHaveBeenCalled();
    });

    it('should get active orders to check SL/TP', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);

      await service.deepSyncCheck(position);

      expect(mockBybit.getActiveOrders).toHaveBeenCalled();
    });

    it('should close position when Stop Loss missing', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false; // Not trailing stop
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]); // No orders = no SL
      mockBybit.closePosition.mockResolvedValue(undefined);

      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: position.id,
          percentage: 100,
        })
      );
    });

    it('should send alert when closing for missing SL', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false;
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);
      mockBybit.closePosition.mockResolvedValue(undefined);

      await service.deepSyncCheck(position);

      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL: Stop Loss missing'),
      );
    });

    it('should handle race condition when position closes during check', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false;
      mockBybit.getPosition.mockResolvedValueOnce(position); // First call succeeds
      mockBybit.getActiveOrders.mockResolvedValue([]);
      mockBybit.getPosition.mockResolvedValueOnce(null); // Second call fails (position closed)

      await service.deepSyncCheck(position);

      // Should handle gracefully without crashing
      expect(mockBybit.closePosition).not.toHaveBeenCalled();
    });

    it('should skip check for positions less than 2 minutes old', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 60000); // 1 minute old

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should handle trailing stop flag', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = true; // Has trailing stop
      const exchangePosition = { ...position };
      mockBybit.getPosition.mockResolvedValue(exchangePosition);
      mockBybit.getActiveOrders.mockResolvedValue([]); // No orders

      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).not.toHaveBeenCalled(); // Has trailing stop
    });

    it('should attempt emergency close when SL missing', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false;
      const exchangePosition = { ...position };
      mockBybit.getPosition.mockResolvedValue(exchangePosition);
      mockBybit.getActiveOrders.mockResolvedValue([]); // No SL
      mockBybit.closePosition.mockResolvedValue(undefined);

      await service.deepSyncCheck(position);

      // Should attempt to close when SL is missing
      expect(mockBybit.closePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: position.id,
          percentage: 100,
        })
      );
    });

    it('should log position age', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 300000); // 5 minutes
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([
        createPositionSyncStopLossOrder() as unknown as BybitOrder,
      ]);

      const logSpy = jest.spyOn(logger, 'debug');
      await service.deepSyncCheck(position);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running deep sync check'),
        expect.objectContaining({
          ageMinutes: expect.any(Number),
        }),
      );
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should handle complete sync workflow', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await service.syncClosedPosition(position);

      expect(mockBybit.getOrderHistory).toHaveBeenCalled();
      expect(mockExitTypeDetector.determineExitTypeFromHistory).toHaveBeenCalled();
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle deep sync and emergency close workflow', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false;
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]); // No SL
      mockBybit.closePosition.mockResolvedValue(undefined);

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).toHaveBeenCalled();
      expect(mockBybit.getActiveOrders).toHaveBeenCalled();
      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });

    it('should handle multiple positions correctly (each synced independently)', async () => {
      const [position1, position2] = createMockSyncedPositions([
        { side: PositionSide.LONG },
        { side: PositionSide.SHORT },
      ]);

      // Track calls manually for better control
      const clearPositionCalls: Position[] = [];
      const mockPositionManagerLocal = {
        ...mockPositionManager,
        clearPosition: jest.fn(async () => {
          clearPositionCalls.push(position1);
        }),
      };

      const serviceLocal = createPositionSyncServiceWithHarness({
        mockBybit,
        mockPositionManager: mockPositionManagerLocal,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: createMockPositionCloseRecorder(),
      });

      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockResolvedValue(105);

      await serviceLocal.syncClosedPosition(position1);
      clearPositionCalls.push(position2); // Track second call

      await serviceLocal.syncClosedPosition(position2);

      expect(mockPositionManagerLocal.clearPosition).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle network errors in syncClosedPosition gracefully', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockRejectedValue(new Error('Network error'));

      // Should catch error and clear position
      await service.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle getCurrentPrice failures', async () => {
      const position = createMockPosition();
      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice.mockRejectedValue(new Error('Price error'));

      // Should catch error and clear position
      await service.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle missing position gracefully in deepSyncCheck', async () => {
      // Null position should be skipped entirely
      await service.deepSyncCheck(null);
      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should handle position closed during deepSyncCheck', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 150000);
      position.stopLoss.isTrailing = false;
      mockBybit.getPosition.mockResolvedValueOnce(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);
      mockBybit.getPosition.mockResolvedValueOnce(null); // Position closed

      await service.deepSyncCheck(position);

      // Should handle gracefully
      expect(mockBybit.closePosition).not.toHaveBeenCalled();
    });
  });
});
