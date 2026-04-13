/**
 * Phase 9.P0 Safety Tests: Atomic Lock & Snapshots
 *
 * Tests for:
 * - P0.1: Atomic lock for position close (prevent timeout ↔ close race)
 * - P0.3: Atomic snapshots for concurrent reads (prevent WebSocket ↔ monitor race)
 *
 * Total: 9 tests
 */

import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { Position } from '../../types/legacy';
import { BotEventBus } from '../../services/event-bus';
import { LoggerService } from '../../services';
import { TelegramService } from '../../services/telegram.service';
import { TradingJournalService } from '../../services/trading-journal.service';
import { IExchange } from '../../interfaces/IExchange';
import {
  collectLifecycleSnapshots,
  createManagedPositionLifecycleSafetyContext,
  type ManagedPositionLifecycleSafetyContext,
  createLifecycleSafetyPosition,
  createLifecycleUpdatedSafetyPosition,
  findLifecycleLogCall,
} from '../helpers/position-lifecycle-test.utils';

describe('PositionLifecycleService - P0 Safety Tests', () => {
  let managedContext: ManagedPositionLifecycleSafetyContext;
  type PositionLifecycleSafetyMocks = {
    exchange: IExchange;
    logger: LoggerService;
    eventBus: BotEventBus;
    telegram: TelegramService;
    journal: TradingJournalService;
  };
  type PositionLifecycleSafetyInternals = ManagedPositionLifecycleSafetyContext['internals'];
  type PositionLifecycleSafetySetCurrentPosition = ManagedPositionLifecycleSafetyContext['setCurrentPosition'];
  type PositionLifecycleSafetyFixtures = {
    service: PositionLifecycleService;
    position: Position;
    internals: PositionLifecycleSafetyInternals;
    setCurrentPosition: PositionLifecycleSafetySetCurrentPosition;
    mocks: PositionLifecycleSafetyMocks;
  };
  let service: PositionLifecycleService;
  let position: Position;
  let internals: PositionLifecycleSafetyInternals;
  let setCurrentPosition: PositionLifecycleSafetySetCurrentPosition;
  let mockExchange: IExchange;
  let mockLogger: LoggerService;
  let mockEventBus: BotEventBus;
  let mockTelegram: TelegramService;
  let mockJournal: TradingJournalService;

  beforeEach(() => {
    managedContext = createManagedPositionLifecycleSafetyContext();
  });

  afterEach(() => {
    managedContext.cleanup();
  });

  beforeEach(() => {
    const fixtures: PositionLifecycleSafetyFixtures = {
      service: managedContext.service,
      position: managedContext.position,
      internals: managedContext.internals,
      setCurrentPosition: managedContext.setCurrentPosition,
      mocks: {
        exchange: managedContext.mockExchange,
        logger: managedContext.mockLogger,
        eventBus: managedContext.mockEventBus,
        telegram: managedContext.mockTelegram,
        journal: managedContext.mockJournal,
      },
    };
    service = fixtures.service;
    internals = fixtures.internals;
    setCurrentPosition = fixtures.setCurrentPosition;
    position = fixtures.position;
    mockExchange = fixtures.mocks.exchange;
    mockLogger = fixtures.mocks.logger;
    mockEventBus = fixtures.mocks.eventBus;
    mockTelegram = fixtures.mocks.telegram;
    mockJournal = fixtures.mocks.journal;
  });

  // =========================================================================
  // P0.1: ATOMIC LOCK TESTS
  // =========================================================================

  describe('P0.1: Atomic Lock for Position Close', () => {
    test('AL1: First close attempt succeeds', async () => {
      // Set position in service
      setCurrentPosition(position);

      await service.closePositionWithAtomicLock('Test close');

      // Position should be cleared after closing
      expect(internals().currentPosition).toBeNull();
      const infoCall = findLifecycleLogCall(
        mockLogger.info as jest.Mock,
        '[P0.1 + P3] Position closed successfully',
      );
      expect(infoCall).toBeDefined();
    });

    test('AL2: Concurrent close attempts wait for first', async () => {
      setCurrentPosition(position);

      // Start two concurrent closes
      const promise1 = service.closePositionWithAtomicLock('Close 1');
      const promise2 = service.closePositionWithAtomicLock('Close 2');

      await Promise.all([promise1, promise2]);

      // Position should be cleared only once (atomic lock prevented second)
      expect(internals().currentPosition).toBeNull();

      // Both should complete - second should warn about already closing
      const warnCall = findLifecycleLogCall(
        mockLogger.warn as jest.Mock,
        '[P0.1 + P3] Position already closing',
      );
      expect(warnCall).toBeDefined();
    });

    test('AL3: Lock released after successful close', async () => {
      setCurrentPosition(position);

      await service.closePositionWithAtomicLock('Close 1');

      // Lock should be cleaned up
      const positionClosing = internals().positionClosing;
      expect(positionClosing.has(position.id)).toBe(false);
    });

    test('AL4: Lock released after failed close', async () => {
      setCurrentPosition(position);
      (mockExchange.closePosition as jest.Mock).mockRejectedValueOnce(new Error('Exchange error'));

      try {
        await service.closePositionWithAtomicLock('Close fail');
      } catch {
        // Expected
      }

      // Lock should still be cleaned up even on error
      const positionClosing = internals().positionClosing;
      expect(positionClosing.has(position.id)).toBe(false);
    });

    test('AL5: Null reference check on stale position', async () => {
      setCurrentPosition(null); // Position already cleared

      await service.closePositionWithAtomicLock('Stale position');

      const infoCall = findLifecycleLogCall(
        mockLogger.info as jest.Mock,
        '[P0.1 + P3] Position already closed or not found',
      );
      expect(infoCall).toBeDefined();
      expect(mockExchange.closePosition).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // P0.3: ATOMIC SNAPSHOT TESTS
  // =========================================================================

  describe('P0.3: Atomic Position Snapshots', () => {
    test('AS1: Snapshot is deep copy, not reference', () => {
      setCurrentPosition(position);

      const snapshot = service.getPositionSnapshot();

      // Snapshot should not be same object reference
      expect(snapshot).not.toBe(position);
      expect(snapshot).toEqual(position); // But content should be same
    });

    test('AS2: Modifying snapshot doesn\'t affect original', () => {
      setCurrentPosition(position);
      const originalPnL = position.unrealizedPnL;

      const snapshot = service.getPositionSnapshot();
      if (snapshot) {
        snapshot.unrealizedPnL = 999999; // Modify snapshot
      }

      // Original should be unchanged
      expect(position.unrealizedPnL).toBe(originalPnL);
    });

    test('AS3: WebSocket changes don\'t affect in-flight snapshot', async () => {
      setCurrentPosition(position);

      // Get snapshot
      const snapshot = service.getPositionSnapshot();

      // Simulate WebSocket update
      const updated = createLifecycleUpdatedSafetyPosition({
        unrealizedPnL: 9000,
      });
      setCurrentPosition(updated);

      // Snapshot should still have original PnL
      expect(snapshot?.unrealizedPnL).toBe(500);

      // Current position should have new PnL
      expect(service.getCurrentPosition()?.unrealizedPnL).toBe(9000);
    });

    test('AS4: Multiple snapshots are independent', () => {
      setCurrentPosition(position);

      const snapshot1 = service.getPositionSnapshot();
      const snapshot2 = service.getPositionSnapshot();

      if (snapshot1 && snapshot2) {
        snapshot1.unrealizedPnL = 111;
        snapshot2.unrealizedPnL = 222;

        // Should be different
        expect(snapshot1.unrealizedPnL).toBe(111);
        expect(snapshot2.unrealizedPnL).toBe(222);
      }
    });

    test('AS5: Null position returns null snapshot', () => {
      setCurrentPosition(null);

      const snapshot = service.getPositionSnapshot();

      expect(snapshot).toBeNull();
    });

    test('AS6: Snapshot preserves all fields', () => {
      setCurrentPosition(position);

      const snapshot = service.getPositionSnapshot();

      expect(snapshot?.id).toBe(position.id);
      expect(snapshot?.symbol).toBe(position.symbol);
      expect(snapshot?.quantity).toBe(position.quantity);
      expect(snapshot?.entryPrice).toBe(position.entryPrice);
      expect(snapshot?.leverage).toBe(position.leverage);
      expect(snapshot?.unrealizedPnL).toBe(position.unrealizedPnL);
      expect(snapshot?.takeProfits).toEqual(position.takeProfits);
      expect(snapshot?.stopLoss).toEqual(position.stopLoss);
    });

    test('AS7: Snapshot can be used safely for calculations', () => {
      setCurrentPosition(position);

      const snapshot = service.getPositionSnapshot();

      // Simulate Phase 9 service calculations
      if (snapshot) {
        const pnlPercent = (snapshot.unrealizedPnL / snapshot.marginUsed) * 100;
        expect(pnlPercent).toBeCloseTo(11.11, 1); // 500 / 4500 * 100
      }
    });

    test('AS8: Concurrent snapshot reads are safe', async () => {
      setCurrentPosition(position);

      // Multiple concurrent snapshot reads
      const promises = collectLifecycleSnapshots(service, 3);

      const snapshots = await Promise.all(promises);

      // All should be valid and independent
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]).toEqual(position);
      expect(snapshots[1]).toEqual(position);
      expect(snapshots[2]).toEqual(position);
      expect(snapshots[0]).not.toBe(snapshots[1]); // Different objects
    });
  });

  // =========================================================================
  // P0.1 + P0.3 INTEGRATION TESTS
  // =========================================================================

  describe('P0.1 + P0.3 Integration', () => {
    test('INT1: Atomic lock + snapshots prevent race condition', async () => {
      setCurrentPosition(position);

      // Simulate: Health monitor gets snapshot while close happens
      const snapshotPromise = Promise.resolve(service.getPositionSnapshot());
      const closePromise = service.closePositionWithAtomicLock('Race test');

      const [snapshot] = await Promise.all([snapshotPromise]);

      // Snapshot should be valid even though close is happening
      expect(snapshot?.id).toBe(position.id);
      expect(snapshot?.unrealizedPnL).toBe(500);

      // Close should complete
      await closePromise;
      expect(service.getCurrentPosition()).toBeNull();
    });
  });
});
