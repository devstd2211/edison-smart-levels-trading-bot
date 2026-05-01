import {
  createManagedSmartOrderExecutionContext,
  createMinimalSmartOrder,
} from '../helpers/smart-order-execution-test.utils';

describe('SmartOrderExecutionService functional behavior', () => {
  it('executes, monitors, and clears a smart order in one flow', async () => {
    const { service, cleanup } = createManagedSmartOrderExecutionContext();
    const report = await service.executeSmartOrder(createMinimalSmartOrder({ size: 2 }));

    expect(report.status).toBe('completed');
    expect(service.getActiveOrderCount()).toBe(1);

    const monitored = await service.monitorAndAdjust(report.orderId);
    expect(monitored?.orderId).toBe(report.orderId);

    expect(service.cleanupOrder(report.orderId)).toBe(true);
    expect(service.getOrderState(report.orderId)).toBeNull();

    cleanup();
  });
});
