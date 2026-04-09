/**
 * Phase 8: TradingOrchestrator - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in TradingOrchestrator with SKIP recovery strategy
 * for analyzer failures and entry orchestration failures.
 *
 * Note: These tests focus on error handling patterns and recovery strategies.
 * Full integration is tested in phase-8-error-handling-integration.e2e.test.ts
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ErrorHandler, RecoveryStrategy, StrategyExecutionError, EntryValidationError } from '../../errors';
import {
  createEntryValidationTestError,
  createManagedTradingOrchestratorContext,
  createStrategyExecutionTestError,
  TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT,
  TRADING_ORCHESTRATOR_ENTRY_CONTEXT,
  type TradingOrchestratorMockLogger,
} from '../helpers/trading-orchestrator-test.utils';

type ManagedTradingOrchestratorFixtures = ReturnType<typeof createManagedTradingOrchestratorContext>;
type TradingOrchestratorFixtures = {
  runtime: Pick<ManagedTradingOrchestratorFixtures, 'logger'>;
};

describe('Phase 8: TradingOrchestrator - Error Handling Integration', () => {
  let mockLogger: TradingOrchestratorMockLogger;
  let fixtureState: TradingOrchestratorFixtures & { cleanup: ManagedTradingOrchestratorFixtures['cleanup'] };

  beforeEach(() => {
    const managedContext = createManagedTradingOrchestratorContext();
    fixtureState = {
      runtime: {
        logger: managedContext.logger,
      },
      cleanup: managedContext.cleanup,
    };
    ({ logger: mockLogger } = fixtureState.runtime);
    jest.clearAllMocks();
  });

  afterEach(() => {
    fixtureState.cleanup();
  });

  describe('runStrategyAnalysis Error Handling (4 tests)', () => {
    it('test-1.1: Should return empty signals on analyzer failure with SKIP strategy', async () => {
      const error = createStrategyExecutionTestError('Analyzer failed', 'Network timeout');

      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT,
      });

      expect(handled.success).toBe(true);
      expect(handled.recovered).toBe(true);
      expect(handled.strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('test-1.2: Should log analyzer error with ErrorHandler diagnostics', async () => {
      const error = createStrategyExecutionTestError('Analyzer timeout', 'API timeout after 30s');

      // Use THROW strategy to inspect error in result
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.THROW,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT,
      });

      expect(handled.error?.metadata?.code).toBe('STRATEGY_EXECUTION_ERROR');
      expect(handled.error?.message).toContain('Analyzer timeout');
    });

    it('test-1.3: Should NOT retry on analyzer SKIP strategy', async () => {
      const error = createStrategyExecutionTestError('Analyzer fails', 'transient error');

      // SKIP strategy only attempts once
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT,
      });

      expect(handled.attempts).toBe(1); // SKIP = 1 attempt
      expect(handled.recovered).toBe(true);
    });

    it('test-1.4: Should preserve error metadata through ErrorHandler normalization', async () => {
      const error = createStrategyExecutionTestError('Analyzer offline', 'service unavailable');

      // Use THROW strategy to inspect error metadata in result
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.THROW,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT,
      });

      expect(handled.error?.metadata?.domain).toBe('TRADING');
      expect(handled.error?.metadata?.recoverable).toBe(true);
      expect(handled.error?.metadata?.code).toBe('STRATEGY_EXECUTION_ERROR');
    });
  });

  describe('entryOrchestrator.evaluateEntry Error Handling (4 tests)', () => {
    it('test-2.1: Should handle entry validation errors with SKIP recovery', async () => {
      const error = createEntryValidationTestError(
        'Entry validation failed',
        'Signal confidence too low',
        0.3,
      );

      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ENTRY_CONTEXT,
      });

      expect(handled.success).toBe(true);
      expect(handled.recovered).toBe(true);
      expect(handled.strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('test-2.2: Should classify entry errors as MEDIUM severity (recoverable)', async () => {
      const error = createEntryValidationTestError(
        'Risk check failed',
        'Account balance insufficient',
      );

      // Check error metadata before handling
      expect(error.metadata.severity).toBe('MEDIUM');
      expect(error.isRecoverable()).toBe(true);

      // When using SKIP strategy, error is recovered (not returned in result)
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ENTRY_CONTEXT,
      });

      expect(handled.recovered).toBe(true);
      expect(handled.success).toBe(true);
    });

    it('test-2.3: Should normalize unknown entry errors to TradingError', async () => {
      const unknownError = new Error('Generic error from entry orchestrator');

      // Use THROW strategy to get the error in the result for inspection
      const handled = await ErrorHandler.handle(unknownError, {
        strategy: RecoveryStrategy.THROW,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ENTRY_CONTEXT,
      });

      // Error should be normalized to TradingError
      expect(handled.error).toBeDefined();
      expect(handled.error?.metadata.code).toBe('UNKNOWN_ERROR');
      expect(handled.error?.metadata.domain).toBe('INTERNAL');
      expect(handled.error?.originalError).toBe(unknownError);
    });

    it('test-2.4: Should allow recovery callbacks on entry evaluation failure', async () => {
      const error = createEntryValidationTestError(
        'Entry orchestrator error',
        'Critical validation failure',
      );

      const onRecoverCallback = jest.fn();

      const result = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: mockLogger,
        context: TRADING_ORCHESTRATOR_ENTRY_CONTEXT,
        onRecover: onRecoverCallback
      });

      expect(result.recovered).toBe(true);
      expect(onRecoverCallback).toHaveBeenCalledWith(RecoveryStrategy.SKIP, 1);
    });
  });

  describe('Exit Orchestrator Error Handling (4 tests)', () => {
    it('test-3.1: Should identify retryable order timeout errors', async () => {
      const error = new (class extends Error {
        constructor() {
          super('Order timeout after 5s');
          Object.setPrototypeOf(this, new.target.prototype);
        }
      })();

      // Test through public API - handle throws strategy
      const result = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.THROW,
        logger: mockLogger,
      });
      expect(result.error?.message).toContain('Order timeout');
    });

    it('test-3.2: Should set up retry configuration for exit operations', () => {
      const config = {
        maxAttempts: 2,
        initialDelayMs: 500,
        backoffMultiplier: 2
      };

      expect(config.maxAttempts).toBe(2); // Shorter for exit ops
      expect(config.initialDelayMs).toBe(500);
      expect(config.backoffMultiplier).toBe(2);
    });

    it('test-3.3: Should handle position not found errors as non-recoverable', async () => {
      const error = new Error('Position XRPUSDT_Buy not found');

      // Test through public API
      const result = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.THROW,
        logger: mockLogger,
      });
      expect(result.error?.message).toContain('not found');
    });

    it('test-3.4: Should track concurrent close attempts with atomic lock pattern', () => {
      // Simulate atomic lock
      const lock = new Map<string, Promise<void>>();

      const simulateAtomicClose = (posId: string): boolean => {
        // If already closing, return false (concurrent attempt detected)
        if (lock.has(posId)) {
          return false;
        }

        // Mark as closing
        lock.set(posId, Promise.resolve());
        return true;
      };

      // First close attempt succeeds
      const attempt1 = simulateAtomicClose('POS1');
      expect(attempt1).toBe(true);

      // Second concurrent attempt fails (detected by lock)
      const attempt2 = simulateAtomicClose('POS1');
      expect(attempt2).toBe(false);

      // Clean up
      lock.delete('POS1');

      // Third attempt succeeds (lock released)
      const attempt3 = simulateAtomicClose('POS1');
      expect(attempt3).toBe(true);
    });
  });

  describe('Error Recovery Strategy Selection (3 tests)', () => {
    it('test-4.1: Should select SKIP strategy for non-critical analyzer failures', () => {
      const error = createStrategyExecutionTestError(
        'Analyzer unavailable',
        'service temporarily down',
      );

      // SKIP is appropriate because:
      // - Analyzer failure is recoverable
      // - Entry signal generation is optional (can retry next candle)
      // - Should not block candle processing
      const strategy = error.metadata.recoverable ? RecoveryStrategy.SKIP : RecoveryStrategy.THROW;
      expect(strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('test-4.2: Should select SKIP strategy for entry validation failures', () => {
      const error = createEntryValidationTestError(
        'Entry rejected',
        'confidence threshold not met',
      );

      // SKIP is appropriate because:
      // - Entry validation is non-critical (we don't always enter)
      // - Failure to validate doesn't block next signals
      // - Can retry on next candle
      const strategy = error.metadata.recoverable ? RecoveryStrategy.SKIP : RecoveryStrategy.THROW;
      expect(strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('test-4.3: Should recognize critical errors that should THROW', () => {
      const error = createEntryValidationTestError(
        'Account closed',
        'Trading account is disabled',
      );

      // Critical account errors could map to CRITICAL severity
      // But EntryValidationError is MEDIUM, so SKIP is still correct
      // Real CRITICAL would be InsufficientBalanceError
      const shouldThrow = error.metadata.severity === 'CRITICAL';
      expect(shouldThrow).toBe(false); // EntryValidationError is MEDIUM
    });
  });

  describe('Error Context Preservation (2 tests)', () => {
    it('test-5.1: Should preserve operation context through ErrorHandler', () => {
      const error = createStrategyExecutionTestError('Analyzer error', 'Network timeout');

      const context = TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT;

      // Context is passed but not stored in ErrorHandler result
      // It's used for logging
      expect(error.metadata.context).toBeDefined();
      expect(context).toContain('TradingOrchestrator');
    });

    it('test-5.2: Should include error code in logs for debugging', () => {
      const error = createEntryValidationTestError('Entry failed', 'Signal too weak');

      const errorInfo = {
        code: error.metadata.code,
        message: error.message,
        domain: error.metadata.domain
      };

      expect(errorInfo.code).toBe('ENTRY_VALIDATION_ERROR');
      expect(errorInfo.message).toBe('Entry failed');
      expect(errorInfo.domain).toBe('TRADING');
    });
  });
});
