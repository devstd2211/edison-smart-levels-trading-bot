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
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  ExchangeConnectionError,
  ExchangeRateLimitError,
  ExchangeAPIError,
} from '../../errors/DomainErrors';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import { TimeframeRole } from '../../types/enums';

// ============================================================================
// MOCK SETUP
// ============================================================================

const createMockLogger = (): any => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

const createMockTimeframeProvider = (): any => ({
  getAllTimeframes: jest.fn().mockReturnValue(
    new Map([
      [TimeframeRole.ENTRY, { interval: '1', candleLimit: 100, enabled: true }],
      [TimeframeRole.PRIMARY, { interval: '5', candleLimit: 100, enabled: true }],
      [TimeframeRole.TREND1, { interval: '15', candleLimit: 100, enabled: true }],
    ])
  ),
  getTimeframe: jest.fn((role: TimeframeRole) => {
    const timeframes: Record<TimeframeRole, any> = {
      [TimeframeRole.ENTRY]: { interval: '1', candleLimit: 100, enabled: true },
      [TimeframeRole.PRIMARY]: { interval: '5', candleLimit: 100, enabled: true },
      [TimeframeRole.TREND1]: { interval: '15', candleLimit: 100, enabled: true },
      [TimeframeRole.TREND2]: { interval: '60', candleLimit: 100, enabled: false },
      [TimeframeRole.CONTEXT]: { interval: '240', candleLimit: 100, enabled: false },
    };
    return timeframes[role] || null;
  }),
});

const createMockExchange = (): any => ({
  getCandles: jest.fn().mockResolvedValue([
    { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
    { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
  ]),
});

const createMockRepository = (): any => ({
  saveCandles: jest.fn(),
  getCandles: jest.fn().mockReturnValue([
    { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
    { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
  ]),
  clear: jest.fn(),
  getStats: jest.fn().mockReturnValue({ capacity: 1000 }),
});

const createMockCandle = (role: string) => ({
  timestamp: Date.now(),
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 500,
});

// ============================================================================
// SECTION A: loadTimeframeCandles() - RETRY Strategy (3 tests)
// ============================================================================

describe('CandleProvider - RETRY Strategy', () => {
  describe('A1: Network error → retries 3x → throws ExchangeConnectionError', () => {
    it('should retry 3 times on ECONNREFUSED and throw ExchangeConnectionError', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Mock network error
      const networkError = new Error('ECONNREFUSED: Connection refused');
      exchange.getCandles.mockRejectedValue(networkError);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow(ExchangeConnectionError);

      // Verify retry attempts (3 total)
      expect(exchange.getCandles).toHaveBeenCalledTimes(3);

      // Verify retry warnings in logs
      const warnCalls = logger.warn.mock.calls.filter((call: any[]) =>
        call[0]?.includes?.('Retrying')
      );
      expect(warnCalls.length).toBeGreaterThan(0);
    });
  });

  describe('A2: Rate limit error → retries with backoff → throws ExchangeRateLimitError', () => {
    it('should retry on 429 rate limit error and throw ExchangeRateLimitError', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Mock rate limit error
      const rateLimitError = new Error('429: Rate limit exceeded');
      exchange.getCandles.mockRejectedValue(rateLimitError);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow(ExchangeRateLimitError);

      // Verify retry attempts
      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
    });
  });

  describe('A3: Successful load after 2 retries → stores in repository', () => {
    it('should retry and succeed on the second attempt', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Fail first attempt, succeed second
      exchange.getCandles
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100);

      // Assert
      expect(exchange.getCandles).toHaveBeenCalledTimes(2);
      expect(repository.saveCandles).toHaveBeenCalledWith('APEXUSDT', '1', [
        expect.any(Object),
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Loaded')
      );
    });
  });
});

// ============================================================================
// SECTION B: initialize() - SKIP Strategy (3 tests)
// ============================================================================

describe('CandleProvider - SKIP Strategy for initialize()', () => {
  describe('B1: One timeframe fails → skips it, loads others successfully', () => {
    it('should skip failed timeframe and load others', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Fail for 'primary' timeframe only
      exchange.getCandles.mockImplementation(({ timeframe }: any) => {
        if (timeframe === '5') {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);
      });

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();

      // Assert - should complete without throwing
      expect(exchange.getCandles).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load PRIMARY'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Candle loading complete')
      );
    });
  });

  describe('B2: All timeframes fail → logs warnings, completes without throwing', () => {
    it('should handle all timeframes failing gracefully', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Fail all requests
      exchange.getCandles.mockRejectedValue(new Error('network error'));

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();

      // Assert - should complete without throwing
      expect(logger.warn.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Candle loading complete')
      );
    });
  });

  describe('B3: All timeframes succeed → loads all into repository', () => {
    it('should load all timeframes successfully', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();

      // Assert
      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
      expect(repository.saveCandles).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Candle loading complete')
      );
    });
  });
});

// ============================================================================
// SECTION C: getCandles() - Cache Miss with RETRY (3 tests)
// ============================================================================

describe('CandleProvider - Cache Miss Recovery with RETRY', () => {
  describe('C1: Cache empty → loads from API with RETRY → returns candles', () => {
    it('should load from API when cache is empty', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // First call returns empty (cache miss), second returns candles
      repository.getCandles.mockReturnValueOnce([]).mockReturnValueOnce([
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
      ]);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      const result = await provider.getCandles(TimeframeRole.ENTRY);

      // Assert
      expect(result).toHaveLength(2);
      expect(exchange.getCandles).toHaveBeenCalledWith({
        symbol: 'APEXUSDT',
        timeframe: '1',
        limit: 100,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Repository empty')
      );
    });
  });

  describe('C2: Cache hit → returns from repository (no API call)', () => {
    it('should return from cache without API call', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      const mockCandles = [
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      ];
      repository.getCandles.mockReturnValue(mockCandles);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      const result = await provider.getCandles(TimeframeRole.ENTRY);

      // Assert
      expect(result).toEqual(mockCandles);
      expect(exchange.getCandles).not.toHaveBeenCalled();
    });
  });

  describe('C3: API fails after 3 retries → throws ExchangeAPIError', () => {
    it('should throw after exhausting retries', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Cache empty, API fails
      repository.getCandles.mockReturnValue([]);
      exchange.getCandles.mockRejectedValue(new Error('API error'));

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(provider.getCandles(TimeframeRole.ENTRY)).rejects.toThrow(ExchangeAPIError);
      expect(exchange.getCandles).toHaveBeenCalledTimes(3);
    });
  });
});

// ============================================================================
// SECTION D: onCandleClosed() - Non-Critical SKIP (2 tests)
// ============================================================================

describe('CandleProvider - onCandleClosed() with SKIP', () => {
  describe('D1: Repository save fails → logs warning, continues (SKIP)', () => {
    it('should skip repository errors gracefully', () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Mock repository error
      repository.saveCandles.mockImplementation(() => {
        throw new Error('Repository write failed');
      });

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act - should not throw
      const candle = createMockCandle('ENTRY');
      provider.onCandleClosed(TimeframeRole.ENTRY, candle);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update cache'),
        expect.any(Object)
      );
    });
  });

  describe('D2: Invalid timeframe config → logs warning, returns early', () => {
    it('should handle invalid timeframe gracefully', () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Mock invalid timeframe
      timeframeProvider.getTimeframe.mockReturnValue(null);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act - should not throw
      const candle = createMockCandle('invalid');
      provider.onCandleClosed(TimeframeRole.ENTRY, candle);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timeframe config not found'),
      );
      expect(repository.saveCandles).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SECTION E: Error Classification (3 tests)
// ============================================================================

describe('CandleProvider - Error Classification', () => {
  describe('E1: ECONNREFUSED → ExchangeConnectionError with context', () => {
    it('should classify ECONNREFUSED as ExchangeConnectionError', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      exchange.getCandles.mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow(ExchangeConnectionError);
    }, 10000);
  });

  describe('E2: 429 status code → ExchangeRateLimitError with retryAfterMs', () => {
    it('should classify 429 as ExchangeRateLimitError', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      exchange.getCandles.mockRejectedValue(new Error('429: Too Many Requests'));

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow(ExchangeRateLimitError);
    });
  });

  describe('E3: Unknown error → ExchangeAPIError with generic message', () => {
    it('should classify unknown errors as ExchangeAPIError', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      exchange.getCandles.mockRejectedValue(new Error('Unknown API error'));

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act & Assert
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow(ExchangeAPIError);
    });
  });
});

// ============================================================================
// SECTION F: Backward Compatibility (2 tests)
// ============================================================================

describe('CandleProvider - Backward Compatibility', () => {
  describe('F1: Without ErrorHandler → errors propagate directly (original behavior)', () => {
    it('should propagate errors when no ErrorHandler provided', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();

      const error = new Error('API error');
      exchange.getCandles.mockRejectedValue(error);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        // No errorHandler provided
      );

      // Act & Assert - should throw original error
      await expect(
        provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100)
      ).rejects.toThrow('API error');

      // Verify no retries (single attempt)
      expect(exchange.getCandles).toHaveBeenCalledTimes(1);
    });
  });

  describe('F2: With ErrorHandler → uses retry logic (new behavior)', () => {
    it('should use retry logic when ErrorHandler provided', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      exchange.getCandles
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider['loadTimeframeCandles'](TimeframeRole.ENTRY, '1', 100);

      // Assert - should retry
      expect(exchange.getCandles).toHaveBeenCalledTimes(2);
      expect(repository.saveCandles).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SECTION G: E2E Recovery Scenarios (2 tests)
// ============================================================================

describe('CandleProvider - E2E Recovery Scenarios', () => {
  describe('G1: Full initialization with mixed failures → partial success', () => {
    it('should handle mixed success/failure across timeframes', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // ENTRY succeeds, PRIMARY fails, TREND1 succeeds
      exchange.getCandles.mockImplementation(({ timeframe }: any) => {
        if (timeframe === '5') {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);
      });

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();

      // Assert
      expect(repository.saveCandles).toHaveBeenCalledTimes(2); // 2 successes
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load PRIMARY'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Candle loading complete')
      );
    });
  });

  describe('G2: Live trading candle update → handles repository errors gracefully', () => {
    it('should handle candle update errors without disrupting trading', () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      // Fail on second save
      let callCount = 0;
      repository.saveCandles.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Repository temporarily unavailable');
        }
      });

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act - simulate live candle updates
      const candle1 = createMockCandle('ENTRY');
      const candle2 = createMockCandle('ENTRY');

      provider.onCandleClosed(TimeframeRole.ENTRY, candle1); // Should succeed
      provider.onCandleClosed(TimeframeRole.ENTRY, candle2); // Should fail gracefully

      // Assert - both operations complete
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update cache'),
        expect.any(Object)
      );
    });
  });
});

// ============================================================================
// SECTION H: Integration Tests (2 tests)
// ============================================================================

describe('CandleProvider - Integration Tests', () => {
  describe('H1: Real scenario - startup with partial failures', () => {
    it('should start up successfully despite some timeframe load failures', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      let attempt = 0;
      exchange.getCandles.mockImplementation(({ timeframe }: any) => {
        attempt++;
        // Simulate intermittent failure
        if (timeframe === '1' && attempt === 1) {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve([
          { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        ]);
      });

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();

      // Assert
      expect(repository.saveCandles).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Candle loading complete')
      );
    });
  });

  describe('H2: Cache population after initialization', () => {
    it('should successfully populate cache and retrieve candles', async () => {
      const logger = createMockLogger();
      const timeframeProvider = createMockTimeframeProvider();
      const exchange = createMockExchange();
      const repository = createMockRepository();
      const errorHandler = new ErrorHandler(logger);

      const mockCandles = [
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
        { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
      ];

      exchange.getCandles.mockResolvedValue(mockCandles);
      repository.getCandles.mockReturnValue(mockCandles);

      const provider = new CandleProvider(
        timeframeProvider,
        exchange,
        logger,
        'APEXUSDT',
        repository,
        errorHandler,
      );

      // Act
      await provider.initialize();
      const candles = await provider.getCandles(TimeframeRole.ENTRY);

      // Assert
      expect(candles).toEqual(mockCandles);
      expect(repository.saveCandles).toHaveBeenCalled();
      expect(repository.getCandles).toHaveBeenCalled();
    });
  });
});
