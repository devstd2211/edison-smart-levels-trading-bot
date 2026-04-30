import { TimeframeRole } from '../../types/enums';
import {
  createIntegrationClosedCandle,
  createManagedCandleProviderRepositoryIntegrationContext,
  type CandleProviderRepositoryIntegrationRuntime,
} from '../helpers/candle-provider-repository-integration-test.utils';

describe('CandleProvider - Functional behavior', () => {
  let provider: CandleProviderRepositoryIntegrationRuntime['provider'];
  let exchange: CandleProviderRepositoryIntegrationRuntime['exchange'];
  let repository: CandleProviderRepositoryIntegrationRuntime['repository'];
  let cleanup: CandleProviderRepositoryIntegrationRuntime['cleanup'];

  beforeEach(() => {
    ({ provider, exchange, repository, cleanup } =
      createManagedCandleProviderRepositoryIntegrationContext());
  });

  afterEach(() => {
    cleanup();
  });

  it('loads enabled timeframes once and then serves candles from repository cache', async () => {
    await provider.initialize();
    exchange.resetCallCount();

    const entryCandles = await provider.getCandles(TimeframeRole.ENTRY, 20);
    const primaryCandles = await provider.getCandles(TimeframeRole.PRIMARY, 15);

    expect(entryCandles).toHaveLength(20);
    expect(primaryCandles).toHaveLength(15);
    expect(exchange.getCallCount()).toBe(0);
  });

  it('repopulates repository data after a cache miss and preserves the requested timeframe', async () => {
    await provider.initializeTimeframe(TimeframeRole.PRIMARY);
    repository.clear();
    exchange.resetCallCount();

    const candles = await provider.getCandles(TimeframeRole.PRIMARY, 12);

    expect(candles).toHaveLength(12);
    expect(exchange.getCallCount()).toBe(1);
    expect(repository.getCandles('XRPUSDT', '1').length).toBeGreaterThan(0);
    expect(repository.getCandles('XRPUSDT', '5').length).toBe(0);
  });

  it('accepts closed-candle updates and exposes the latest repository snapshot after recovery', async () => {
    await provider.initializeTimeframe(TimeframeRole.PRIMARY);
    const closedCandle = createIntegrationClosedCandle({
      timestamp: Date.now() + 60_000,
      close: 155,
    });

    provider.onCandleClosed(TimeframeRole.PRIMARY, closedCandle);
    expect(repository.getLatestCandle('XRPUSDT', '1')?.timestamp).toBe(
      closedCandle.timestamp,
    );

    provider.clearAllCaches();
    exchange.resetCallCount();
    await provider.initializeTimeframe(TimeframeRole.PRIMARY);

    const latest = repository.getLatestCandle('XRPUSDT', '1');

    expect(latest).not.toBeNull();
    expect(latest!.timestamp).not.toBe(closedCandle.timestamp);
    expect(exchange.getCallCount()).toBe(1);
  });
});
