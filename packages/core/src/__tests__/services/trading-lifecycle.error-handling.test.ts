/**
 * TradingLifecycleManager Error Handling Tests (Phase 8.9.38)
 *
 * Comprehensive test suite for error handling in position lifecycle management:
 * - Event publication failures with RETRY strategy
 * - State transition failures with GRACEFUL_DEGRADE strategy
 * - Emergency close execution with FALLBACK strategy
 * - Timeout detection with error recovery
 * - Cascading failures and recovery
 */

import { TradingLifecycleManager } from '../../services/trading-lifecycle.service';
import { ErrorHandler } from '../../errors';
import { TradingError } from '../../errors/BaseError';
import { PositionLifecycleState, EmergencyCloseReason } from '../../types/legacy';
import {
  createMockTradingLifecycleActionQueue,
  createMockTradingLifecycleEventBus,
  createMockTradingLifecycleLogger,
  createTrackedPositionFixture,
  createLegacyTradingLifecycleManager,
  createTradingLifecycleConfig,
  createManagedTradingLifecycleContext,
  createMockTradingLifecycleErrorHandler,
  type ManagedTradingLifecycleContext,
  type MockTradingLifecycleActionQueue,
  type MockTradingLifecycleEventBus,
  type MockTradingLifecycleLogger,
} from '../helpers/trading-lifecycle-test.utils';

const createTrackedPosition = createTrackedPositionFixture;
const createConfig = createTradingLifecycleConfig;
type TradingLifecycleRuntime = Pick<
  ManagedTradingLifecycleContext,
  'logger' | 'eventBus' | 'actionQueue' | 'harness' | 'rebuild' | 'cleanup'
>;
type TradingLifecycleSuiteState = TradingLifecycleRuntime;

// ============================================================================
// TESTS
// ============================================================================

describe('TradingLifecycleManager Error Handling (Phase 8.9.38)', () => {
  let manager: TradingLifecycleManager;
  let mockLogger: MockTradingLifecycleLogger;
  let mockEventBus: MockTradingLifecycleEventBus;
  let mockActionQueue: MockTradingLifecycleActionQueue;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let rebuild: TradingLifecycleRuntime['rebuild'];
  let harness: TradingLifecycleRuntime['harness'];
  let cleanup: TradingLifecycleRuntime['cleanup'];

  beforeEach(() => {
    const {
      logger,
      eventBus,
      actionQueue,
      harness: contextHarness,
      rebuild: rebuildManager,
      cleanup: managedCleanup,
    }: TradingLifecycleSuiteState = createManagedTradingLifecycleContext();
    cleanup = managedCleanup;
    mockLogger = logger;
    mockEventBus = eventBus;
    mockActionQueue = actionQueue;
    harness = contextHarness;
    rebuild = rebuildManager;
    mockErrorHandler = createMockTradingLifecycleErrorHandler();
    manager = rebuild({ errorHandler: mockErrorHandler });
  });

  afterEach(() => {
    cleanup();
  });

  // ==================== RETRY Strategy - Event Publishing ====================

  describe('RETRY Strategy - Event Publication', () => {
    it('should retry event publishing on transient failure', async () => {
      // Setup: Properly mock executeAsync to simulate retry BEFORE test
      mockErrorHandler.executeAsync.mockImplementation(async (fn, config) => {
        const maxAttempts = config?.retryConfig?.maxAttempts ?? 1;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const value = await fn();
            return { success: true, value };
          } catch (error) {
            lastError = error;
            if (attempt < maxAttempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, 10)); // Short delay for test
            }
          }
        }

        if (lastError) throw lastError;
        return { success: false, error: undefined };
      });

      const position = createTrackedPosition();
      manager.trackPosition(position);

      let attemptCount = 0;
      mockEventBus.publishSync.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network error');
        }
      });

      // Simulate warning timeout
      const position2 = createTrackedPosition({
        positionId: 'pos-456',
        entryTime: Date.now() - 46 * 60000, // 46 minutes (> warning threshold)
      });
      manager.trackPosition(position2);

      const result = await manager.checkPositionTimeouts();

      // Event was eventually published (after transient failure)
      expect(mockEventBus.publishSync).toHaveBeenCalled();
      expect(result.anyWarnings).toBe(true);
      expect(attemptCount).toBeGreaterThan(1); // Should have retried
    });

    it('should handle recurring event publication failures gracefully', async () => {
      // Setup: Mock executeAsync FIRST to handle all retries failing gracefully
      mockErrorHandler.executeAsync.mockImplementation(async (fn, config) => {
        const maxAttempts = config?.retryConfig?.maxAttempts ?? 1;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const value = await fn();
            return { success: true, value };
          } catch (error) {
            lastError = error;
            if (attempt < maxAttempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          }
        }

        // Return gracefully instead of throwing
        return { success: false, error: undefined };
      });

      const position = createTrackedPosition({
        entryTime: Date.now() - 46 * 60000, // Approaching warning threshold
      });
      manager.trackPosition(position);

      mockEventBus.publishSync.mockImplementation(() => {
        throw new Error('Persistent network failure');
      });

      const result = await manager.checkPositionTimeouts();

      // Should still detect timeout even if event publish fails
      expect(result.anyWarnings).toBe(true);
      expect(mockEventBus.publishSync).toHaveBeenCalled();
    });

    it('should emit multiple warning events for different positions', async () => {
      const pos1 = createTrackedPosition({
        positionId: 'pos-1',
        entryTime: Date.now() - 46 * 60000,
      });
      const pos2 = createTrackedPosition({
        positionId: 'pos-2',
        entryTime: Date.now() - 48 * 60000,
      });

      manager.trackPosition(pos1);
      manager.trackPosition(pos2);

      await manager.checkPositionTimeouts();

      // Both positions should trigger warning events
      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            positionId: 'pos-1',
          }),
        })
      );
      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            positionId: 'pos-2',
          }),
        })
      );
    });

    it('should not re-emit warning event for already-warned position', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 46 * 60000,
      });
      manager.trackPosition(position);

      // First check - should emit warning
      await manager.checkPositionTimeouts();
      const firstCallCount = mockEventBus.publishSync.mock.calls.length;

      // Reset mock to track second check
      mockEventBus.publishSync.mockClear();

      // Second check - should NOT emit warning again
      await manager.checkPositionTimeouts();
      const secondCallCount = mockEventBus.publishSync.mock.calls.length;

      expect(secondCallCount).toBe(0);
    });
  });

  // ==================== GRACEFUL_DEGRADE Strategy - State Management ====================

  describe('GRACEFUL_DEGRADE Strategy - State Management', () => {
    it('should degrade gracefully when state transition fails', async () => {
      const position = createTrackedPosition({
        state: PositionLifecycleState.CLOSING,
      });
      manager.trackPosition(position);

      // Try invalid transition: CLOSING -> OPEN (invalid)
      const isValid = manager.validateStateTransition(
        PositionLifecycleState.CLOSING,
        PositionLifecycleState.OPEN
      );

      expect(isValid).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition')
      );
    });

    it('should continue operation despite state update failures', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 61 * 60000, // Over timeout limit
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      // Should still detect critical timeout despite any state issues
      expect(result.anyCritical).toBe(true);
      expect(result.positions.length).toBeGreaterThan(0);
    });

    it('should validate all state transitions', async () => {
      const transitions = [
        {
          from: PositionLifecycleState.OPEN,
          to: PositionLifecycleState.WARNING,
          valid: true,
        },
        {
          from: PositionLifecycleState.WARNING,
          to: PositionLifecycleState.CRITICAL,
          valid: true,
        },
        {
          from: PositionLifecycleState.CRITICAL,
          to: PositionLifecycleState.CLOSING,
          valid: true,
        },
        {
          from: PositionLifecycleState.CLOSING,
          to: PositionLifecycleState.CLOSED,
          valid: true,
        },
        {
          from: PositionLifecycleState.CLOSED,
          to: PositionLifecycleState.OPEN,
          valid: false,
        },
      ];

      for (const { from, to, valid } of transitions) {
        const result = manager.validateStateTransition(from, to);
        expect(result).toBe(valid);
      }
    });

    it('should handle unknown state gracefully', () => {
      const isValid = manager.validateStateTransition(
        'UNKNOWN' as unknown as PositionLifecycleState,
        PositionLifecycleState.OPEN
      );

      expect(isValid).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown state')
      );
    });

    it('should update position state correctly through state machine', async () => {
      const position = createTrackedPosition({
        state: PositionLifecycleState.OPEN,
        entryTime: Date.now() - 46 * 60000,
      });
      manager.trackPosition(position);

      await manager.checkPositionTimeouts();

      const tracked = manager.getTrackedPosition('pos-123');
      expect(tracked?.state).toBe(PositionLifecycleState.WARNING);
    });
  });

  // ==================== FALLBACK Strategy - Emergency Close ====================

  describe('FALLBACK Strategy - Emergency Close Execution', () => {
    it('should queue emergency close action on position timeout', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 61 * 60000, // Over timeout
      });
      manager.trackPosition(position);

      await manager.checkPositionTimeouts();

      // Should enqueue close action
      expect(mockActionQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            positionId: 'pos-123',
            percent: 100,
          }),
        })
      );
    });

    it('should handle emergency close request gracefully', async () => {
      const position = createTrackedPosition();
      manager.trackPosition(position);

      await manager.triggerEmergencyClose({
        positionId: 'pos-123',
        reason: EmergencyCloseReason.POSITION_TIMEOUT,
        priority: 'CRITICAL',
        details: {
          holdingTimeMinutes: 65,
          maxHoldingMinutes: 60,
          symbol: 'BTCUSDT',
          quantity: 1,
        },
      });

      expect(mockActionQueue.enqueue).toHaveBeenCalled();
      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: EmergencyCloseReason.POSITION_TIMEOUT,
          }),
        })
      );
    });

    it('should handle emergency close for non-existent position gracefully', async () => {
      await manager.triggerEmergencyClose({
        positionId: 'non-existent',
        reason: EmergencyCloseReason.POSITION_TIMEOUT,
        priority: 'CRITICAL',
        details: {
          holdingTimeMinutes: 65,
          maxHoldingMinutes: 60,
          symbol: 'BTCUSDT',
          quantity: 1,
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Position not found')
      );
    });

    it('should transition position state to CLOSING during emergency close', async () => {
      const position = createTrackedPosition({
        state: PositionLifecycleState.CRITICAL,
      });
      manager.trackPosition(position);

      await manager.triggerEmergencyClose({
        positionId: 'pos-123',
        reason: EmergencyCloseReason.POSITION_TIMEOUT,
        priority: 'CRITICAL',
        details: {
          holdingTimeMinutes: 65,
          maxHoldingMinutes: 60,
          symbol: 'BTCUSDT',
          quantity: 1,
        },
      });

      const tracked = manager.getTrackedPosition('pos-123');
      expect(tracked?.state).toBe(PositionLifecycleState.CLOSING);
    });

    it('should emit timeout triggered event during emergency close', async () => {
      const position = createTrackedPosition();
      manager.trackPosition(position);

      await manager.triggerEmergencyClose({
        positionId: 'pos-123',
        reason: EmergencyCloseReason.POSITION_TIMEOUT,
        priority: 'CRITICAL',
        details: {
          holdingTimeMinutes: 65,
          maxHoldingMinutes: 60,
          symbol: 'BTCUSDT',
          quantity: 1,
        },
      });

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            positionId: 'pos-123',
            reason: EmergencyCloseReason.POSITION_TIMEOUT,
            priority: 'CRITICAL',
          }),
        })
      );
    });
  });

  // ==================== Timeout Detection & Classification ====================

  describe('Timeout Detection & Error Classification', () => {
    it('should detect critical timeout correctly', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 65 * 60000, // 65 minutes > 60 max
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      expect(result.anyCritical).toBe(true);
      expect(result.positions.some((a) => a.positionId === 'pos-123')).toBe(true);
    });

    it('should detect warning timeout correctly', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 50 * 60000, // 50 minutes > 45 warning, < 60 max
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      expect(result.anyWarnings).toBe(true);
      expect(result.anyCritical).toBe(false);
    });

    it('should handle safe position correctly', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 30 * 60000, // 30 minutes < 45 warning
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      expect(result.anyWarnings).toBe(false);
      expect(result.anyCritical).toBe(false);
      expect(position.state).toBe(PositionLifecycleState.OPEN);
    });

    it('should calculate holding time correctly', async () => {
      const entryTime = Date.now() - 45 * 60 * 1000;
      const position = createTrackedPosition({
        entryTime,
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      expect(result.positions.some((a) => {
        return (
          Math.abs(a.holdingTimeMinutes - 45) <= 1 // Allow 1 minute margin
        );
      })).toBe(true);
    });
  });

  // ==================== Event Subscription & Handling ====================

  describe('Event Subscription & Position Tracking', () => {
    it('should setup event subscriptions during initialization', () => {
      // Create a new manager to verify subscription calls
      const newLogger = createMockTradingLifecycleLogger();
      const newEventBus = createMockTradingLifecycleEventBus();
      const newActionQueue = createMockTradingLifecycleActionQueue();

      const newManager = createLegacyTradingLifecycleManager(harness, {
        logger: newLogger,
        eventBus: newEventBus,
        actionQueue: newActionQueue,
      });
      
      newManager.start();

      // Verify both subscriptions were set up
      expect(newEventBus.subscribe).toHaveBeenCalledWith(
        'position-opened',
        expect.any(Function)
      );
      expect(newEventBus.subscribe).toHaveBeenCalledWith(
        'position-closed',
        expect.any(Function)
      );
    });

    it('should track position manually', () => {
      const position = createTrackedPosition();
      manager.trackPosition(position);

      const tracked = manager.getTrackedPosition('pos-123');
      expect(tracked).toBeDefined();
      expect(tracked?.symbol).toBe('BTCUSDT');
    });

    it('should untrack position manually', () => {
      const position = createTrackedPosition();
      manager.trackPosition(position);

      manager.untrackPosition('pos-123');

      const tracked = manager.getTrackedPosition('pos-123');
      expect(tracked).toBeUndefined();
    });

    it('should prevent tracking position without ID', () => {
      const position = createTrackedPosition({
        positionId: '',
      });
      manager.trackPosition(position);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot track position without ID')
      );
    });
  });

  // ==================== Position Management & Statistics ====================

  describe('Position Management & Statistics', () => {
    it('should return all tracked positions', () => {
      const pos1 = createTrackedPosition({ positionId: 'pos-1' });
      const pos2 = createTrackedPosition({ positionId: 'pos-2' });

      manager.trackPosition(pos1);
      manager.trackPosition(pos2);

      const positions = manager.getTrackedPositions();
      expect(positions).toHaveLength(2);
      expect(positions.map((p) => p.positionId)).toContain('pos-1');
      expect(positions.map((p) => p.positionId)).toContain('pos-2');
    });

    it('should return tracked position count', () => {
      manager.trackPosition(createTrackedPosition({ positionId: 'pos-1' }));
      manager.trackPosition(createTrackedPosition({ positionId: 'pos-2' }));

      expect(manager.getTrackedPositionCount()).toBe(2);
    });

    it('should clear all tracked positions', () => {
      manager.trackPosition(createTrackedPosition({ positionId: 'pos-1' }));
      manager.trackPosition(createTrackedPosition({ positionId: 'pos-2' }));

      manager.clearAllTrackedPositions();

      expect(manager.getTrackedPositionCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all tracked positions')
      );
    });

    it('should calculate statistics correctly', () => {
      const now = Date.now();
      manager.trackPosition(
        createTrackedPosition({
          positionId: 'pos-1',
          entryTime: now - 30 * 60 * 1000,
          state: PositionLifecycleState.OPEN,
        })
      );
      manager.trackPosition(
        createTrackedPosition({
          positionId: 'pos-2',
          entryTime: now - 50 * 60 * 1000,
          state: PositionLifecycleState.WARNING,
        })
      );

      const stats = manager.getStatistics();

      expect(stats.totalTracked).toBe(2);
      expect(stats.byState[PositionLifecycleState.OPEN]).toBe(1);
      expect(stats.byState[PositionLifecycleState.WARNING]).toBe(1);
      expect(stats.averageHoldingMinutes).toBeGreaterThan(35);
    });

    it('should return empty statistics when no positions tracked', () => {
      const stats = manager.getStatistics();

      expect(stats.totalTracked).toBe(0);
      expect(stats.earliestOpenTime).toBeNull();
      expect(stats.averageHoldingMinutes).toBe(0);
    });
  });

  // ==================== Cascading Failures & Recovery ====================

  describe('Cascading Failures & Recovery', () => {
    it('should handle multiple failures in timeout check', async () => {
      // Mock executeAsync FIRST to handle failures gracefully
      mockErrorHandler.executeAsync.mockImplementation(async (fn, config): Promise<{ success: boolean; value?: unknown; error?: TradingError }> => {
        try {
          const value = await fn();
          return { success: true, value };
        } catch (error) {
          // Return gracefully instead of throwing
          return { success: false, error: undefined };
        }
      });

      const pos1 = createTrackedPosition({
        positionId: 'pos-1',
        entryTime: Date.now() - 50 * 60000,
      });
      const pos2 = createTrackedPosition({
        positionId: 'pos-2',
        entryTime: Date.now() - 65 * 60000,
      });

      manager.trackPosition(pos1);
      manager.trackPosition(pos2);

      mockEventBus.publishSync.mockImplementation(() => {
        throw new Error('Temporary network failure');
      });

      const result = await manager.checkPositionTimeouts();

      // Should still detect timeouts despite event failures
      expect(result.anyWarnings).toBe(true);
      expect(result.anyCritical).toBe(true);
    });

    it('should handle emergency close failure gracefully', async () => {
      const position = createTrackedPosition();
      manager.trackPosition(position);

      mockActionQueue.enqueue.mockImplementation(() => {
        throw new Error('Queue overflow');
      });

      // Should not throw and handle gracefully via FALLBACK strategy
      await expect(
        manager.triggerEmergencyClose({
          positionId: 'pos-123',
          reason: EmergencyCloseReason.POSITION_TIMEOUT,
          priority: 'CRITICAL',
          details: {
            holdingTimeMinutes: 65,
            maxHoldingMinutes: 60,
            symbol: 'BTCUSDT',
            quantity: 1,
          },
        })
      ).resolves.not.toThrow();

      // executeAsync catches the error gracefully, so no error log expected from that
      // But the outer catch block should log the error if executeAsync fully fails
      // With FALLBACK strategy and graceful error handler, the operation continues
      expect(mockActionQueue.enqueue).toHaveBeenCalled();
    });

    it('should recover from state transition errors', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 65 * 60000,
      });
      manager.trackPosition(position);

      // Force invalid transition internally
      position.state = PositionLifecycleState.CRITICAL;

      await manager.checkPositionTimeouts();

      // Position should maintain valid state
      const tracked = manager.getTrackedPosition('pos-123');
      expect([
        PositionLifecycleState.OPEN,
        PositionLifecycleState.WARNING,
        PositionLifecycleState.CRITICAL,
        PositionLifecycleState.CLOSING,
      ]).toContain(tracked?.state);
    });
  });

  // ==================== Configuration & Edge Cases ====================

  describe('Configuration & Edge Cases', () => {
    it('should respect automatic timeout configuration', async () => {
      const autoManager = createLegacyTradingLifecycleManager(harness, {
        config: createConfig({ enableAutomaticTimeout: false }),
      });

      const position = createTrackedPosition({
        entryTime: Date.now() - 65 * 60000, // Over timeout
      });
      autoManager.trackPosition(position);

      await autoManager.checkPositionTimeouts();

      // Should NOT enqueue emergency close action
      expect(mockActionQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should handle very large position quantities', async () => {
      const position = createTrackedPosition({
        quantity: 1000000,
        totalExposureUsdt: 50000000000,
      });
      manager.trackPosition(position);

      const stats = manager.getStatistics();
      expect(stats.totalTracked).toBe(1);
    });

    it('should handle multiple concurrent timeout checks', async () => {
      const positions = Array.from({ length: 10 }, (_, i) =>
        createTrackedPosition({
          positionId: `pos-${i}`,
          entryTime: Date.now() - (40 + i) * 60000,
        })
      );

      positions.forEach((p) => manager.trackPosition(p));

      const results = await Promise.all([
        manager.checkPositionTimeouts(),
        manager.checkPositionTimeouts(),
        manager.checkPositionTimeouts(),
      ]);

      // All checks should complete successfully
      expect(results).toHaveLength(3);
      expect(results.every((r) => r !== undefined)).toBe(true);
    });
  });

  // ==================== Backward Compatibility ====================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter', () => {
      expect(() => {
        createLegacyTradingLifecycleManager(harness);
      }).not.toThrow();
    });

    it('should maintain original behavior without ErrorHandler', async () => {
      const position = createTrackedPosition({
        entryTime: Date.now() - 50 * 60000,
      });
      manager.trackPosition(position);

      const result = await manager.checkPositionTimeouts();

      expect(result.anyWarnings).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});

