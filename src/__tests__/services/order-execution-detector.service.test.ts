/**
 * Order Execution Detector Service Tests
 * Tests for TP/SL/Trailing Stop detection logic
 */

import { OrderExecutionDetectorService } from '../../services/order-execution-detector.service';
import { LoggerService, LogLevel, OrderExecutionData } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createMockExecutionData = (overrides?: Partial<OrderExecutionData>): OrderExecutionData => ({
  orderId: 'test-order-123',
  symbol: 'APEXUSDT',
  side: 'Buy',
  execType: 'Trade',
  execPrice: '100.50',
  execQty: '10',
  closedSize: '10',
  stopOrderType: 'UNKNOWN',
  orderType: 'Market',
  createType: 'CreateByUser',
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('OrderExecutionDetectorService', () => {
  let service: OrderExecutionDetectorService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    service = new OrderExecutionDetectorService(logger);
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

      const tp1 = createMockExecutionData({ orderId: 'tp1' });
      service.detectExecution(tp1);
      expect(service.getTpCounter()).toBe(1);

      const tp2 = createMockExecutionData({ orderId: 'tp2' });
      service.detectExecution(tp2);
      expect(service.getTpCounter()).toBe(2);

      const tp3 = createMockExecutionData({ orderId: 'tp3' });
      service.detectExecution(tp3);
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
      const tp1 = createMockExecutionData({ orderId: 'tp1' });
      const result1 = service.detectExecution(tp1);
      expect(result1.tpLevel).toBe(1);

      const tp2 = createMockExecutionData({ orderId: 'tp2' });
      const result2 = service.detectExecution(tp2);
      expect(result2.tpLevel).toBe(2);

      const tp3 = createMockExecutionData({ orderId: 'tp3' });
      const result3 = service.detectExecution(tp3);
      expect(result3.tpLevel).toBe(3);
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
