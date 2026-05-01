import {
  calculateOrderBookSideVolume,
  calculateOrderFlowVolumeUsdt,
  calculateOrderFlowVolumes,
  cleanupOrderFlowTicks,
  getRecentOrderBooks,
} from '../../services/advanced-order-flow/advanced-order-flow-state.utils';
import {
  createAdvancedOrderFlowOrderbook,
  createAdvancedOrderFlowTickSequence,
} from '../helpers/advanced-order-flow-test.utils';

describe('advanced-order-flow state utils', () => {
  it('calculates aggregated buy and sell volume', () => {
    const ticks = createAdvancedOrderFlowTickSequence([
      { side: 'BUY', price: 100, size: 2, timestamp: 1 },
      { side: 'SELL', price: 50, size: 1, timestamp: 2 },
    ]);

    expect(calculateOrderFlowVolumes(ticks)).toEqual({ buyVol: 200, sellVol: 50 });
    expect(calculateOrderFlowVolumeUsdt(ticks)).toBe(250);
  });

  it('cleans tick history to the active window and cap', () => {
    const ticks = createAdvancedOrderFlowTickSequence([
      { side: 'BUY', timestamp: 1000 },
      { side: 'SELL', timestamp: 4000 },
      { side: 'BUY', timestamp: 5000 },
    ]);

    const cleaned = cleanupOrderFlowTicks({
      tickBuffer: ticks,
      currentTime: 5000,
      tickWindowMs: 1500,
      maxTickBufferSize: 1,
    });

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].timestamp).toBe(5000);
  });

  it('reads recent orderbook context and side volume', () => {
    const previous = createAdvancedOrderFlowOrderbook();
    const current = createAdvancedOrderFlowOrderbook();
    const recent = getRecentOrderBooks([previous, current]);

    expect(recent.previous).toBe(previous);
    expect(recent.current).toBe(current);
    expect(calculateOrderBookSideVolume(current.bids, 2)).toBeCloseTo(3);
  });
});
