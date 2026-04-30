/**
 * Orderbook Manager Service - Error Handling Tests (Phase 8.9.18)
 *
 * Tests that ErrorHandler integration works correctly with:
 * - WallTracker integration errors (GRACEFUL_DEGRADE)
 * - NaN price/size validation (SKIP)
 * - Stale snapshot handling (GRACEFUL_DEGRADE)
 * - Memory management and trimming
 * - Backward compatibility without ErrorHandler
 */

import { WallTrackerService } from '../../services/wall-tracker.service';
import { OrderbookUpdate } from '../../services/orderbook-manager.service';
import { ErrorHandler } from '../../errors';
import { LoggerService } from '../../types/legacy';
import {
  createOrderbookDeltaFixture,
  createOrderbookLevels,
  createManagedOrderbookManagerContext,
  createOrderbookSnapshotFixture,
  initializeOrderbookManager,
  type OrderbookManagerErrorHandlingRuntime,
} from '../helpers/orderbook-manager-test.utils';

describe('OrderbookManagerService - Error Handling Integration (Phase 8.9.18)', () => {
  let service: OrderbookManagerErrorHandlingRuntime['service'];
  let errorHandler: OrderbookManagerErrorHandlingRuntime['errorHandler'];
  let mockLogger: OrderbookManagerErrorHandlingRuntime['mockLogger'];
  let loggerService: OrderbookManagerErrorHandlingRuntime['loggerService'];
  let createLegacyService: OrderbookManagerErrorHandlingRuntime['createLegacyService'];
  let createServiceWithoutWallTracker: OrderbookManagerErrorHandlingRuntime['createServiceWithoutWallTracker'];
  let mockWallTracker: OrderbookManagerErrorHandlingRuntime['mockWallTracker'];
  let cleanup: OrderbookManagerErrorHandlingRuntime['cleanup'];

  beforeEach(() => {
    ({
      service,
      mockLogger,
      loggerService,
      createLegacyService,
      createServiceWithoutWallTracker,
      mockWallTracker,
      errorHandler,
      cleanup,
    } = createManagedOrderbookManagerContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // BASIC FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Basic Orderbook Operations', () => {
    it('should initialize on first snapshot', () => {
      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture();

      service.processUpdate(snapshot);

      expect(service.isReady()).toBe(true);
      const result = service.getSnapshot();
      expect(result).not.toBeNull();
      expect(result?.bids[0].price).toBe(45000);
    });

    it('should apply delta updates after snapshot', () => {
      initializeOrderbookManager(service);

      // Delta update
      const delta: OrderbookUpdate = createOrderbookDeltaFixture();
      service.processUpdate(delta);

      const result = service.getSnapshot();
      expect(result?.bids.length).toBe(2);
    });

    it('should skip delta before snapshot', () => {
      const delta: OrderbookUpdate = createOrderbookDeltaFixture({
        bids: [['45000', '1.0']],
        updateId: 1,
      });

      service.processUpdate(delta);
      expect(service.isReady()).toBe(false);
    });
  });

  // ==========================================================================
  // ERROR HANDLING WITH ERRORHANDLER TESTS
  // ==========================================================================

  describe('Error Handling - WallTracker Integration', () => {
    it('should GRACEFUL_DEGRADE when detectWall throws', () => {
      mockWallTracker.detectWall.mockImplementation(() => {
        throw new Error('WallTracker error');
      });

      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        asks: [],
      });

      // Should not throw despite wall tracker error
      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      expect(result).not.toBeNull();
      expect(result?.bids[0].price).toBe(45000);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WallTracker detectWall failed (continuing)',
        expect.objectContaining({
          price: 45000,
          side: 'BID',
          error: 'WallTracker error',
        }),
      );
    });

    it('should GRACEFUL_DEGRADE when removeWall throws', () => {
      mockWallTracker.removeWall.mockImplementation(() => {
        throw new Error('WallTracker error');
      });

      initializeOrderbookManager(service, {
        asks: [],
      });

      // Remove level (size 0)
      const delta: OrderbookUpdate = createOrderbookDeltaFixture({
        bids: [['45000', '0']],
      });

      service.processUpdate(delta);

      const result = service.getSnapshot();
      expect(result?.bids.length).toBe(0); // Level deleted despite error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WallTracker removeWall failed (continuing)',
        expect.objectContaining({
          price: 45000,
          side: 'BID',
          error: 'WallTracker error',
        }),
      );
    });

    it('should continue processing after wall tracker error', () => {
      mockWallTracker.detectWall.mockImplementationOnce(() => {
        throw new Error('WallTracker error');
      });

      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [
          ['45000', '1.0'], // Will fail wall tracker
          ['44999', '2.0'], // Should still process
        ],
        asks: [],
      });

      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      // Both bids should be processed despite first wall tracker error
      expect(result?.bids.length).toBe(2);
    });
  });

  describe('Error Handling - NaN Validation', () => {
    it('should SKIP level with NaN price', () => {
      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [
          ['45000', '1.0'], // Valid
          ['invalid', '2.0'], // Invalid - NaN price
          ['44999', '3.0'], // Valid
        ],
        asks: [],
      });

      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      // Only valid prices should be in orderbook
      expect(result?.bids.length).toBe(2);
      const prices = result?.bids.map((b) => b.price) || [];
      expect(prices).toContain(45000);
      expect(prices).toContain(44999);
      expect(prices).not.toContain(NaN);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipped invalid level (BID)',
        expect.objectContaining({ price: 'invalid', size: '2.0' }),
      );
    });

    it('should SKIP level with NaN size', () => {
      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [['45000', '1.0'], ['44999', 'invalid']],
        asks: [],
      });

      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      expect(result?.bids.length).toBe(1); // Invalid size skipped
      expect(result?.bids[0].price).toBe(45000);
    });

    it('should handle mix of valid and invalid levels', () => {
      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [
          ['45000', '1.0'], // Valid
          ['invalid', '2.0'], // Invalid price
          ['44999', '3.0'], // Valid
          ['44998', 'invalid'], // Invalid size
          ['44997', '5.0'], // Valid
        ],
        asks: [],
      });

      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      expect(result?.bids.length).toBe(3); // Only 3 valid levels
    });
  });

  describe('Error Handling - Staleness', () => {
    it('should GRACEFUL_DEGRADE for stale snapshot with ErrorHandler', () => {
      jest.useFakeTimers();

      initializeOrderbookManager(service);

      // Advance time past threshold (60 seconds)
      jest.advanceTimersByTime(61000);

      const result = service.getSnapshot();

      // With ErrorHandler, should serve stale data in degraded mode
      expect(result).not.toBeNull();
      expect(result?.bids[0].price).toBe(45000);
      expect(mockLogger.warn).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should return null for stale snapshot without ErrorHandler', () => {
      jest.useFakeTimers();

      // Service without error handler
      const legacyService = createLegacyService({
        symbol: 'BTCUSDT',
        logger: loggerService,
        wallTracker: mockWallTracker as unknown as WallTrackerService,
      });

      initializeOrderbookManager(legacyService, {
        bids: [['45000', '1.0']],
        asks: [],
      });

      jest.advanceTimersByTime(61000);

      const result = legacyService.getSnapshot();
      expect(result).toBeNull(); // Returns null without ErrorHandler

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // MEMORY MANAGEMENT TESTS
  // ==========================================================================

  describe('Memory Management', () => {
    it('should track orderbook stats correctly', () => {
      initializeOrderbookManager(service, {
        bids: [
          ['45000', '1.0'],
          ['44999', '2.0'],
        ],
      });

      const stats = service.getStats();
      expect(stats.bidsCount).toBe(2);
      expect(stats.asksCount).toBe(1);
      expect(stats.initialized).toBe(true);
    });

    it('should reset orderbook correctly', () => {
      initializeOrderbookManager(service);
      expect(service.isReady()).toBe(true);

      service.reset();

      expect(service.isReady()).toBe(false);
      expect(service.getSnapshot()).toBeNull();
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ==========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      const legacyService = createLegacyService({
        symbol: 'BTCUSDT',
        logger: loggerService,
        wallTracker: mockWallTracker as unknown as WallTrackerService,
      });

      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture();

      legacyService.processUpdate(snapshot);

      const result = legacyService.getSnapshot();
      expect(result).not.toBeNull();
      expect(result?.bids[0].price).toBe(45000);
    });

    it('should work without WallTracker', () => {
      const serviceNoWall = createServiceWithoutWallTracker({
        symbol: 'BTCUSDT',
        logger: loggerService,
        errorHandler,
      });

      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture();

      serviceNoWall.processUpdate(snapshot);

      const result = serviceNoWall.getSnapshot();
      expect(result).not.toBeNull();
    });

    it('should work without either ErrorHandler or WallTracker', () => {
      const minimalService = createLegacyService({
        symbol: 'BTCUSDT',
        logger: loggerService,
        wallTracker: undefined,
      });

      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        asks: [],
      });

      minimalService.processUpdate(snapshot);

      const result = minimalService.getSnapshot();
      expect(result).not.toBeNull();
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle snapshot replacement', () => {
      initializeOrderbookManager(service);

      // Second snapshot replaces data
      const snapshot2: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [['46000', '2.0']],
        asks: [['46100', '2.0']],
        updateId: 2,
      });
      service.processUpdate(snapshot2);

      const result = service.getSnapshot();
      expect(result?.bids[0].price).toBe(46000); // New snapshot
      expect(result?.asks[0].price).toBe(46100);
    });

    it('should handle rapid snapshot/delta sequence', () => {
      initializeOrderbookManager(service);

      const deltas: OrderbookUpdate[] = [
        createOrderbookDeltaFixture(),
        createOrderbookDeltaFixture({
          bids: [],
          asks: [['45101', '2.0']],
          updateId: 3,
        }),
      ];

      deltas.forEach((d) => service.processUpdate(d));

      const result = service.getSnapshot();
      expect(result?.updateId).toBe(3);
      expect(result?.bids.length).toBe(2);
      expect(result?.asks.length).toBe(2);
    });

    it('should preserve best levels with proper sorting', () => {
      const descendingBids = createOrderbookLevels({ start: 45002, count: 3, direction: 'desc' });
      const ascendingAsks = createOrderbookLevels({ start: 45100, count: 3, direction: 'asc' });
      const snapshot: OrderbookUpdate = createOrderbookSnapshotFixture({
        bids: [descendingBids[2], descendingBids[0], descendingBids[1]],
        asks: [ascendingAsks[2], ascendingAsks[0], ascendingAsks[1]],
      });

      service.processUpdate(snapshot);

      const result = service.getSnapshot();
      // Bids should be sorted descending (highest first)
      expect(result?.bids[0].price).toBe(45002);
      expect(result?.bids[1].price).toBe(45001);
      expect(result?.bids[2].price).toBe(45000);

      // Asks should be sorted ascending (lowest first)
      expect(result?.asks[0].price).toBe(45100);
      expect(result?.asks[1].price).toBe(45101);
      expect(result?.asks[2].price).toBe(45102);
    });
  });
});
