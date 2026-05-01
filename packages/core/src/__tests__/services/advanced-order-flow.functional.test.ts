import {
  addAdvancedOrderFlowTicks,
  createAdvancedOrderFlowOrderbookWithOverrides,
  createManagedAdvancedOrderFlowContext,
} from '../helpers/advanced-order-flow-test.utils';

describe('AdvancedOrderFlowService functional behavior', () => {
  it('combines imbalance, pattern, spoofing, and momentum in one trading flow', () => {
    const { service, cleanup } = createManagedAdvancedOrderFlowContext();

    addAdvancedOrderFlowTicks(service, [
      { side: 'BUY', price: 50000, size: 2 },
      { side: 'BUY', price: 50005, size: 1 },
      { side: 'SELL', price: 50010, size: 0.25 },
    ]);

    service.processOrderbook(createAdvancedOrderFlowOrderbookWithOverrides({
      bids: [[50000, 1], [49990, 1]],
      asks: [[50010, 1], [50020, 1]],
    }));
    service.processOrderbook(createAdvancedOrderFlowOrderbookWithOverrides({
      bids: [[50000, 6], [49990, 1]],
      asks: [[50010, 1], [50020, 1]],
    }));

    const analysis = service.analyze();
    expect(analysis.tickCount).toBe(3);
    expect(analysis.buyVolume).toBeGreaterThan(analysis.sellVolume);
    expect(analysis.direction).toBe('LONG');
    expect(service.getSpoofing()?.confidence).toBeGreaterThanOrEqual(0);
    expect(service.getMomentum()?.direction).toBe('LONG');

    cleanup();
  });
});
