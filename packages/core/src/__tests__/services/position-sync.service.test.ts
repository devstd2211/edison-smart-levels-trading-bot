/**
 * Position Sync Service Tests
 * Tests for position synchronization with exchange
 */

import type { PositionSyncService } from '../../services/position-sync.service';
import { LoggerService, Position, PositionSide, ExitType } from '../../types/legacy';
import {
  createManagedPositionSyncContext,
  createMockPositionSyncExchange,
  createMockPositionSyncExitTypeDetector,
  createMockPositionSyncManager,
  createMockPositionSyncTelegram,
  createMockPositionCloseRecorder,
  createMockSyncedPositions,
  type ManagedPositionSyncContext,
  createPositionSyncAgedPosition,
  createPositionSyncProtectedOrders,
  createPositionSyncPosition,
  preparePositionSyncClosedDuringCheckScenario,
  prepareClosedPositionSync,
  prepareDeepSyncProtectionScenario,
  preparePositionSyncMissingProtectionScenario,
  recreatePositionSyncHarness,
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
  let context: ManagedPositionSyncContext;

  function bindPositionSyncContext() {
    let managedContext: ManagedPositionSyncContext;

    beforeEach(() => {
      managedContext = createManagedPositionSyncContext();
    });

    afterEach(() => {
      managedContext.cleanup();
    });

    return () => managedContext;
  }

  const getContext = bindPositionSyncContext();

  beforeEach(() => {
    context = getContext();
    service = context.service;
    mockBybit = context.mockBybit;
    mockPositionManager = context.mockPositionManager;
    mockExitTypeDetector = context.mockExitTypeDetector;
    mockTelegram = context.mockTelegram;
    logger = context.logger;
  });

  // ==========================================================================
  // TEST GROUP 1: syncClosedPosition
  // ==========================================================================

  describe('syncClosedPosition', () => {
    it('should fetch order history to determine exit type', async () => {
      const position = createMockPosition();
      prepareClosedPositionSync({ mockBybit });

      await service.syncClosedPosition(position);

      expect(mockBybit.getOrderHistory).toHaveBeenCalledWith(20); // Default history limit
    });

    it('should determine exit type from order history', async () => {
      const position = createMockPosition();
      const { orderHistory } = prepareClosedPositionSync({ mockBybit });

      await service.syncClosedPosition(position);

      expect(mockExitTypeDetector.determineExitTypeFromHistory).toHaveBeenCalledWith(
        orderHistory,
        position,
      );
    });

    it('should get current price for PnL calculation', async () => {
      const position = createMockPosition();
      prepareClosedPositionSync({ mockBybit });

      await service.syncClosedPosition(position);

      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });

    it('should call closeFullPosition with correct parameters', async () => {
      const position = createMockPosition();
      const { currentPrice } = prepareClosedPositionSync({ mockBybit });
      mockExitTypeDetector.determineExitTypeFromHistory.mockReturnValue(ExitType.TAKE_PROFIT_1);

      const positionExitingService = createMockPositionCloseRecorder();
      const syncService = recreatePositionSyncHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: positionExitingService,
      }).service;

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
      prepareClosedPositionSync({ mockBybit });
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
      prepareClosedPositionSync({ mockBybit });

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
      prepareClosedPositionSync({ mockBybit });

      const exitTypes = [
        ExitType.STOP_LOSS,
        ExitType.TAKE_PROFIT_1,
        ExitType.TAKE_PROFIT_2,
        ExitType.TRAILING_STOP,
        ExitType.MANUAL,
      ];

      for (const exitType of exitTypes) {
        jest.clearAllMocks();
        prepareClosedPositionSync({ mockBybit });
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
      const position = createPositionSyncAgedPosition(60000); // 1 minute ago

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should run check for positions >= 2 minutes old', async () => {
      const position = createPositionSyncAgedPosition(121000); // 2+ minutes ago
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).toHaveBeenCalled();
    });

    it('should verify position exists on exchange', async () => {
      const position = createPositionSyncAgedPosition(150000);
      prepareDeepSyncProtectionScenario(
        { mockBybit },
        position,
        {
          exchangePosition: { ...position },
          activeOrders: createPositionSyncProtectedOrders(),
        },
      );

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).toHaveBeenCalled();
    });

    it('should get active orders to check SL/TP', async () => {
      const position = createPositionSyncAgedPosition(150000);
      prepareDeepSyncProtectionScenario({ mockBybit }, position);

      await service.deepSyncCheck(position);

      expect(mockBybit.getActiveOrders).toHaveBeenCalled();
    });

    it('should close position when Stop Loss missing', async () => {
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncMissingProtectionScenario({ mockBybit, mockTelegram }, position, {
        closeResult: undefined,
      });

      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: position.id,
          percentage: 100,
        })
      );
    });

    it('should send alert when closing for missing SL', async () => {
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncMissingProtectionScenario({ mockBybit, mockTelegram }, position, {
        closeResult: undefined,
      });

      await service.deepSyncCheck(position);

      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL: Stop Loss missing'),
      );
    });

    it('should handle race condition when position closes during check', async () => {
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncClosedDuringCheckScenario({ mockBybit }, position);

      await service.deepSyncCheck(position);

      // Should handle gracefully without crashing
      expect(mockBybit.closePosition).not.toHaveBeenCalled();
    });

    it('should skip check for positions less than 2 minutes old', async () => {
      const position = createPositionSyncAgedPosition(60000); // 1 minute old

      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should handle trailing stop flag', async () => {
      const position = createPositionSyncAgedPosition(150000);
      position.stopLoss.isTrailing = true; // Has trailing stop
      const exchangePosition = { ...position };
      mockBybit.getPosition.mockResolvedValue(exchangePosition);
      mockBybit.getActiveOrders.mockResolvedValue([]); // No orders

      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).not.toHaveBeenCalled(); // Has trailing stop
    });

    it('should attempt emergency close when SL missing', async () => {
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncMissingProtectionScenario(
        { mockBybit, mockTelegram },
        position,
        { exchangePosition: { ...position }, closeResult: undefined },
      );

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
      const position = createPositionSyncAgedPosition(300000); // 5 minutes
      prepareDeepSyncProtectionScenario(
        { mockBybit },
        position,
        { activeOrders: createPositionSyncProtectedOrders() },
      );

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
      prepareClosedPositionSync({ mockBybit });

      await service.syncClosedPosition(position);

      expect(mockBybit.getOrderHistory).toHaveBeenCalled();
      expect(mockExitTypeDetector.determineExitTypeFromHistory).toHaveBeenCalled();
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should handle deep sync and emergency close workflow', async () => {
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncMissingProtectionScenario({ mockBybit, mockTelegram }, position, {
        closeResult: undefined,
      });

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

      const serviceLocal = recreatePositionSyncHarness({
        mockBybit,
        mockPositionManager: mockPositionManagerLocal,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: createMockPositionCloseRecorder(),
      }).service;

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
      const position = createPositionSyncAgedPosition(150000);
      preparePositionSyncClosedDuringCheckScenario({ mockBybit }, position);

      await service.deepSyncCheck(position);

      // Should handle gracefully
      expect(mockBybit.closePosition).not.toHaveBeenCalled();
    });
  });
});
