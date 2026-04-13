/**
 * CandleProvider Error Handling Tests (Phase 8.9.9)
 *
 * Comprehensive test suite for CandleProvider error handling:
 * - loadTimeframeCandles() with RETRY strategy (exchange API calls)
 * - initialize() with SKIP strategy (partial failures)
 * - getCandles() with RETRY fallback (cache miss recovery)
 * - onCandleClosed() with SKIP strategy (non-critical operations)
 * - Error classification for domain-specific errors
 * - Backward compatibility (without ErrorHandler)
 * - E2E recovery scenarios
 */

import { CandleProvider } from '../../providers/candle.provider';
import {
  ExchangeConnectionError,
  ExchangeRateLimitError,
  ExchangeAPIError,
} from '../../errors/DomainErrors';
import { TimeframeRole } from '../../types/enums';
import {
  createCandleProviderMockCandle,
  createManagedLegacyCandleProviderContext,
  createManagedStandardCandleProviderContext,
  type CandleProviderGetCandlesParams,
  type ManagedCandleProviderContext,
  type ManagedLegacyCandleProviderContext,
} from '../helpers/candle-provider-test.utils';

type CandleProviderStandardFixtures = Pick<
  ManagedCandleProviderContext,
  'logger' | 'exchange' | 'repository' | 'provider' | 'timeframeProvider'
>;
type CandleProviderLegacyFixtures = Pick<
  ManagedLegacyCandleProviderContext,
  'exchange' | 'provider'
>;
type ManagedStandardCandleProviderOptions = Parameters<typeof createManagedStandardCandleProviderContext>[0];
type ManagedLegacyCandleProviderOptions = Parameters<typeof createManagedLegacyCandleProviderContext>[0];

const standardContexts: ManagedCandleProviderContext[] = [];
const legacyContexts: ManagedLegacyCandleProviderContext[] = [];

function createStandardContext(
  options?: ManagedStandardCandleProviderOptions,
): CandleProviderStandardFixtures {
  const context = createManagedStandardCandleProviderContext(options);
  standardContexts.push(context);
  return {
    logger: context.logger,
    exchange: context.exchange,
    repository: context.repository,
    provider: context.provider,
    timeframeProvider: context.timeframeProvider,
  };
}

function createLegacyContext(
  options?: ManagedLegacyCandleProviderOptions,
): CandleProviderLegacyFixtures {
  const context = createManagedLegacyCandleProviderContext(options);
  legacyContexts.push(context);
  return {
    exchange: context.exchange,
    provider: context.provider,
  };
}

afterEach(() => {
  while (standardContexts.length > 0) {
    standardContexts.pop()?.cleanup();
  }
  while (legacyContexts.length > 0) {
    legacyContexts.pop()?.cleanup();
  }
});

describe('CandleProvider - RETRY Strategy', () => {
  describe('A1: Network error -> retries 3x -> throws ExchangeConnectionError', () => {
    it('should retry 3 times on ECONNREFUSED and throw ExchangeConnectionError', async () => {
      const { logger, exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused'),
      );

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow(ExchangeConnectionError);

      expect(exchange.getCandles).toHaveBeenCalledTimes(3);

      const warnCalls = logger.warn.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('Retrying'),
      );
      expect(warnCalls.length).toBeGreaterThan(0);
    });
  });

  describe('A2: Rate limit error -> retries with backoff -> throws ExchangeRateLimitError', () => {
    it('should retry on 429 rate limit error and throw ExchangeRateLimitError', async () => {
      const { exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(new Error('429: Rate limit exceeded'));

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow(ExchangeRateLimitError);

      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
    });
  });

  describe('A3: Successful load after 2 retries -> stores in repository', () => {
    it('should retry and succeed on the second attempt', async () => {
      const { logger, exchange, repository, provider } = createStandardContext();

      exchange.getCandles
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);

      await provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100);

      expect(exchange.getCandles).toHaveBeenCalledTimes(2);
      expect(repository.saveCandles).toHaveBeenCalledWith('APEXUSDT', '1', [
        expect.any(Object),
      ]);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
    });
  });
});

describe('CandleProvider - SKIP Strategy for initialize()', () => {
  describe('B1: One timeframe fails -> skips it, loads others successfully', () => {
    it('should skip failed timeframe and load others', async () => {
      const { logger, exchange, provider } = createStandardContext();

      exchange.getCandles.mockImplementation(
        ({ timeframe }: CandleProviderGetCandlesParams) => {
          if (timeframe === '5') {
            return Promise.reject(new Error('timeout'));
          }

          return Promise.resolve([
            { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
          ]);
        },
      );

      await provider.initialize();

      expect(exchange.getCandles).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load PRIMARY'),
        expect.any(Object),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Candle loading complete'),
      );
    });
  });

  describe('B2: All timeframes fail -> logs warnings, completes without throwing', () => {
    it('should handle all timeframes failing gracefully', async () => {
      const { logger, exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(new Error('network error'));

      await provider.initialize();

      expect(logger.warn.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Candle loading complete'),
      );
    });
  });

  describe('B3: All timeframes succeed -> loads all into repository', () => {
    it('should load all timeframes successfully', async () => {
      const { logger, exchange, repository, provider } = createStandardContext();

      await provider.initialize();

      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
      expect(repository.saveCandles).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Candle loading complete'),
      );
    });
  });
});

describe('CandleProvider - Cache Miss Recovery with RETRY', () => {
  describe('C1: Cache empty -> loads from API with RETRY -> returns candles', () => {
    it('should load from API when cache is empty', async () => {
      const { logger, exchange, repository, provider } =
        createStandardContext();

      repository.getCandles.mockReturnValueOnce([]).mockReturnValueOnce([
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
      ]);

      const result = await provider.getCandles(TimeframeRole.ENTRY);

      expect(result).toHaveLength(2);
      expect(exchange.getCandles).toHaveBeenCalledWith({
        symbol: 'APEXUSDT',
        timeframe: '1',
        limit: 100,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Repository empty'),
      );
    });
  });

  describe('C2: Cache hit -> returns from repository (no API call)', () => {
    it('should return from cache without API call', async () => {
      const { exchange, repository, provider } =
        createStandardContext();
      const mockCandles = [
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      ];

      repository.getCandles.mockReturnValue(mockCandles);

      const result = await provider.getCandles(TimeframeRole.ENTRY);

      expect(result).toEqual(mockCandles);
      expect(exchange.getCandles).not.toHaveBeenCalled();
    });
  });

  describe('C3: API fails after 3 retries -> throws ExchangeAPIError', () => {
    it('should throw after exhausting retries', async () => {
      const { exchange, repository, provider } =
        createStandardContext();

      repository.getCandles.mockReturnValue([]);
      exchange.getCandles.mockRejectedValue(new Error('API error'));

      await expect(provider.getCandles(TimeframeRole.ENTRY)).rejects.toThrow(
        ExchangeAPIError,
      );
      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
    });
  });
});

describe('CandleProvider - onCandleClosed() with SKIP', () => {
  describe('D1: Repository save fails -> logs warning, continues (SKIP)', () => {
    it('should skip repository errors gracefully', () => {
      const { logger, repository, provider } =
        createStandardContext();

      repository.saveCandles.mockImplementation(() => {
        throw new Error('Repository write failed');
      });

      provider.onCandleClosed(TimeframeRole.ENTRY, createCandleProviderMockCandle());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update cache'),
        expect.any(Object),
      );
    });
  });

  describe('D2: Invalid timeframe config -> logs warning, returns early', () => {
    it('should handle invalid timeframe gracefully', () => {
      const { logger, timeframeProvider, repository, provider } =
        createStandardContext();

      timeframeProvider.getTimeframe.mockReturnValue(null);

      provider.onCandleClosed(TimeframeRole.ENTRY, createCandleProviderMockCandle());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timeframe config not found'),
      );
      expect(repository.saveCandles).not.toHaveBeenCalled();
    });
  });
});

describe('CandleProvider - Error Classification', () => {
  describe('E1: ECONNREFUSED -> ExchangeConnectionError with context', () => {
    it('should classify ECONNREFUSED as ExchangeConnectionError', async () => {
      const { exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused'),
      );

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow(ExchangeConnectionError);
    }, 10000);
  });

  describe('E2: 429 status code -> ExchangeRateLimitError with retryAfterMs', () => {
    it('should classify 429 as ExchangeRateLimitError', async () => {
      const { exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(new Error('429: Too Many Requests'));

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow(ExchangeRateLimitError);
    });
  });

  describe('E3: Unknown error -> ExchangeAPIError with generic message', () => {
    it('should classify unknown errors as ExchangeAPIError', async () => {
      const { exchange, provider } = createStandardContext();

      exchange.getCandles.mockRejectedValue(new Error('Unknown API error'));

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow(ExchangeAPIError);
    });
  });
});

describe('CandleProvider - Backward Compatibility', () => {
  describe('F1: Without ErrorHandler -> errors propagate directly (original behavior)', () => {
    it('should propagate errors when no ErrorHandler provided', async () => {
      const { exchange, provider } = createLegacyContext();

      exchange.getCandles.mockRejectedValue(new Error('API error'));

      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100),
      ).rejects.toThrow('API error');

      expect(exchange.getCandles).toHaveBeenCalledTimes(1);
    });
  });

  describe('F2: With ErrorHandler -> uses retry logic (new behavior)', () => {
    it('should use retry logic when ErrorHandler provided', async () => {
      const { exchange, repository, provider } =
        createStandardContext();

      exchange.getCandles
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);

      await provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100);

      expect(exchange.getCandles).toHaveBeenCalledTimes(2);
      expect(repository.saveCandles).toHaveBeenCalled();
    });
  });
});

describe('CandleProvider - E2E Recovery Scenarios', () => {
  describe('G1: Full initialization with mixed failures -> partial success', () => {
    it('should handle mixed success/failure across timeframes', async () => {
      const { logger, exchange, repository, provider } =
        createStandardContext();

      exchange.getCandles.mockImplementation(
        ({ timeframe }: CandleProviderGetCandlesParams) => {
          if (timeframe === '5') {
            return Promise.reject(new Error('timeout'));
          }

          return Promise.resolve([
            { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
          ]);
        },
      );

      await provider.initialize();

      expect(repository.saveCandles).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load PRIMARY'),
        expect.any(Object),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Candle loading complete'),
      );
    });
  });

  describe('G2: Live trading candle update -> handles repository errors gracefully', () => {
    it('should handle candle update errors without disrupting trading', () => {
      const { logger, repository, provider } =
        createStandardContext();

      let callCount = 0;
      repository.saveCandles.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Repository temporarily unavailable');
        }
      });

      provider.onCandleClosed(TimeframeRole.ENTRY, createCandleProviderMockCandle());
      provider.onCandleClosed(TimeframeRole.ENTRY, createCandleProviderMockCandle());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update cache'),
        expect.any(Object),
      );
    });
  });
});

describe('CandleProvider - Integration Tests', () => {
  describe('H1: Real scenario - startup with partial failures', () => {
    it('should start up successfully despite some timeframe load failures', async () => {
      const { logger, exchange, repository, provider } =
        createStandardContext();

      let attempt = 0;
      exchange.getCandles.mockImplementation(
        ({ timeframe }: CandleProviderGetCandlesParams) => {
          attempt++;
          if (timeframe === '1' && attempt === 1) {
            return Promise.reject(new Error('timeout'));
          }

          return Promise.resolve([
            { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
          ]);
        },
      );

      await provider.initialize();

      expect(repository.saveCandles).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Candle loading complete'),
      );
    });
  });

  describe('H2: Cache population after initialization', () => {
    it('should successfully populate cache and retrieve candles', async () => {
      const { exchange, repository, provider } =
        createStandardContext();
      const mockCandles = [
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
        { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
      ];

      exchange.getCandles.mockResolvedValue(mockCandles);
      repository.getCandles.mockReturnValue(mockCandles);

      await provider.initialize();
      const candles = await provider.getCandles(TimeframeRole.ENTRY);

      expect(candles).toEqual(mockCandles);
      expect(repository.saveCandles).toHaveBeenCalled();
      expect(repository.getCandles).toHaveBeenCalled();
    });
  });
});
