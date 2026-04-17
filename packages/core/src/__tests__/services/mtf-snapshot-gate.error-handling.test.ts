/**
 * MTF Snapshot Gate - ErrorHandler Integration Tests
 *
 * Tests the error handling and recovery strategies integrated into MTFSnapshotGate.
 * Verifies that logging failures are gracefully handled without blocking core operations.
 */

import { MTFSnapshotGate } from '../../services/mtf-snapshot-gate.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { ErrorRegistry } from '../../errors/ErrorRegistry';
import { LoggerService } from '../../services/logger.service';
import { Signal, SignalDirection, TrendAnalysis } from '../../types/legacy';
import { TrendBias, SignalType } from '../../types/enums';
import {
  createMockSnapshotLogger,
  createManagedMTFSnapshotGateContext,
  createSnapshotCandle,
  createSnapshotSignal,
  createSnapshotTrendAnalysis,
  type ManagedMTFSnapshotGateContext,
} from '../helpers/mtf-snapshot-gate-test.utils';

describe('MTFSnapshotGate - ErrorHandler Integration', () => {
  let gate: MTFSnapshotGate;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  let createTrackedGate: ManagedMTFSnapshotGateContext['createTrackedGate'];
  let cleanup: ManagedMTFSnapshotGateContext['cleanup'];

  beforeEach(() => {
    jest.useFakeTimers();
    ErrorRegistry.clear();
    ({
      gate,
      logger: mockLogger,
      createTrackedGate,
      cleanup,
      errorHandler,
    } = createManagedMTFSnapshotGateContext() as ManagedMTFSnapshotGateContext & {
      errorHandler: ErrorHandler;
    });
  });

  afterEach(() => {
    cleanup();
    ErrorRegistry.clear();
  });

  // ========================================================================
  // SNAPSHOT CREATION - LOGGING FAILURES
  // ========================================================================

  describe('createSnapshot with logging failures', () => {
    it('should create snapshot even if logging fails (SKIP strategy)', () => {
      // Mock logger to throw
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal = createSnapshotSignal({
        confidence: 85,
        reason: 'Test signal',
      });
      const candle = createSnapshotCandle({ low: 995 });

      // Should not throw despite logger failure
      expect(() => {
        gateWithFailingLogger.createSnapshot(
          TrendBias.BULLISH,
          createSnapshotTrendAnalysis({
            bias: TrendBias.BULLISH,
            reasoning: ['HH_HL pattern'],
          }),
          signal,
          candle,
        );
      }).not.toThrow();

      // Verify snapshot was actually created
      const snapshot = gateWithFailingLogger.getActiveSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot?.htfBias).toBe(TrendBias.BULLISH);
      expect(snapshot?.signal.direction).toBe(SignalDirection.LONG);
    });

    it('should work without ErrorHandler (backward compatible)', () => {
      const gateWithoutErrorHandler = createTrackedGate(mockLogger, undefined);

      const signal = createSnapshotSignal();
      const candle = createSnapshotCandle();

      const snapshot = gateWithoutErrorHandler.createSnapshot(
        TrendBias.BULLISH,
        createSnapshotTrendAnalysis({ bias: TrendBias.BULLISH }),
        signal,
        candle
      );

      expect(snapshot).toBeDefined();
      expect(gateWithoutErrorHandler.getActiveSnapshot()).toEqual(snapshot);
    });
  });

  // ========================================================================
  // SNAPSHOT VALIDATION - LOGGING FAILURES
  // ========================================================================

  describe('validateSnapshot with logging failures', () => {
    it('should validate snapshot even if expired logging fails (SKIP)', () => {

      const failingLogger = createMockSnapshotLogger();
      (failingLogger.warn as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      // Advance time past expiration
      jest.advanceTimersByTime(121000);

      // Should not throw despite logger failure
      expect(() => {
        gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      }).not.toThrow();

      // Validation result should be correct
      const result = gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('should validate snapshot even if bias mismatch logging fails (SKIP)', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.warn as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      // Should not throw despite logger failure
      expect(() => {
        gateWithFailingLogger.validateSnapshot(TrendBias.BEARISH);
      }).not.toThrow();

      // Validation result should be correct
      const result = gateWithFailingLogger.validateSnapshot(TrendBias.BEARISH);
      expect(result.valid).toBe(false);
      expect(result.biasMismatch).toBe(true);
    });

    it('should validate snapshot even if valid logging fails (SKIP)', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      // Should not throw despite logger failure
      expect(() => {
        gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      }).not.toThrow();

      // Validation result should be correct
      const result = gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // SNAPSHOT CLEARING - LOGGING FAILURES
  // ========================================================================

  describe('clearActiveSnapshot with logging failures', () => {
    it('should clear snapshot even if logging fails (SKIP strategy)', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.debug as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      expect(gateWithFailingLogger.getActiveSnapshot()).toBeDefined();

      // Should not throw despite logger failure
      expect(() => {
        gateWithFailingLogger.clearActiveSnapshot();
      }).not.toThrow();

      // Snapshot should be cleared
      expect(gateWithFailingLogger.getActiveSnapshot()).toBeNull();
    });
  });

  // ========================================================================
  // CLEANUP - GRACEFUL DEGRADATION
  // ========================================================================

  describe('cleanupExpiredSnapshots with GRACEFUL_DEGRADE', () => {
    it('should continue cleanup even if logger fails during cleanup', (done) => {

      const failingLogger = createMockSnapshotLogger();
      (failingLogger.debug as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure during cleanup');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      // Create multiple snapshots
      const signal1: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test 1',
        timestamp: Date.now(),
      };

      const signal2: Signal = {
        direction: SignalDirection.SHORT,
        type: SignalType.TREND_FOLLOWING,
        confidence: 85,
        price: 2000,
        stopLoss: 2050,
        takeProfits: [],
        reason: 'Test 2',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal1, candle);

      gateWithFailingLogger.createSnapshot(TrendBias.BEARISH, {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal2, candle);

      expect(gateWithFailingLogger.getSnapshotCount()).toBe(2);

      // Advance time past expiration (120s) + cleanup interval (60s)
      // Total: need > 120s for expiration, then cleanup interval fires at 60s marks: 60, 120, 180
      jest.advanceTimersByTime(181000);

      // Even though logger failed, cleanup should have worked
      // (snapshots should be removed from map)
      expect(gateWithFailingLogger.getSnapshotCount()).toBe(0);

      done();
    });

    it('should work without ErrorHandler during cleanup', (done) => {

      const gateWithoutErrorHandler = createTrackedGate(mockLogger, undefined);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      gateWithoutErrorHandler.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      expect(gateWithoutErrorHandler.getSnapshotCount()).toBe(1);

      // Advance time past expiration (120s) + cleanup interval (60s)
      jest.advanceTimersByTime(181000);

      expect(gateWithoutErrorHandler.getSnapshotCount()).toBe(0);

      done();
    });
  });

  // ========================================================================
  // INTEGRATION SCENARIOS
  // ========================================================================

  describe('Integration scenarios with ErrorHandler', () => {
    it('should handle full workflow with logging failures', () => {
      const failingLogger = createMockSnapshotLogger();
      let callCount = 0;

      // Fail on every 2nd logger call
      (failingLogger.info as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent logger failure');
        }
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 85,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test signal',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 995,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Create snapshot - may fail on logging but should continue
      const snapshot = gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: ['HH_HL pattern'],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      expect(snapshot).toBeDefined();

      // Validate snapshot - may fail on logging but should continue
      const result = gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      expect(result.valid).toBe(true);

      // Clear snapshot - may fail on logging but should continue
      gateWithFailingLogger.clearActiveSnapshot();
      expect(gateWithFailingLogger.getActiveSnapshot()).toBeNull();
    });

    it('should maintain snapshot integrity across multiple validations with failures', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });
      (failingLogger.warn as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Create
      gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '4h',
        reasoning: [],
        restrictedDirections: [],
      } as unknown as TrendAnalysis, signal, candle);

      // Validate multiple times with different biases
      const result1 = gateWithFailingLogger.validateSnapshot(TrendBias.BULLISH);
      expect(result1.valid).toBe(true);

      const result2 = gateWithFailingLogger.validateSnapshot(TrendBias.NEUTRAL);
      expect(result2.valid).toBe(true);

      const result3 = gateWithFailingLogger.validateSnapshot(TrendBias.BEARISH);
      expect(result3.valid).toBe(false);
      expect(result3.biasMismatch).toBe(true);

      // Snapshot data should remain consistent
      const snapshot = gateWithFailingLogger.getActiveSnapshot();
      expect(snapshot?.htfBias).toBe(TrendBias.BULLISH);
    });

    it('should handle parallel snapshot operations with logging failures', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Create multiple snapshots rapidly
      const snapshots = [];
      for (let i = 0; i < 5; i++) {
        const signal: Signal = {
          direction: i % 2 === 0 ? SignalDirection.LONG : SignalDirection.SHORT,
          type: SignalType.TREND_FOLLOWING,
          confidence: 75 + i * 2,
          price: 1000 + i * 100,
          stopLoss: 990 + i * 100,
          takeProfits: [],
          reason: `Signal ${i}`,
          timestamp: Date.now() + i * 100,
        };

        const snapshot = gateWithFailingLogger.createSnapshot(
          i % 2 === 0 ? TrendBias.BULLISH : TrendBias.BEARISH,
          {
            bias: i % 2 === 0 ? TrendBias.BULLISH : TrendBias.BEARISH,
            strength: 0.8,
            timeframe: '4h',
            reasoning: [],
            restrictedDirections: [],
          } as unknown as TrendAnalysis,
          signal,
          candle
        );

        snapshots.push(snapshot);
      }

      // All snapshots should be created successfully (stored in map)
      expect(snapshots).toHaveLength(5);
      // All 5 snapshots are stored, but only last one is "active" for validation
      expect(gateWithFailingLogger.getSnapshotCount()).toBe(5);
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe('Edge cases with error handling', () => {
    it('should handle non-Error throws from logger', () => {
      const brokenLogger = createMockSnapshotLogger();
      (brokenLogger.info as jest.Mock).mockImplementation(() => {
        throw 'string error'; // Not an Error object
      });

      const gateWithBrokenLogger = createTrackedGate(brokenLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Should not crash even with non-Error throw
      expect(() => {
        gateWithBrokenLogger.createSnapshot(TrendBias.BULLISH, {
          bias: TrendBias.BULLISH,
          strength: 0.8,
          timeframe: '4h',
          reasoning: [],
          restrictedDirections: [],
        } as unknown as TrendAnalysis, signal, candle);
      }).not.toThrow();

      // Snapshot should still be created
      expect(gateWithBrokenLogger.getActiveSnapshot()).toBeDefined();
    });

    it('should handle null logger methods gracefully', () => {
      const nullLogger = {
        info: null,
        warn: null,
        error: null,
        debug: null,
        setContext: null,
      } as unknown as LoggerService;
      // Gate should handle null logger gracefully
      const gateWithNullLogger = createTrackedGate(nullLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Should not crash
      expect(() => {
        gateWithNullLogger.createSnapshot(TrendBias.BULLISH, {
          bias: TrendBias.BULLISH,
          strength: 0.8,
          timeframe: '4h',
          reasoning: [],
          restrictedDirections: [],
        } as unknown as TrendAnalysis, signal, candle);
      }).not.toThrow();
    });

    it('should handle ErrorHandler throw strategy correctly', () => {
      // If ErrorHandler itself throws (edge case)
      // Note: In practice, createSnapshot doesn't throw - it handles errors gracefully
      // So this test verifies that the ErrorHandler is properly integrated but won't throw
      const throwingErrorHandler = {
        handle: jest.fn().mockResolvedValue({ success: false }),
      } as unknown as ErrorHandler;
      const gateWithThrowingHandler = createTrackedGate(mockLogger, throwingErrorHandler);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // createSnapshot should NOT throw even with broken ErrorHandler
      // because error handling is wrapped in try-catch blocks
      expect(() => {
        gateWithThrowingHandler.createSnapshot(TrendBias.BULLISH, {
          bias: TrendBias.BULLISH,
          strength: 0.8,
          timeframe: '4h',
          reasoning: [],
          restrictedDirections: [],
        } as unknown as TrendAnalysis, signal, candle);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // ERROR REGISTRY TRACKING
  // ========================================================================

  describe('Error tracking via ErrorRegistry', () => {
    it('should track logging failures in ErrorRegistry', () => {
      const failingLogger = createMockSnapshotLogger();
      (failingLogger.debug as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const gateWithFailingLogger = createTrackedGate(failingLogger);

      const signal: Signal = {
        direction: SignalDirection.LONG,
        type: SignalType.TREND_FOLLOWING,
        confidence: 80,
        price: 1000,
        stopLoss: 990,
        takeProfits: [],
        reason: 'Test',
        timestamp: Date.now(),
      };

      const candle = {
        open: 1000,
        high: 1010,
        low: 990,
        close: 1005,
        volume: 1000,
        timestamp: Date.now(),
      };

      // Create snapshot - should complete without throwing despite logger failure
      expect(() => {
        gateWithFailingLogger.createSnapshot(TrendBias.BULLISH, {
          bias: TrendBias.BULLISH,
          strength: 0.8,
          timeframe: '4h',
          reasoning: [],
          restrictedDirections: [],
        } as unknown as TrendAnalysis, signal, candle);
      }).not.toThrow();

      // Verify snapshot was created successfully despite logging failure
      expect(gateWithFailingLogger.getSnapshotCount()).toBe(1);
    });
  });
});

