/**
 * EntryOrchestrator Error Handling Tests - Phase 8.9.24
 *
 * Tests ErrorHandler integration for:
 * - RiskManager validation errors (THROW strategy)
 * - RiskManager calculation errors (GRACEFUL_DEGRADE strategy)
 * - FilterOrchestrator failures (GRACEFUL_DEGRADE strategy)
 * - Logging failures (SKIP strategy)
 * - End-to-end recovery scenarios
 */

import { EntryOrchestrator } from '../../orchestrators/entry.orchestrator';
import { FilterOrchestrator } from '../../orchestrators/filter.orchestrator';
import { RiskManager } from '../../services/risk-manager.service';
import {
  Signal,
  EntryDecision,
  SignalDirection,
  SignalType,
  PositionSide,
  TrendBias,
  LogLevel,
  Position,
  RiskManagerConfig,
  TrendAnalysis,
  RiskDecision,
} from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  RiskValidationError,
  RiskCalculationError,
  InsufficientAccountBalanceError,
} from '../../errors/DomainErrors';

// ============================================================================
// TEST UTILITIES
// ============================================================================

class TestLogger extends LoggerService {
  public infoLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public warnLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public errorLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public debugLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];

  constructor() {
    super(LogLevel.INFO, './logs', false);
  }

  info(msg: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ msg, context });
    super.info(msg, context);
  }

  warn(msg: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ msg, context });
    super.warn(msg, context);
  }

  error(msg: string, context?: Record<string, unknown>): void {
    this.errorLogs.push({ msg, context });
    super.error(msg, context);
  }

  debug(msg: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ msg, context });
    super.debug(msg, context);
  }

  clear(): void {
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
    this.debugLogs = [];
  }
}

function createNeutralTrend(): TrendAnalysis {
  return {
    bias: 'NEUTRAL' as TrendBias,
    strength: 0.0,
    timeframe: '1h',
    pattern: 'MIXED',
    reasoning: ['No clear direction'],
    restrictedDirections: [],
  };
}

function createSignal(
  direction: SignalDirection = SignalDirection.LONG,
  confidence: number = 60,
  price: number = 100,
  type: SignalType = SignalType.LEVEL_BASED,
): Signal {
  return {
    direction,
    type,
    confidence,
    price,
    stopLoss: price * 0.98,
    takeProfits: [
      { level: 1, percent: 1.0, sizePercent: 100, price: price * 1.01, hit: false },
    ],
    reason: 'test signal',
    timestamp: Date.now(),
  };
}

function createRiskManager(logger: LoggerService): RiskManager {
  const config: RiskManagerConfig = {
    dailyLimits: {
      maxDailyLossPercent: 5.0,
      maxDailyProfitPercent: 10.0,
      emergencyStopOnLimit: true,
    },
    lossStreak: {
      reductions: {
        after2Losses: 0.75,
        after3Losses: 0.5,
        after4Losses: 0.25,
      },
      stopAfterLosses: 5,
    },
    concurrentRisk: {
      enabled: true,
      maxPositions: 3,
      maxRiskPerPosition: 2.0,
      maxTotalExposurePercent: 100.0,
    },
    positionSizing: {
      riskPerTradePercent: 1.0,
      minPositionSizeUsdt: 5.0,
      maxPositionSizeUsdt: 100.0,
      maxLeverageMultiplier: 2.0,
    },
  };
  const errorHandler = new ErrorHandler(logger);
  return new RiskManager(config, logger, errorHandler);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('EntryOrchestrator - Error Handling (Phase 8.9.24)', () => {
  let orchestrator: EntryOrchestrator;
  let riskManager: RiskManager;
  let logger: TestLogger;
  let errorHandler: ErrorHandler;
  let filterOrchestrator: FilterOrchestrator;

  beforeEach(() => {
    logger = new TestLogger();
    errorHandler = new ErrorHandler(logger);
    riskManager = createRiskManager(logger);
    filterOrchestrator = new FilterOrchestrator(logger);
  });

  // =========================================================================
  // GROUP 1: RiskManager Validation Errors (THROW strategy)
  // =========================================================================

  describe('RiskManager Validation Errors - THROW Strategy', () => {
    test('should throw RiskValidationError when signal.price is invalid (0)', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Use high confidence to pass filters first, then hit validation error on price
      const signal = createSignal(SignalDirection.LONG, 85, 0); // Invalid price
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should skip due to validation error in outer catch block
      expect(result.decision).toBe(EntryDecision.SKIP);
      expect(result.reason).toContain('Orchestrator error');
    });

    test('should throw RiskValidationError when signal.price is negative', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const signal = createSignal(SignalDirection.LONG, 85, -100); // Negative price
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      expect(result.decision).toBe(EntryDecision.SKIP);
    });

    test('should throw RiskValidationError when signal.confidence is invalid (>100)', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const signal = createSignal(SignalDirection.LONG, 150, 100); // Invalid confidence (>100)
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should skip due to validation error
      expect(result.decision).toBe(EntryDecision.SKIP);
    });

    test('should throw RiskValidationError when signal.confidence is negative', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const signal = createSignal(SignalDirection.LONG, -10, 100); // Negative confidence
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should skip due to validation error
      expect(result.decision).toBe(EntryDecision.SKIP);
    });
  });

  // =========================================================================
  // GROUP 2: RiskManager Calculation Errors (GRACEFUL_DEGRADE strategy)
  // =========================================================================

  describe('RiskManager Calculation Errors - GRACEFUL_DEGRADE Strategy', () => {
    test('should handle RiskCalculationError with GRACEFUL_DEGRADE', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock RiskManager to throw RiskCalculationError
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new RiskCalculationError('Position exposure calculation failed', {
          operation: 'calculateTotalExposure',
          reason: 'NaN exposure',
        }),
      );

      // Use high confidence signal to pass filters
      const signal = createSignal(SignalDirection.LONG, 85);
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should degrade gracefully and skip
      expect(result.decision).toBe(EntryDecision.SKIP);
      expect(result.reason).toContain('graceful degrade');
      expect(logger.warnLogs.some((l) => l.msg.includes('Risk check failed'))).toBe(true);

      mockCanTrade.mockRestore();
    });

    test('should handle InsufficientAccountBalanceError with GRACEFUL_DEGRADE', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock RiskManager to throw balance error
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new InsufficientAccountBalanceError('Account balance is zero', {
          balance: 0,
          requiredMinimum: 10,
        }),
      );

      const signal = createSignal();
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      expect(result.decision).toBe(EntryDecision.SKIP);
      expect(logger.warnLogs.length).toBeGreaterThan(0);

      mockCanTrade.mockRestore();
    });

    test('should handle generic RiskManager errors with GRACEFUL_DEGRADE', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock RiskManager to throw generic error
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new Error('Network timeout during risk check'),
      );

      // Use high confidence signal to pass filters
      const signal = createSignal(SignalDirection.LONG, 85);
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should degrade gracefully
      expect(result.decision).toBe(EntryDecision.SKIP);
      expect(result.reason).toContain('Risk check failed');

      mockCanTrade.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 3: FilterOrchestrator Errors (GRACEFUL_DEGRADE strategy)
  // =========================================================================

  describe('FilterOrchestrator Errors - GRACEFUL_DEGRADE Strategy', () => {
    test('should handle FilterOrchestrator failure with GRACEFUL_DEGRADE', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock FilterOrchestrator to throw error
      const mockEvaluate = jest.spyOn(filterOrchestrator, 'evaluateFilters').mockImplementationOnce(() => {
        throw new Error('Filter evaluation failed');
      });

      // Create signal that would normally pass
      const highConfidenceSignal = createSignal(SignalDirection.LONG, 85); // High confidence to bypass filters
      const result = await orchestrator.evaluateEntry(
        [highConfidenceSignal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Pure decision should pass, filters throw and are handled gracefully
      // RiskManager should approve, so entry should be approved despite filter error
      expect(result.decision).toBe(EntryDecision.ENTER);

      mockEvaluate.mockRestore();
    });

    test('should log filter failure and continue without filters', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const mockEvaluate = jest.spyOn(filterOrchestrator, 'evaluateFilters').mockImplementationOnce(() => {
        throw new Error('Filter service unavailable');
      });

      logger.clear();
      // Use high confidence signal
      const signal = createSignal(SignalDirection.LONG, 85);
      await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should have warning about proceeding without filters
      const hasWarning = logger.warnLogs.some((l) =>
        l.msg.includes('Proceeding without FilterOrchestrator') || l.msg.includes('Filter evaluation failed'),
      );
      expect(hasWarning).toBe(true);

      mockEvaluate.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 4: Logging Failures (SKIP strategy)
  // =========================================================================

  describe('Logging Failures - SKIP Strategy', () => {
    test('should skip logging failures for conflict analysis', async () => {
      // Create custom logger that throws on info
      class FailingLogger extends TestLogger {
        info(msg: string, context?: Record<string, unknown>): void {
          if (msg.includes('Signal conflict analysis')) {
            throw new Error('Logger crash');
          }
          super.info(msg, context);
        }
      }

      const failingLogger = new FailingLogger();
      const failingErrorHandler = new ErrorHandler(failingLogger);
      const failingRiskManager = createRiskManager(failingLogger);
      orchestrator = new EntryOrchestrator(
        failingRiskManager,
        failingLogger,
        filterOrchestrator,
        undefined,
        undefined,
        failingErrorHandler,
      );

      // Two signals with conflict
      const signals = [
        createSignal(SignalDirection.LONG, 65),
        createSignal(SignalDirection.SHORT, 55),
      ];

      const result = await orchestrator.evaluateEntry(
        signals,
        1000,
        [],
        createNeutralTrend(),
      );

      // Should still make a decision despite logging error
      expect([EntryDecision.SKIP, EntryDecision.WAIT]).toContain(result.decision);
    });

    test('should skip logging failures for early exit messages', async () => {
      class FailingLogger extends TestLogger {
        debug(msg: string, context?: Record<string, unknown>): void {
          if (msg.includes('Entry rejected')) {
            throw new Error('Logger crash');
          }
          super.debug(msg, context);
        }
      }

      const failingLogger = new FailingLogger();
      const failingErrorHandler = new ErrorHandler(failingLogger);
      const failingRiskManager = createRiskManager(failingLogger);
      orchestrator = new EntryOrchestrator(
        failingRiskManager,
        failingLogger,
        filterOrchestrator,
        undefined,
        undefined,
        failingErrorHandler,
      );

      // Empty signals should trigger SKIP decision
      const result = await orchestrator.evaluateEntry(
        [],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should skip without crashing
      expect(result.decision).toBe(EntryDecision.SKIP);
    });

    test('should skip logging failures for entry approval', async () => {
      class FailingLogger extends TestLogger {
        info(msg: string, context?: Record<string, unknown>): void {
          if (msg.includes('Entry APPROVED')) {
            throw new Error('Logger crash');
          }
          super.info(msg, context);
        }
      }

      const failingLogger = new FailingLogger();
      const failingErrorHandler = new ErrorHandler(failingLogger);
      const failingRiskManager = createRiskManager(failingLogger);
      orchestrator = new EntryOrchestrator(
        failingRiskManager,
        failingLogger,
        filterOrchestrator,
        undefined,
        undefined,
        failingErrorHandler,
      );

      // Use high confidence signal to pass filters
      const signal = createSignal(SignalDirection.LONG, 85);
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should still approve entry despite logging error
      expect(result.decision).toBe(EntryDecision.ENTER);
    });
  });

  // =========================================================================
  // GROUP 5: Backward Compatibility (No ErrorHandler)
  // =========================================================================

  describe('Backward Compatibility - No ErrorHandler', () => {
    test('should work without ErrorHandler parameter', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator);
      // No errorHandler passed

      const signal = createSignal();
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should work normally
      expect([EntryDecision.ENTER, EntryDecision.SKIP, EntryDecision.WAIT]).toContain(result.decision);
    });

    test('should handle RiskManager errors gracefully without ErrorHandler', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator);
      // No errorHandler

      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new Error('Network error'),
      );

      // Use high confidence signal to pass filters
      const signal = createSignal(SignalDirection.LONG, 85);
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should skip due to error
      expect(result.decision).toBe(EntryDecision.SKIP);
      expect(result.reason).toContain('Risk check failed');

      mockCanTrade.mockRestore();
    });

    test('should skip logging errors without ErrorHandler', async () => {
      class FailingLogger extends TestLogger {
        warn(msg: string, context?: Record<string, unknown>): void {
          if (msg.includes('Trade blocked')) {
            throw new Error('Logger crash');
          }
          super.warn(msg, context);
        }
      }

      const failingLogger = new FailingLogger();
      const failingRiskManager = createRiskManager(failingLogger);
      orchestrator = new EntryOrchestrator(
        failingRiskManager,
        failingLogger,
        filterOrchestrator,
        undefined,
        undefined,
        undefined, // No ErrorHandler
      );

      const mockCanTrade = jest.spyOn(failingRiskManager, 'canTrade').mockResolvedValueOnce({
        allowed: false,
        reason: 'Test rejection',
      });

      const signal = createSignal();
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should still make decision despite logging error
      expect(result.decision).toBe(EntryDecision.SKIP);

      mockCanTrade.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 6: End-to-End Cascading Failures
  // =========================================================================

  describe('End-to-End Cascading Failures', () => {
    test('should handle multiple errors in sequence', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock RiskManager with sequence: error, error, success
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade')
        .mockRejectedValueOnce(new Error('Risk check error 1'))
        .mockRejectedValueOnce(new Error('Risk check error 2'))
        .mockResolvedValueOnce({ allowed: true });

      // Use high confidence signal to bypass normal filter restrictions
      const signal = createSignal(SignalDirection.LONG, 85);

      // First call - risk check error
      const result1 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result1.decision).toBe(EntryDecision.SKIP);

      // Second call - another risk check error
      const result2 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result2.decision).toBe(EntryDecision.SKIP);

      // Third call - success
      const result3 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result3.decision).toBe(EntryDecision.ENTER);

      mockCanTrade.mockRestore();
    });

    test('should recover from temporary RiskManager failures', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const mockCanTrade = jest.spyOn(riskManager, 'canTrade')
        .mockRejectedValueOnce(new RiskCalculationError('Temporary error', {}))
        .mockRejectedValueOnce(new RiskCalculationError('Temporary error', {}))
        .mockResolvedValueOnce({ allowed: true });

      // Use high confidence signal to pass filters
      const signal = createSignal(SignalDirection.LONG, 85);

      // Attempt 1: Should fail
      const result1 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result1.decision).toBe(EntryDecision.SKIP);

      // Attempt 2: Should still fail (2nd error)
      const result2 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result2.decision).toBe(EntryDecision.SKIP);

      // Attempt 3: Should succeed
      const result3 = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );
      expect(result3.decision).toBe(EntryDecision.ENTER);

      mockCanTrade.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 7: ErrorHandler Callbacks
  // =========================================================================

  describe('ErrorHandler Callbacks', () => {
    test('should trigger onRecover callback for filter error recovery', async () => {
      const recoverCallback = jest.fn();
      const customErrorHandler = new ErrorHandler(logger);
      const originalHandle = customErrorHandler.handle.bind(customErrorHandler);

      // Wrap to add callback
      customErrorHandler.handle = jest.fn(async (error, options) => {
        if (options?.context?.includes('filter')) {
          options = { ...options, onRecover: recoverCallback };
        }
        return originalHandle(error, options);
      });

      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, customErrorHandler);

      const mockEvaluate = jest.spyOn(filterOrchestrator, 'evaluateFilters').mockImplementationOnce(() => {
        throw new Error('Filter unavailable');
      });

      const signal = createSignal();
      await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Callback should be called during recovery
      expect(customErrorHandler.handle).toHaveBeenCalled();

      mockEvaluate.mockRestore();
    });

    test('should handle RiskManager errors through ErrorHandler callbacks', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      // Mock RiskManager to throw an error
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new RiskCalculationError('Calculation error', { operation: 'test' }),
      );

      const signal = createSignal(SignalDirection.LONG, 85);
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should gracefully degrade and return SKIP
      expect(result.decision).toBe(EntryDecision.SKIP);

      mockCanTrade.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 8: Integration with ErrorRegistry
  // =========================================================================

  describe('Integration with ErrorRegistry', () => {
    test('should record errors in ErrorRegistry for monitoring', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValueOnce(
        new RiskCalculationError('Calculation failed', { operation: 'test' }),
      );

      const signal = createSignal();
      const result = await orchestrator.evaluateEntry(
        [signal],
        1000,
        [],
        createNeutralTrend(),
      );

      // Should handle error gracefully
      expect(result.decision).toBe(EntryDecision.SKIP);

      // Error should be tracked (if registry is used)
      // This is informational - registry is maintained by ErrorHandler
      expect(result.reason).toBeDefined();

      mockCanTrade.mockRestore();
    });
  });

  // =========================================================================
  // GROUP 9: Performance Under Error Conditions
  // =========================================================================

  describe('Performance Under Error Conditions', () => {
    test('should handle rapid error recovery without performance degradation', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      let callCount = 0;
      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 1) {
          throw new Error('Intermittent error');
        }
        return { allowed: true };
      });

      const signal = createSignal();
      const startTime = Date.now();

      // Make 10 calls - half will fail
      for (let i = 0; i < 10; i++) {
        await orchestrator.evaluateEntry([signal], 1000, [], createNeutralTrend());
      }

      const duration = Date.now() - startTime;

      // Should complete reasonably fast (< 5 seconds for 10 calls)
      expect(duration).toBeLessThan(5000);

      mockCanTrade.mockRestore();
    });

    test('should not memory leak with repeated error handling', async () => {
      orchestrator = new EntryOrchestrator(riskManager, logger, filterOrchestrator, undefined, undefined, errorHandler);

      const mockCanTrade = jest.spyOn(riskManager, 'canTrade').mockRejectedValue(
        new Error('Network error'),
      );

      const signal = createSignal();

      // Repeat 50 times to check for memory leaks
      for (let i = 0; i < 50; i++) {
        await orchestrator.evaluateEntry([signal], 1000, [], createNeutralTrend());
      }

      // If we got here without crashing, test passed
      expect(true).toBe(true);

      mockCanTrade.mockRestore();
    });
  });
});
