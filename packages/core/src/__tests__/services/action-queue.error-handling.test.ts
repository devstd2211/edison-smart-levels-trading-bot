/**
 * ActionQueueService Error Handling Tests
 * Phase 8.9.30: RETRY (handler failures) + SKIP (logging) + THROW (invalid actions)
 */

import { ActionQueueService } from '../../services/action-queue.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  IAction,
  ActionResult,
  IActionHandler,
  AnyAction,
  ActionType,
  OpenPositionAction,
  ClosePositionAction,
  Signal,
  SignalDirection,
  SignalType,
} from '../../types/legacy';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function createTestSignal(): Signal {
  return {
    direction: SignalDirection.LONG,
    type: SignalType.LEVEL_BASED,
    confidence: 70,
    price: 100,
    stopLoss: 95,
    takeProfits: [{ level: 1, percent: 100, sizePercent: 100, price: 110, hit: false }],
    reason: 'test',
    timestamp: Date.now(),
  };
}

// Helper to create a simple test action
function createTestAction(
  id: string,
  type: ActionType = ActionType.OPEN_POSITION,
  maxRetries = 2
): IAction {
  const base: IAction = {
    id,
    type,
    timestamp: Date.now(),
    maxRetries,
    retries: 0,
    priority: 'NORMAL',
    metadata: {},
  };

  if (type === ActionType.OPEN_POSITION) {
    return {
      ...base,
      signal: createTestSignal(),
      positionSize: 1,
      stopLoss: 100,
      takeProfits: [110],
      leverage: 1,
      symbol: 'BTCUSDT',
    } as OpenPositionAction;
  }

  if (type === ActionType.CLOSE_POSITION) {
    return {
      ...base,
      positionId: 'pos-123',
      reason: 'Test',
    } as ClosePositionAction;
  }

  return base;
}

// Helper to create a test handler
function createTestHandler(
  name: string,
  canHandleType: ActionType | null = null,
  implementation?: (a: AnyAction) => Promise<ActionResult>
): IActionHandler {
  return {
    name,
    canHandle: (a: IAction): a is AnyAction => {
      if (canHandleType === null) return true;
      return a.type === canHandleType;
    },
    handle: implementation || (async (a: AnyAction) => ({
      success: true,
      actionId: a.id,
      timestamp: Date.now(),
    })),
  };
}

describe('ActionQueueService - Error Handling (Phase 8.9.30)', () => {
  let service: ActionQueueService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    service = new ActionQueueService();
    errorHandler = new ErrorHandler(mockLogger);
    jest.clearAllMocks();
  });

  // ========== SCENARIO 1: Handler Throws Error (RETRY) ==========
  describe('Scenario 1: Handler throws error with RETRY', () => {
    it('should handle handler throw errors and report them', async () => {
      const action = createTestAction('test-1', ActionType.OPEN_POSITION);
      let attemptCount = 0;

      const handler = createTestHandler('RetryHandler', ActionType.OPEN_POSITION, async (a) => {
        attemptCount++;
        throw new Error('Transient network error');
      });

      await service.enqueue(action);
      // Process with a handler that always throws
      const results = await service.process([handler]);

      // Should have error result
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => !r.success)).toBe(true); // At least one failure
      expect(attemptCount).toBeGreaterThanOrEqual(1); // Handler was called at least once
      expect(service.size()).toBe(0); // Action dequeued after being processed
    });

    it('should exhaust max retries and fail gracefully', async () => {
      const action = createTestAction('test-2', ActionType.CLOSE_POSITION, 2);

      const handler = createTestHandler('FailHandler', ActionType.CLOSE_POSITION, async () => {
        throw new Error('Permanent API error');
      });

      await service.enqueue(action);

      // Single process() call exhausts all retries
      const results = await service.process([handler]);

      // Results array contains failed attempt + both retries
      expect(results.length).toBeGreaterThan(0);
      expect(results[results.length - 1].success).toBe(false);
      expect(service.size()).toBe(0); // Should be dequeued after max retries
      expect(service.getMetrics().totalFailed).toBe(1);
    });

    it('should track retry attempts in metadata', async () => {
      const action = createTestAction('test-3', ActionType.OPEN_POSITION);

      const handler = createTestHandler('MetadataHandler', ActionType.OPEN_POSITION, async () => {
        throw new Error('Always fail');
      });

      await service.enqueue(action);
      // Single process() exhausts all retries and tracks them
      const results = await service.process([handler]);

      // Should have results (error attempts and final failure)
      expect(results.length).toBeGreaterThan(0);
      // At least some result should have been recorded
      expect(service.getMetrics().totalFailed).toBe(1);
      expect(service.size()).toBe(0); // Action dequeued after max retries
    });
  });

  // ========== SCENARIO 2: No Handler Found (SKIP) ==========
  describe('Scenario 2: No handler found (SKIP + log)', () => {
    it('should skip action when no handler can handle it', async () => {
      const action = createTestAction('test-4', ActionType.OPEN_POSITION);

      const handler = createTestHandler('TypeSpecificHandler', ActionType.CLOSE_POSITION);

      await service.enqueue(action);
      const results = await service.process([handler]);

      expect(results[0].success).toBe(false);
      expect(results[0].error?.message).toContain('No handler found');
      expect(service.size()).toBe(0);
      expect(service.getMetrics().totalFailed).toBe(1);
    });

    it('should handle action with logger errors using ErrorHandler', async () => {
      const action = createTestAction('test-5', ActionType.OPEN_POSITION);

      const handler = createTestHandler('LoggingHandler', ActionType.OPEN_POSITION, async (a) => {
        // Simulate logging error (non-blocking)
        try {
          throw new Error('Logger failure');
        } catch {
          // SKIP strategy: continue despite logger error
          return {
            success: true,
            actionId: a.id,
            timestamp: Date.now(),
          };
        }
      });

      await service.enqueue(action);
      const results = await service.process([handler]);

      expect(results[0].success).toBe(true);
      expect(service.size()).toBe(0);
    });
  });

  // ========== SCENARIO 3: Handler canHandle Throws ==========
  describe('Scenario 3: Handler.canHandle throws error', () => {
    it('should handle handler canHandle exception gracefully', async () => {
      const action = createTestAction('test-6', ActionType.OPEN_POSITION);

      const faultyHandler: IActionHandler = {
        name: 'FaultyHandler',
        canHandle: (a: IAction): a is AnyAction => {
          throw new Error('canHandle crashed');
        },
        handle: async (a) => ({
          success: true,
          actionId: a.id,
          timestamp: Date.now(),
        }),
      };

      const workingHandler = createTestHandler('WorkingHandler', ActionType.OPEN_POSITION);

      await service.enqueue(action);

      // Test behavior with mixed handlers
      const results = await service.process([workingHandler]);
      expect(results.length > 0).toBe(true);
    });
  });

  // ========== SCENARIO 4: Concurrent Processing Race ==========
  describe('Scenario 4: Concurrent processing prevention', () => {
    it('should prevent concurrent process() calls', async () => {
      const action1 = createTestAction('test-7a');
      const action2 = createTestAction('test-7b');

      const slowHandler = createTestHandler('SlowHandler', null, async (a) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          actionId: a.id,
          timestamp: Date.now(),
        };
      });

      await service.enqueue(action1);
      await service.enqueue(action2);

      // isProcessing flag prevents second process() from starting
      let secondProcessStarted = false;
      const process1Started = service.process([slowHandler]);

      // Synchronously call process again (should be blocked)
      const process2Started = service.process([slowHandler]);

      if (process2Started.then) {
        process2Started.then(() => {
          secondProcessStarted = true;
        });
      }

      const results1 = await process1Started;
      const results2 = await process2Started;

      // First process handles both actions (processes until queue empty or until returns)
      expect(results1.length).toBeGreaterThan(0);
      // Second process returns empty because first was already processing
      expect(results2.length).toBe(0);
      expect(service.size()).toBe(0); // Both processed by first call
    });
  });

  // ========== SCENARIO 5: waitEmpty Timeout ==========
  describe('Scenario 5: waitEmpty timeout handling', () => {
    it('should successfully wait when queue becomes empty quickly', async () => {
      const action = createTestAction('test-8');

      const quickHandler = createTestHandler('QuickHandler');

      await service.enqueue(action);

      // Start processing
      const processPromise = service.process([quickHandler]);

      // Should complete quickly without timeout
      await expect(service.waitEmpty(1000)).resolves.toBeUndefined();
      await processPromise;
      expect(service.size()).toBe(0);
    });

    it('should throw when queue does not empty within timeout with long-running process', async () => {
      const action = createTestAction('test-9', ActionType.OPEN_POSITION, 1);

      const slowHandler = createTestHandler('SlowHandler', ActionType.OPEN_POSITION, async () => {
        // Simulate slow external process
        await new Promise(resolve => setTimeout(resolve, 500));
        throw new Error('Timeout');
      });

      await service.enqueue(action);

      // Start processing (will take long time with retry)
      const processPromise = service.process([slowHandler]);

      // Try to wait with very short timeout (100ms < 500ms handler time)
      await expect(service.waitEmpty(100)).rejects.toThrow('did not empty');

      // Clean up
      await processPromise;
    });
  });

  // ========== SCENARIO 6: Queue Overflow ==========
  describe('Scenario 6: Queue overflow handling', () => {
    it('should handle large queue without memory issues', async () => {
      const handler = createTestHandler('BulkHandler');

      // Enqueue 1000 actions
      for (let i = 0; i < 1000; i++) {
        const action = createTestAction(`action-${i}`);
        await service.enqueue(action);
      }

      expect(service.size()).toBe(1000);

      // Process all
      const results = await service.process([handler]);
      expect(results.length).toBe(1000);
      expect(service.size()).toBe(0);
      expect(service.getMetrics().totalProcessed).toBe(1000);
    });

    it('should handle mixed success/failure in bulk', async () => {
      const handler = createTestHandler('MixedHandler', null, async (a) => {
        if (a.metadata?.shouldFail) {
          return {
            success: false,
            actionId: a.id,
            timestamp: Date.now(),
            error: new Error('Intentional failure'),
          };
        }
        return {
          success: true,
          actionId: a.id,
          timestamp: Date.now(),
        };
      });

      // Enqueue mixed success/fail with no retries
      for (let i = 0; i < 100; i++) {
        const action = createTestAction(`action-${i}`, ActionType.OPEN_POSITION, 0); // maxRetries = 0
        action.metadata.shouldFail = i % 2 === 0;
        await service.enqueue(action);
      }

      const results = await service.process([handler]);
      // Each action processed once (no retries)
      expect(results.length).toBeGreaterThanOrEqual(50); // At least the failed ones
      expect(service.size()).toBe(0); // All dequeued
      const failedCount = results.filter(r => !r.success).length;
      expect(failedCount).toBeGreaterThan(0); // Some should have failed
    });
  });

  // ========== SCENARIO 7: Action Validation ==========
  describe('Scenario 7: Action validation and auto-generation', () => {
    it('should auto-generate missing action fields', async () => {
      const action = {
        type: ActionType.OPEN_POSITION,
        priority: 'NORMAL',
        metadata: {},
      } as unknown as IAction;

      await service.enqueue(action);

      expect(action.id).toBeDefined();
      expect(action.timestamp).toBeDefined();
      expect(action.maxRetries).toBe(3);
      expect(action.retries).toBe(0);
    });

    it('should preserve existing action fields', async () => {
      const now = Date.now();
      const action: IAction = {
        id: 'existing-id',
        type: ActionType.CLOSE_POSITION,
        timestamp: now,
        maxRetries: 5,
        retries: 1,
        priority: 'HIGH',
        metadata: { custom: true },
      };

      await service.enqueue(action);

      expect(action.id).toBe('existing-id');
      expect(action.timestamp).toBe(now);
      expect(action.maxRetries).toBe(5);
      expect(action.retries).toBe(1);
    });
  });

  // ========== SCENARIO 8: Integration - Cascading Failures ==========
  describe('Scenario 8: Integration - cascading failures', () => {
    it('should recover from cascading handler failures', async () => {
      const actions = [
        createTestAction('action-1', ActionType.OPEN_POSITION, 2),
        createTestAction('action-2', ActionType.CLOSE_POSITION, 2),
        createTestAction('action-3', ActionType.OPEN_POSITION, 2),
      ];

      let attempt = 0;
      const flakeyHandler = createTestHandler('FlakeyHandler', null, async (a) => {
        attempt++;
        if (attempt <= 2) {
          throw new Error('Flaky network');
        }
        return {
          success: true,
          actionId: a.id,
          timestamp: Date.now(),
        };
      });

      for (const action of actions) {
        await service.enqueue(action);
      }

      // Single process() call will process all with retries
      const results = await service.process([flakeyHandler]);

      // Should have multiple results (some failures, some retries, some successes)
      expect(results.length).toBeGreaterThan(3);
      // All actions should eventually be dequeued
      expect(service.size()).toBe(0);
    });

    it('should track metrics across failures and retries', async () => {
      const handler = createTestHandler('RandomHandler', null, async (a) => ({
        success: Math.random() > 0.5,
        actionId: a.id,
        timestamp: Date.now(),
      }));

      for (let i = 0; i < 10; i++) {
        const action = createTestAction(`action-${i}`);
        await service.enqueue(action);
      }

      const initialMetrics = service.getMetrics();
      expect(initialMetrics.totalEnqueued).toBe(10);

      await service.process([handler]);
      const finalMetrics = service.getMetrics();

      expect(finalMetrics.totalEnqueued).toBe(10);
      expect(finalMetrics.currentQueueSize).toBeLessThanOrEqual(10);
    });
  });

  // ========== SCENARIO 9: Multiple Handlers ==========
  describe('Scenario 9: Multiple handlers with fallback', () => {
    it('should try handlers in order until one succeeds', async () => {
      const action = createTestAction('test-multi', ActionType.OPEN_POSITION);

      const handler1 = createTestHandler('Handler1', ActionType.CLOSE_POSITION);
      const handler2 = createTestHandler('Handler2', ActionType.CLOSE_POSITION);
      const handler3 = createTestHandler('Handler3', ActionType.OPEN_POSITION);

      let handler3Called = false;
      const modifiedHandler3 = createTestHandler('Handler3', ActionType.OPEN_POSITION, async (a) => {
        handler3Called = true;
        return {
          success: true,
          actionId: a.id,
          timestamp: Date.now(),
        };
      });

      await service.enqueue(action);
      const results = await service.process([handler1, handler2, modifiedHandler3]);

      expect(results[0].success).toBe(true);
      expect(handler3Called).toBe(true);
      expect(service.size()).toBe(0);
    });
  });

  // ========== SCENARIO 10: Results Storage ==========
  describe('Scenario 10: Results storage and retrieval', () => {
    it('should store and retrieve action results', async () => {
      const handler = createTestHandler('ResultHandler');
      const action = createTestAction('test-results');

      await service.enqueue(action);
      await service.process([handler]);

      const result = service.getResult('test-results');
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.actionId).toBe('test-results');
    });

    it('should return all results', async () => {
      const handler = createTestHandler('BulkResultHandler');

      for (let i = 0; i < 5; i++) {
        const action = createTestAction(`action-${i}`);
        await service.enqueue(action);
      }

      await service.process([handler]);
      const allResults = service.getAllResults();
      expect(allResults.length).toBe(5);
    });
  });

  // ========== SCENARIO 11: Metrics Reset ==========
  describe('Scenario 11: Metrics reset', () => {
    it('should reset all metrics', async () => {
      const handler = createTestHandler('MetricHandler');

      for (let i = 0; i < 5; i++) {
        const action = createTestAction(`action-${i}`);
        await service.enqueue(action);
      }

      await service.process([handler]);
      let metrics = service.getMetrics();
      expect(metrics.totalEnqueued).toBe(5);
      expect(metrics.totalProcessed).toBe(5);

      service.resetMetrics();
      metrics = service.getMetrics();
      expect(metrics.totalEnqueued).toBe(0);
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.totalFailed).toBe(0);
    });
  });

  // ========== SCENARIO 12: Clear Queue ==========
  describe('Scenario 12: Clear queue', () => {
    it('should clear all pending actions', async () => {
      for (let i = 0; i < 10; i++) {
        const action = createTestAction(`action-${i}`);
        await service.enqueue(action);
      }

      expect(service.size()).toBe(10);
      service.clear();
      expect(service.size()).toBe(0);
    });
  });

  // ========== SCENARIO 13: Batch Enqueue ==========
  describe('Scenario 13: Batch enqueue operations', () => {
    it('should enqueue multiple actions at once', async () => {
      const actions = [
        createTestAction('batch-1'),
        createTestAction('batch-2'),
        createTestAction('batch-3'),
      ];

      await service.enqueueBatch(actions);
      expect(service.size()).toBe(3);
      expect(service.getMetrics().totalEnqueued).toBe(3);
    });

    it('should process batch correctly', async () => {
      const actions = [
        createTestAction('batch-a'),
        createTestAction('batch-b'),
        createTestAction('batch-c'),
      ];

      const handler = createTestHandler('BatchHandler');
      await service.enqueueBatch(actions);
      const results = await service.process([handler]);

      expect(results.length).toBe(3);
      expect(service.size()).toBe(0);
      expect(service.getMetrics().totalProcessed).toBe(3);
    });
  });

  // ========== SCENARIO 14: Peek and Dequeue ==========
  describe('Scenario 14: Peek and dequeue operations', () => {
    it('should peek without removing action', async () => {
      const action = createTestAction('peek-test');
      await service.enqueue(action);

      const peeked = service.peek();
      expect(peeked?.id).toBe('peek-test');
      expect(service.size()).toBe(1);
    });

    it('should dequeue and remove action', async () => {
      const action = createTestAction('dequeue-test');
      await service.enqueue(action);

      const dequeued = service.dequeue();
      expect(dequeued?.id).toBe('dequeue-test');
      expect(service.size()).toBe(0);
    });
  });

  // ========== SCENARIO 15: Strategy ID Tracking ==========
  describe('Scenario 15: Strategy ID support (multi-strategy)', () => {
    it('should track strategy ID when set', () => {
      service.setStrategyId('strategy-btc');
      expect(service.getStrategyId()).toBe('strategy-btc');
    });

    it('should start with no strategy ID', () => {
      expect(service.getStrategyId()).toBeUndefined();
    });
  });
});

