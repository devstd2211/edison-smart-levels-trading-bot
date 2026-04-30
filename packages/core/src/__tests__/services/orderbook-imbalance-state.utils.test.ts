import {
  analyzeOrderbookImbalance,
  createNeutralImbalanceAnalysis,
  sumOrderbookSideVolume,
  validateOrderbookImbalanceConfig,
  validateOrderbookSnapshot,
} from '../../services/orderbook-imbalance/orderbook-imbalance-state.utils';
import {
  createOrderbookImbalanceConfig,
  createOrderbookImbalanceScenario,
} from '../helpers/orderbook-imbalance-test.utils';

describe('orderbook-imbalance state utils', () => {
  it('validates config and orderbook inputs', () => {
    expect(() => validateOrderbookImbalanceConfig(createOrderbookImbalanceConfig())).not.toThrow();
    expect(() => validateOrderbookSnapshot(createOrderbookImbalanceScenario())).not.toThrow();
  });

  it('sums side volume and returns null for invalid quantities', () => {
    expect(sumOrderbookSideVolume([[100, 2], [99, 3]])).toBe(5);
    expect(sumOrderbookSideVolume([[100, Number.NaN]])).toBeNull();
  });

  it('computes imbalance direction and neutral defaults', () => {
    const config = createOrderbookImbalanceConfig({ levels: 2, minImbalancePercent: 10 });
    const analysis = analyzeOrderbookImbalance(
      createOrderbookImbalanceScenario({
        bidQuantities: [30, 20],
        askQuantities: [10, 10],
      }),
      config,
      1000,
    );

    expect(analysis).toEqual(
      expect.objectContaining({
        timestamp: 1000,
        direction: 'BID',
        bidVolume: 50,
        askVolume: 20,
      }),
    );
    expect(createNeutralImbalanceAnalysis(1000).direction).toBe('NEUTRAL');
  });
});
