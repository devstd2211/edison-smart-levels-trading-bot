/**
 * Order Execution Detector Service Tests
 * Tests for TP/SL/Trailing Stop detection logic
 */

import { OrderExecutionData } from '../../types/legacy';
import {
  createOrderExecutionDetectorExecutionBatch,
  createOrderExecutionDetectorExecutionData,
  createManagedOrderExecutionDetectorContext,
  createOrderExecutionDetectorScenarioHarness,
  runOrderExecutionDetectorSequence,
  type ManagedOrderExecutionDetectorContext,
  type OrderExecutionDetectorScenarioHarnessState,
} from '../helpers/order-execution-detector-test.utils';

type OrderExecutionDetectorScenarioOptions = {
  withErrorHandler?: boolean;
  executionOverrides?: Partial<OrderExecutionData>;
  executionBatchOverrides?: Array<Partial<OrderExecutionData>>;
};
// ============================================================================
// MOCKS
// ============================================================================

const createMockExecutionData = createOrderExecutionDetectorExecutionData;

// ============================================================================
// TESTS
// ============================================================================

describe('OrderExecutionDetectorService', () => {
  let service: ManagedOrderExecutionDetectorContext['service'];
  let createScenario: (options?: OrderExecutionDetectorScenarioOptions) =>
    OrderExecutionDetectorScenarioHarnessState;
  let cleanup: ManagedOrderExecutionDetectorContext['cleanup'];

  beforeEach(() => {
    const {
      service: managedService,
      cleanup: managedCleanup,
      logger: managedLogger,
    } = createManagedOrderExecutionDetectorContext({
      withErrorHandler: false,
    });
    service = managedService;
    cleanup = managedCleanup;
    createScenario = (options = {}) =>
      createOrderExecutionDetectorScenarioHarness({
        logger: managedLogger,
        withErrorHandler: options.withErrorHandler,
        executionOverrides: options.executionOverrides,
        executionBatchOverrides: options.executionBatchOverrides,
      });
  });

  afterEach(() => {
    cleanup();
  });

  describe('detectExecution', () => {
    it('should detect TP execution (UNKNOWN + CreateByUser + closedSize > 0)', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'UNKNOWN',
        createType: 'CreateByUser',
        closedSize: '10',
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('TAKE_PROFIT');
      expect(result.tpLevel).toBe(1);
      expect(result.symbol).toBe('APEXUSDT');
      expect(result.closedSize).toBe(10);
    });

    it('should detect SL execution (StopLoss variant 1)', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'StopLoss',
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('STOP_LOSS');
      expect(result.symbol).toBe('APEXUSDT');
    });

    it('should detect SL execution (Stop variant - Bybit uses both)', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'Stop',
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('STOP_LOSS');
      expect(result.symbol).toBe('APEXUSDT');
    });

    it('should detect Trailing Stop execution', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'TrailingStop',
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('TRAILING_STOP');
      expect(result.symbol).toBe('APEXUSDT');
    });

    it('should detect ENTRY execution (regular market/limit fill)', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'UNKNOWN',
        createType: 'CreateByUser',
        closedSize: '0', // closedSize = 0 means entry, not TP
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('ENTRY');
    });

    it('should increment TP counter on consecutive TP hits', () => {
      expect(service.getTpCounter()).toBe(0);

      createOrderExecutionDetectorExecutionBatch([
        { orderId: 'tp1' },
        { orderId: 'tp2' },
        { orderId: 'tp3' },
      ]).forEach((execution, index) => {
        service.detectExecution(execution);
        expect(service.getTpCounter()).toBe(index + 1);
      });

      expect(service.getTpCounter()).toBe(3);
    });

    it('should reset TP counter on SL hit', () => {
      // Increment counter first
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getTpCounter()).toBe(1);

      // SL hit should reset
      const sl = createMockExecutionData({ stopOrderType: 'StopLoss' });
      service.detectExecution(sl);
      expect(service.getTpCounter()).toBe(0);
    });

    it('should reset TP counter on Trailing Stop hit', () => {
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getTpCounter()).toBe(1);

      const trailing = createMockExecutionData({ stopOrderType: 'TrailingStop' });
      service.detectExecution(trailing);
      expect(service.getTpCounter()).toBe(0);
    });

    it('should reset TP counter on ENTRY execution', () => {
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getTpCounter()).toBe(1);

      // New entry resets counter
      const entry = createMockExecutionData({
        orderId: 'entry-new',
        stopOrderType: 'UNKNOWN',
        createType: 'CreateByUser',
        closedSize: '0',
      });
      service.detectExecution(entry);
      expect(service.getTpCounter()).toBe(0);
    });

    it('should track last close reason as TP', () => {
      expect(service.getLastCloseReason()).toBeNull();

      const tp = createMockExecutionData();
      service.detectExecution(tp);

      expect(service.getLastCloseReason()).toBe('TP');
    });

    it('should track last close reason as SL', () => {
      const sl = createMockExecutionData({ stopOrderType: 'StopLoss' });
      service.detectExecution(sl);

      expect(service.getLastCloseReason()).toBe('SL');
    });

    it('should track last close reason as TRAILING', () => {
      const trailing = createMockExecutionData({ stopOrderType: 'TrailingStop' });
      service.detectExecution(trailing);

      expect(service.getLastCloseReason()).toBe('TRAILING');
    });

    it('should return correct result structure', () => {
      const execData = createMockExecutionData();
      const result = service.detectExecution(execData);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('closedSize');
      expect(result).toHaveProperty('execPrice');
      expect(result).toHaveProperty('execQty');
      expect(result).toHaveProperty('side');
    });
  });

  describe('TP Counter Management', () => {
    it('getTpCounter should return current counter', () => {
      expect(service.getTpCounter()).toBe(0);

      const tp = createMockExecutionData();
      service.detectExecution(tp);

      expect(service.getTpCounter()).toBe(1);
    });

    it('resetTpCounter should reset counter to 0', () => {
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getTpCounter()).toBe(1);

      service.resetTpCounter();
      expect(service.getTpCounter()).toBe(0);
    });

    it('should track tpLevel in result', () => {
      const results = runOrderExecutionDetectorSequence(service, [
        { orderId: 'tp1' },
        { orderId: 'tp2' },
        { orderId: 'tp3' },
      ]);

      expect(results[0].tpLevel).toBe(1);
      expect(results[1].tpLevel).toBe(2);
      expect(results[2].tpLevel).toBe(3);
    });
  });

  describe('Last Close Reason Management', () => {
    it('getLastCloseReason should return current reason', () => {
      expect(service.getLastCloseReason()).toBeNull();

      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getLastCloseReason()).toBe('TP');
    });

    it('resetLastCloseReason should reset to null', () => {
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getLastCloseReason()).toBe('TP');

      service.resetLastCloseReason();
      expect(service.getLastCloseReason()).toBeNull();
    });

    it('should handle multiple executions and track last reason', () => {
      const tp = createMockExecutionData();
      service.detectExecution(tp);
      expect(service.getLastCloseReason()).toBe('TP');

      const tp2 = createMockExecutionData({ orderId: 'tp2' });
      service.detectExecution(tp2);
      expect(service.getLastCloseReason()).toBe('TP');

      const sl = createMockExecutionData({ stopOrderType: 'StopLoss' });
      service.detectExecution(sl);
      expect(service.getLastCloseReason()).toBe('SL');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      ({ service } = createScenario({ withErrorHandler: false }));
    });

    it('should handle null/undefined fields gracefully', () => {
      const execData = createMockExecutionData({
        orderId: undefined,
        execPrice: undefined,
        closedSize: undefined,
      });

      const result = service.detectExecution(execData);

      expect(result.orderId).toBeUndefined();
      expect(result.execPrice).toBe(0); // undefined ?? '0' → 0
      expect(result.closedSize).toBe(0);
    });

    it('should parse numeric strings correctly', () => {
      const execData = createMockExecutionData({
        execPrice: '105.50',
        closedSize: '25.5',
      });

      const result = service.detectExecution(execData);

      expect(result.execPrice).toBe(105.5);
      expect(result.closedSize).toBe(25.5);
    });

    it('should handle zero closedSize correctly', () => {
      const execData = createMockExecutionData({
        stopOrderType: 'UNKNOWN',
        createType: 'CreateByUser',
        closedSize: '0',
      });

      const result = service.detectExecution(execData);

      expect(result.type).toBe('ENTRY'); // 0 closedSize = entry, not TP
    });
  });
});
