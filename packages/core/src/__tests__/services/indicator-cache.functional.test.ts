import { MarketDataCacheRepository } from '../../repositories/market-data.cache-repository';
import { IndicatorCacheService } from '../../services/indicator-cache.service';

describe('IndicatorCacheService - Functional behavior', () => {
  let repository: MarketDataCacheRepository;
  let cache: IndicatorCacheService;

  beforeEach(() => {
    repository = new MarketDataCacheRepository();
    cache = new IndicatorCacheService(repository);
  });

  it('serves indicator values from the shared repository and reports hits without API-specific scaffolding', () => {
    cache.set('EMA-20-5m', 102.25, 60_000);

    const firstRead = cache.get('EMA-20-5m');
    const secondRead = cache.get('EMA-20-5m');
    const stats = cache.getStats();

    expect(firstRead).toBe(102.25);
    expect(secondRead).toBe(102.25);
    expect(repository.getIndicator('EMA-20-5m')).toBe(102.25);
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(100);
  });

  it('expires indicator values via repository TTL and keeps miss accounting aligned after fallback reads', async () => {
    cache.set('RSI-14-1m', 48.5, 25);

    expect(cache.get('RSI-14-1m')).toBe(48.5);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const expiredValue = cache.get('RSI-14-1m');
    const stats = cache.getStats();

    expect(expiredValue).toBeNull();
    expect(repository.getIndicator('RSI-14-1m')).toBeNull();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.totalRequests).toBe(2);
  });

  it('clears repository-backed state and resets compatibility metrics independently', () => {
    cache.set('ATR-14-15m', 1.75, 60_000);
    cache.get('ATR-14-15m');
    cache.clear();

    const afterClear = cache.get('ATR-14-15m');
    expect(afterClear).toBeNull();

    cache.resetMetrics();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });
});
