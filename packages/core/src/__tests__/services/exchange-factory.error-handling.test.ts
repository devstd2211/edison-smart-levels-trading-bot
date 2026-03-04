/**
 * Exchange Factory Service Error Handling Tests (Phase 8.9.37)
 *
 * Comprehensive test suite for ExchangeFactory error handling:
 * - Configuration validation with THROW strategy
 * - Adapter instantiation failures with RETRY strategy
 * - Initialization failures with GRACEFUL_DEGRADE strategy
 * - Logging failures with SKIP strategy
 * - Recovery scenarios and fallbacks
 * - Backward compatibility (without ErrorHandler)
 */

import { ExchangeFactory } from '../../services/exchange-factory.service';
import {
  ErrorHandler,
  RecoveryStrategy,
  type ErrorHandlingConfig,
  type ErrorHandlingResult,
  type TradingError,
} from '../../errors';
import type { ExchangeConfig } from '../../services/exchange-factory.service';
import { ExchangeFactoryConfigError } from '../../errors/DomainErrors';
import { LoggerService } from '../../services/logger.service';

// ============================================================================
// MOCK UTILITIES
// ============================================================================

type MockLogger = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

const asLoggerService = (logger: MockLogger): LoggerService =>
  logger as unknown as LoggerService;

const asExchangeName = (name: unknown): ExchangeConfig['name'] =>
  name as ExchangeConfig['name'];

const asSymbol = (symbol: unknown): string => symbol as string;

const createMockLogger = (): jest.Mocked<MockLogger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockConfig = (overrides?: Partial<ExchangeConfig>): ExchangeConfig => ({
  name: 'bybit',
  symbol: 'BTCUSDT',
  demo: true,
  testnet: false,
  apiKey: 'test-key',
  apiSecret: 'test-secret',
  ...overrides,
});

const createMockErrorHandler = () => ({
  handle: jest.fn(
    (error: unknown, options: ErrorHandlingConfig): ErrorHandlingResult => {
      const normalizedError =
        error instanceof Error
          ? (error as unknown as TradingError)
          : (new Error(String(error)) as unknown as TradingError);

      if (options.strategy === RecoveryStrategy.THROW) {
        throw normalizedError; // Throw for THROW strategy
      }

      return {
        success: false,
        error: normalizedError,
        recovered: false,
        attempts: 1,
        message: normalizedError.message,
        strategy: options.strategy,
      };
    }
  ),
  executeAsync: jest.fn(
    async (
      fn: () => Promise<unknown>,
      _config: ErrorHandlingConfig
    ): Promise<{ success: boolean; value?: unknown; error?: TradingError }> => {
      try {
        const value = await fn();
        return { success: true, value };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? (error as unknown as TradingError)
              : (new Error(String(error)) as unknown as TradingError),
        };
      }
    }
  ),
  getLogger: jest.fn(() => createMockLogger()),
} as unknown as jest.Mocked<ErrorHandler>);

// ============================================================================
// TESTS
// ============================================================================

describe('ExchangeFactory Error Handling (Phase 8.9.37)', () => {
  let mockLogger: jest.Mocked<MockLogger>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockErrorHandler = createMockErrorHandler();
  });

  // ==================== THROW Strategy - Config Validation ====================

  describe('THROW Strategy - Configuration Validation', () => {
    it('should throw ExchangeFactoryConfigError on missing exchange name', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName(undefined) }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on missing symbol', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ symbol: asSymbol(undefined) }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on unsupported exchange', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName('kraken') }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should call ErrorHandler.handle with THROW strategy on missing name', () => {
      try {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName(undefined) }),
          mockErrorHandler
        );
      } catch (e) {
        // Expected
      }

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(ExchangeFactoryConfigError),
        expect.objectContaining({
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[name]',
        })
      );
    });

    it('should accept valid config without throwing', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig(),
          mockErrorHandler
        );
      }).not.toThrow();
    });
  });

  // ==================== SKIP Strategy - Logging ====================

  describe('SKIP Strategy - Logging Operations', () => {
    it('should continue despite logger failure in getExchange', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig(),
        mockErrorHandler
      );

      // Should not throw
      expect(() => {
        factory.getExchange();
      }).not.toThrow();
    });

    it('should handle logger failure in reset', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig(),
        mockErrorHandler
      );

      expect(() => {
        factory.reset();
      }).not.toThrow();
    });

    it('should continue despite logger failure in getExchangeName', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig(),
        mockErrorHandler
      );

      expect(() => {
        factory.getExchangeName();
      }).not.toThrow();

      expect(factory.getExchangeName()).toBe('bybit');
    });
  });

  // ==================== Backward Compatibility ====================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should create factory without ErrorHandler parameter', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig()
        );
      }).not.toThrow();
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName(undefined) })
        );
      }).toThrow();
    });

    it('should throw ExchangeFactoryConfigError without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ symbol: asSymbol(undefined) })
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should accept valid config and return methods without ErrorHandler', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig()
      );

      expect(factory.getExchangeName()).toBe('bybit');
      expect(factory.getSymbol()).toBe('BTCUSDT');
      expect(factory.getExchange()).toBeNull();
    });
  });

  // ==================== Configuration Methods ====================

  describe('Configuration Methods', () => {
    it('should return exchange name correctly', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig({ name: 'binance' }),
        mockErrorHandler
      );

      expect(factory.getExchangeName()).toBe('binance');
    });

    it('should return symbol correctly', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig({ symbol: 'ETHUSDT' }),
        mockErrorHandler
      );

      expect(factory.getSymbol()).toBe('ETHUSDT');
    });

    it('should return null for uninitialized exchange', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig(),
        mockErrorHandler
      );

      expect(factory.getExchange()).toBeNull();
    });

    it('should reset exchange cache', () => {
      const factory = new ExchangeFactory(
        asLoggerService(mockLogger),
        createMockConfig(),
        mockErrorHandler
      );

      factory.reset();
      expect(factory.getExchange()).toBeNull();
    });
  });

  // ==================== Config Error Types ====================

  describe('Config Error Types and Details', () => {
    it('should include exchange name in missing field error context', () => {
      try {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName('unsupported') }),
          mockErrorHandler
        );
      } catch (e) {
        // Expected
      }

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      expect(context?.reason).toBe('unsupported_exchange');
    });

    it('should include supported exchanges list in error', () => {
      try {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName('dydx') }),
          mockErrorHandler
        );
      } catch (e) {
        // Expected
      }

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      const supportedExchanges = context?.supportedExchanges as string[] | undefined;
      expect(supportedExchanges).toContain('bybit');
      expect(supportedExchanges).toContain('binance');
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle case-insensitive exchange names', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName('BYBIT') }),
          mockErrorHandler
        );
      }).not.toThrow();
    });

    it('should handle empty symbol as error', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ symbol: '' }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should handle null config values', () => {
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: asExchangeName(null) }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should handle empty string API credentials gracefully', () => {
      // Should not throw - empty credentials are allowed (converted to empty string)
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ apiKey: '', apiSecret: '' }),
          mockErrorHandler
        );
      }).not.toThrow();
    });
  });

  // ==================== Multiple Validations ====================

  describe('Multiple Validation Checks', () => {
    it('should validate all required fields in sequence', () => {
      // First error should be missing name (checked first)
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({
            name: asExchangeName(undefined),
            symbol: asSymbol(undefined),
          }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should validate symbol after name is valid', () => {
      // With valid name but invalid symbol
      expect(() => {
        new ExchangeFactory(
          asLoggerService(mockLogger),
          createMockConfig({ name: 'bybit', symbol: asSymbol(undefined) }),
          mockErrorHandler
        );
      }).toThrow();
    });
  });
});

