import {
  createManagedOrderbookImbalanceContext,
  createOrderbookImbalanceScenario,
} from '../helpers/orderbook-imbalance-test.utils';

describe('OrderbookImbalanceService functional behavior', () => {
  it('analyzes bullish, bearish, and disabled orderbooks through one workflow', () => {
    const { service, createLegacyService, cleanup } = createManagedOrderbookImbalanceContext();

    const bullish = service.analyze(
      createOrderbookImbalanceScenario({
        bidQuantities: [40, 30],
        askQuantities: [10, 10],
      }),
    );
    expect(bullish.direction).toBe('BID');

    const bearish = service.analyze(
      createOrderbookImbalanceScenario({
        bidQuantities: [10, 10],
        askQuantities: [40, 30],
      }),
    );
    expect(bearish.direction).toBe('ASK');

    const disabledService = createLegacyService({
      configOverrides: { enabled: false },
    });
    expect(disabledService.analyze(createOrderbookImbalanceScenario()).direction).toBe('NEUTRAL');

    cleanup();
  });
});
