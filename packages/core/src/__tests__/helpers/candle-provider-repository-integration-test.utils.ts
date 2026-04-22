import { IExchange } from '../../interfaces/IExchange';
import { IMarketDataRepository } from '../../repositories/IRepositories';
import { MarketDataCacheRepository } from '../../repositories/market-data.cache-repository';
import { CandleProvider } from '../../providers/candle.provider';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import { Candle, LoggerService, TimeframeRole } from '../../types/legacy';
import {
  createCandleProviderMockLogger,
  type CandleProviderMockLogger,
} from './candle-provider-test.utils';

export class IntegrationMockExchange {
  private callCount = 0;

  async getCandles(params: {
    symbol: string;
    timeframe: string;
    limit?: number;
  }): Promise<Candle[]> {
    this.callCount++;
    const { limit = 100 } = params;
    const candles: Candle[] = [];
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      candles.push({
        timestamp: now - i * 60000,
        open: 100 + i * 0.1,
        high: 102 + i * 0.1,
        low: 99 + i * 0.1,
        close: 101 + i * 0.1,
        volume: 1000 + i,
      });
    }

    return candles.reverse();
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

export class IntegrationMockTimeframeProvider {
  getAllTimeframes(): Map<TimeframeRole, { interval: string; candleLimit: number }> {
    return new Map([
      ['PRIMARY' as TimeframeRole, { interval: '1', candleLimit: 100 }],
      ['ENTRY' as TimeframeRole, { interval: '5', candleLimit: 100 }],
      ['HTF1' as TimeframeRole, { interval: '1h', candleLimit: 50 }],
      ['HTF2' as TimeframeRole, { interval: '4h', candleLimit: 50 }],
    ]);
  }

  getTimeframe(role: TimeframeRole): { interval: string; candleLimit: number } {
    const timeframe = this.getAllTimeframes().get(role);
    if (!timeframe) {
      throw new Error(`Timeframe ${role} not found`);
    }
    return timeframe;
  }
}

export function createIntegrationClosedCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 5000,
    ...overrides,
  };
}

export function createIntegrationRapidCandles(
  count: number,
  startTimestamp = Date.now(),
): Candle[] {
  return Array.from({ length: count }, (_, index) => createIntegrationClosedCandle({
    timestamp: startTimestamp + index * 1000,
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1000 + index,
  }));
}

type IntegrationRepositoryRole = 'PRIMARY' | 'ENTRY' | 'HTF1' | 'HTF2';

export function getRepositoryCandlesByRole(
  repository: IMarketDataRepository,
  role: IntegrationRepositoryRole,
): Candle[] {
  const timeframeMap: Record<IntegrationRepositoryRole, string> = {
    PRIMARY: '1',
    ENTRY: '5',
    HTF1: '1h',
    HTF2: '4h',
  };

  return repository.getCandles('XRPUSDT', timeframeMap[role]);
}

export function createCandleProviderRepositoryIntegrationHarness(): {
  provider: CandleProvider;
  exchange: IntegrationMockExchange;
  repository: IMarketDataRepository;
  timeframeProvider: TimeframeProvider;
  logger: CandleProviderMockLogger & LoggerService;
} {
  const exchange = new IntegrationMockExchange();
  const repository = new MarketDataCacheRepository();
  const timeframeProvider = new IntegrationMockTimeframeProvider() as unknown as TimeframeProvider;
  const logger = createCandleProviderMockLogger();

  return {
    provider: new CandleProvider(
      timeframeProvider,
      exchange as unknown as IExchange,
      logger,
      'XRPUSDT',
      repository,
    ),
    exchange,
    repository,
    timeframeProvider,
    logger,
  };
}

export interface ManagedCandleProviderRepositoryIntegrationContext {
  provider: CandleProvider;
  exchange: IntegrationMockExchange;
  repository: IMarketDataRepository;
  timeframeProvider: TimeframeProvider;
  logger: CandleProviderMockLogger & LoggerService;
  cleanup: () => void;
}

export type CandleProviderRepositoryIntegrationRuntime = Pick<
  ManagedCandleProviderRepositoryIntegrationContext,
  'provider' | 'exchange' | 'repository' | 'timeframeProvider' | 'logger' | 'cleanup'
>;

export function createManagedCandleProviderRepositoryIntegrationContext():
ManagedCandleProviderRepositoryIntegrationContext {
  const harness = createCandleProviderRepositoryIntegrationHarness();

  return {
    ...harness,
    cleanup() {
      harness.provider.clearAllCaches();
      jest.restoreAllMocks();
    },
  };
}
