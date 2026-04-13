/**
 * Order Execution Detector Service - Error Handling Tests (Phase 8.9.50)
 *
 * THROW Validation Tests (3):
 * - Null execData
 * - Undefined execData
 * - Missing required fields (handled gracefully)
 *
 * GRACEFUL_DEGRADE Parsing Tests (5):
 * - NaN closedSize
 * - Infinity in execPrice
 * - Invalid numeric strings
 * - Parsing failures on both fields
 * - Mixed valid/invalid data
 *
 * SKIP Logging Tests (3):
 * - Logger failures in constructor
 * - Logger failures during detection
 * - Multiple logging failures
 *
 * Integration E2E Tests (3):
 * - Full execution sequence with errors
 * - Counter management across errors
 * - State consistency
 *
 * Backward Compatibility Tests (2):
 * - Works without ErrorHandler (optional DI)
 * - All legacy tests still passing
 */

import { OrderExecutionDetectorService } from '../../services/order-execution-detector.service';
import { LoggerService, OrderExecutionData } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createOrderExecutionDetectorExecutionBatch,
  createOrderExecutionDetectorExecutionData,
  createOrderExecutionDetectorFailingLogger,
  createManagedOrderExecutionDetectorContext,
  createOrderExecutionDetectorScenarioHarness,
  runOrderExecutionDetectorSequence,
  type ManagedOrderExecutionDetectorContext,
} from '../helpers/order-execution-detector-test.utils';

type OrderExecutionDetectorScenarioOptions = {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
  executionOverrides?: Partial<ReturnType<typeof createOrderExecutionDetectorExecutionData>>;
  executionBatchOverrides?: Array<Partial<ReturnType<typeof createOrderExecutionDetectorExecutionData>>>;
};

type OrderExecutionDetectorFixtures = Pick<
  ManagedOrderExecutionDetectorContext,
  'logger' | 'errorHandler'
>;

describe('OrderExecutionDetectorService - Error Handling (Phase 8.9.50)', () => {
  const asExecData = (value: unknown): OrderExecutionData =>
    value as OrderExecutionData;
  const asLogger = (value: unknown): LoggerService =>
    value as LoggerService;

  let logger: LoggerService;
  let managedContext: ManagedOrderExecutionDetectorContext;
  let errorHandler: ManagedOrderExecutionDetectorContext['errorHandler'];
  let createScenario: (options?: OrderExecutionDetectorScenarioOptions) =>
    ReturnType<typeof createOrderExecutionDetectorScenarioHarness>;

  beforeEach(() => {
    managedContext = createManagedOrderExecutionDetectorContext();
    ({ logger, errorHandler } = managedContext);
    createScenario = (options = {}) =>
      createOrderExecutionDetectorScenarioHarness({
        logger: options.logger ?? logger,
        withErrorHandler: options.withErrorHandler,
        errorHandler: options.errorHandler ?? errorHandler,
        executionOverrides: options.executionOverrides,
        executionBatchOverrides: options.executionBatchOverrides,
      });
  });

  afterEach(() => {
    managedContext.cleanup();
  });

  const createMockExecutionData = createOrderExecutionDetectorExecutionData;

  // ============================================================================
  // THROW VALIDATION TESTS (3)
  // ============================================================================

  describe('THROW - Input Validation', () => {
    it('should throw on null execData', () => {
      const { service } = createScenario();

      expect(() => service.detectExecution(asExecData(null))).toThrow('execData is required');
    });

    it('should throw on undefined execData', () => {
      const { service } = createScenario();

      expect(() => service.detectExecution(asExecData(undefined))).toThrow('execData is required');
    });

    it('should handle missing optional fields gracefully', () => {
      const { service } = createScenario();

      const execData = {
        // Only required-like fields
        orderId: 'test',
        symbol: 'APEXUSDT',
        side: 'Buy',
        execType: 'Trade',
      } as unknown as OrderExecutionData;

      // Should not throw (fields are optional in detection logic)
      expect(() => service.detectExecution(execData)).not.toThrow();
      const result = service.detectExecution(execData);
      expect(result.symbol).toBe('APEXUSDT');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE PARSING TESTS (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Parsing Failures', () => {
    it('should handle NaN closedSize and return 0', () => {
      const { service } = createScenario();

      const execData = createMockExecutionData({
        closedSize: 'invalid-number',
      });

      const result = service.detectExecution(execData);

      // Should parse to 0 (GRACEFUL_DEGRADE)
      expect(result.closedSize).toBe(0);
      // Should still detect type correctly
      expect(result.type).toBe('ENTRY'); // closedSize = 0 = entry
    });

    it('should handle Infinity execPrice and return 0', () => {
      const { service } = createScenario();

      // Create a very large string that would overflow
      const execData = createMockExecutionData({
        execPrice: (Number.MAX_VALUE * 2).toString(),
      });

      const result = service.detectExecution(execData);

      // Should fallback to 0 on infinity (GRACEFUL_DEGRADE)
      expect(result.execPrice).toBe(0);
    });

    it('should handle null/undefined numeric fields', () => {
      const { service } = createScenario();

      const execData = createMockExecutionData({
        closedSize: undefined,
        execPrice: undefined,
      });

      const result = service.detectExecution(execData);

      // Should parse undefined to 0
      expect(result.closedSize).toBe(0);
      expect(result.execPrice).toBe(0);
    });

    it('should handle empty string numeric fields', () => {
      const { service } = createScenario();

      const execData = createMockExecutionData({
        closedSize: '',
        execPrice: '',
      });

      const result = service.detectExecution(execData);

      // parseFloat('') returns NaN, should fallback to 0
      expect(result.closedSize).toBe(0);
      expect(result.execPrice).toBe(0);
    });

    it('should recover after parsing failure on subsequent calls', () => {
      const { service } = createScenario();

      // First call with invalid data
      const failData = createMockExecutionData({
        closedSize: 'invalid',
        execPrice: 'bad',
      });
      const result1 = service.detectExecution(failData);
      expect(result1.closedSize).toBe(0);
      expect(result1.execPrice).toBe(0);

      // Second call with valid data should work
      const validData = createMockExecutionData({
        closedSize: '25.5',
        execPrice: '105.50',
      });
      const result2 = service.detectExecution(validData);
      expect(result2.closedSize).toBe(25.5);
      expect(result2.execPrice).toBe(105.5);
    });
  });

  // ============================================================================
  // SKIP LOGGING TESTS (3)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    it('should continue despite logger failures in detectExecution', () => {
      const failingLogger = createOrderExecutionDetectorFailingLogger({
        debug: 'Logger debug failed',
        info: 'Logger info failed',
      });

      const { service } = createScenario({
        logger: asLogger(failingLogger),
      });

      const execData = createMockExecutionData();

      // Should not throw despite logger failures (SKIP strategy)
      expect(() => service.detectExecution(execData)).not.toThrow();
      const result = service.detectExecution(execData);
      expect(result.type).toBe('TAKE_PROFIT');
    });

    it('should continue despite logger failure in resetTpCounter', () => {
      const failingLogger = createOrderExecutionDetectorFailingLogger({
        debug: 'Logger debug failed',
      });

      const { service } = createScenario({
        logger: asLogger(failingLogger),
      });

      // Should not throw on reset despite logger failure (SKIP strategy)
      expect(() => service.resetTpCounter()).not.toThrow();
      expect(service.getTpCounter()).toBe(0);
    });

    it('should continue despite logger failure in resetLastCloseReason', () => {
      const failingLogger = createOrderExecutionDetectorFailingLogger({
        debug: 'Logger debug failed',
      });

      const { service } = createScenario({
        logger: asLogger(failingLogger),
      });

      // Should not throw on reset despite logger failure (SKIP strategy)
      expect(() => service.resetLastCloseReason()).not.toThrow();
      expect(service.getLastCloseReason()).toBeNull();
    });
  });

  // ============================================================================
  // INTEGRATION E2E TESTS (3)
  // ============================================================================

  describe('Integration - Cascading Failures', () => {
    it('should handle full execution sequence with parsing errors', () => {
      const { service } = createScenario();

      const [tp1Data, tp2Data] = createOrderExecutionDetectorExecutionBatch([
        {
          orderId: 'tp1',
          closedSize: '10',
        },
        {
          orderId: 'tp2',
          closedSize: 'invalid',
        },
      ]);
      const tp1Result = service.detectExecution(tp1Data);
      expect(tp1Result.type).toBe('TAKE_PROFIT');
      expect(tp1Result.tpLevel).toBe(1);
      expect(service.getTpCounter()).toBe(1);

      const tp2Result = service.detectExecution(tp2Data);
      expect(tp2Result.type).toBe('ENTRY'); // closedSize = 0 = entry
      expect(service.getTpCounter()).toBe(0); // Reset on entry
    });

    it('should maintain state across error scenarios', () => {
      const { service } = createScenario();

      // Set up initial state
      const tp1 = createMockExecutionData({ orderId: 'tp1' });
      service.detectExecution(tp1);
      expect(service.getTpCounter()).toBe(1);
      expect(service.getLastCloseReason()).toBe('TP');

      // Error case - invalid data (closedSize = 'invalid' parses to 0 = entry)
      const invalidData = createMockExecutionData({
        execPrice: 'bad',
        closedSize: 'invalid', // Parses to 0
      });
      service.detectExecution(invalidData);

      // State should still be accessible
      expect(service.getTpCounter()).toBe(0); // Reset on entry
      // lastCloseReason stays 'TP' (entry doesn't change it - explicit reset needed)
      expect(service.getLastCloseReason()).toBe('TP');

      // Explicitly reset
      service.resetLastCloseReason();
      expect(service.getLastCloseReason()).toBeNull();

      // Recover with valid data
      const sl = createMockExecutionData({ stopOrderType: 'StopLoss' });
      service.detectExecution(sl);
      expect(service.getLastCloseReason()).toBe('SL');
    });

    it('should handle ErrorHandler throw gracefully', () => {
      const failingErrorHandler = {
        handle: jest.fn(() => {
          throw new Error('ErrorHandler.handle failed');
        }),
      } as unknown as ErrorHandler;

      const { service } = createScenario({
        errorHandler: failingErrorHandler,
      });

      const execData = createMockExecutionData({
        closedSize: 'invalid',
      });

      // Should not throw even if ErrorHandler.handle throws
      expect(() => service.detectExecution(execData)).not.toThrow();
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (2)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler (optional DI)', () => {
      // Constructor without errorHandler
      const { service } = createScenario({
        withErrorHandler: false,
      });

      const execData = createMockExecutionData();

      const result = service.detectExecution(execData);

      expect(result.type).toBe('TAKE_PROFIT');
      expect(result.tpLevel).toBe(1);
      expect(service.getTpCounter()).toBe(1);
    });

    it('should still throw on THROW validation without ErrorHandler', () => {
      const { service } = createScenario({
        withErrorHandler: false,
      });

      // THROW validation should still work without ErrorHandler
      expect(() => service.detectExecution(asExecData(null))).toThrow('execData is required');
    });
  });

  // ============================================================================
  // EDGE CASES & COUNTER MANAGEMENT TESTS (3)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle multiple consecutive TPs with some invalid data', () => {
      const { service } = createScenario();

      // Valid TP1
      service.detectExecution(createMockExecutionData({ orderId: 'tp1' }));
      expect(service.getTpCounter()).toBe(1);

      // TP2 with invalid parsing (falls back to entry, resets counter)
      service.detectExecution(createMockExecutionData({
        orderId: 'tp2',
        closedSize: 'invalid',
      }));
      expect(service.getTpCounter()).toBe(0);

      // Valid TP1 again (new sequence)
      service.detectExecution(createMockExecutionData({ orderId: 'tp1-new' }));
      expect(service.getTpCounter()).toBe(1);
    });

    it('should validate TP detection with boundary closedSize values', () => {
      const { service } = createScenario();

      // closedSize = 0.0001 (still > 0, should be TP)
      const tpData = createMockExecutionData({
        closedSize: '0.0001',
      });
      const result = service.detectExecution(tpData);
      expect(result.type).toBe('TAKE_PROFIT');

      // Reset for next test
      service.resetTpCounter();

      // closedSize = 0 (should be entry)
      const entryData = createMockExecutionData({
        closedSize: '0',
      });
      const result2 = service.detectExecution(entryData);
      expect(result2.type).toBe('ENTRY');
    });

    it('should track all execution types with error handling', () => {
      const { service } = createScenario();

      // Test all execution types
      const types = [
        { data: createMockExecutionData(), expected: 'TAKE_PROFIT' },
        { data: createMockExecutionData({ stopOrderType: 'StopLoss' }), expected: 'STOP_LOSS' },
        { data: createMockExecutionData({ stopOrderType: 'Stop' }), expected: 'STOP_LOSS' },
        { data: createMockExecutionData({ stopOrderType: 'TrailingStop' }), expected: 'TRAILING_STOP' },
        { data: createMockExecutionData({ closedSize: '0' }), expected: 'ENTRY' },
      ];

      for (const { data, expected } of types) {
        const result = service.detectExecution(data);
        expect(result.type).toBe(expected);
        service.resetTpCounter();
        service.resetLastCloseReason();
      }
    });
  });
});
