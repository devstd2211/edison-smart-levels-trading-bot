import {
  cleanupTrackedOrder,
  clearTrackedOrders,
  getTrackedOrderState,
} from '../../services/smart-order-execution/smart-order-execution-state.utils';
import { createSmartOrderExecutionReport } from '../helpers/smart-order-execution-test.utils';

describe('smart-order-execution state utils', () => {
  it('returns null when no tracked order exists', () => {
    expect(getTrackedOrderState(new Map(), 'missing')).toBeNull();
  });

  it('cleans up terminal orders only', () => {
    const activeOrders = new Map([
      ['done', createSmartOrderExecutionReport({ status: 'completed' })],
      ['live', createSmartOrderExecutionReport({ orderId: 'live', status: 'executing' })],
    ]);
    const orderStartTimes = new Map([
      ['done', 1],
      ['live', 2],
    ]);
    const safeLog = jest.fn();

    expect(cleanupTrackedOrder({
      activeOrders,
      orderStartTimes,
      orderId: 'done',
      safeLog,
    })).toBe(true);
    expect(cleanupTrackedOrder({
      activeOrders,
      orderStartTimes,
      orderId: 'live',
      safeLog,
    })).toBe(false);
  });

  it('clears all tracked orders and start times', () => {
    const activeOrders = new Map([
      ['one', createSmartOrderExecutionReport()],
    ]);
    const orderStartTimes = new Map([['one', 1]]);

    clearTrackedOrders({ activeOrders, orderStartTimes, safeLog: jest.fn() });

    expect(activeOrders.size).toBe(0);
    expect(orderStartTimes.size).toBe(0);
  });
});
