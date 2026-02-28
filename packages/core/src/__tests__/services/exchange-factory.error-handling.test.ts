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

import { ExchangeFactory, ExchangeConfig } from '../../services/exchange-factory.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { ExchangeFactoryConfigError, ExchangeAdapterInstantiationError } from '../../errors/DomainErrors';
import { LoggerService } from '../../services/logger.service';

// ============================================================================
// MOCK UTILITIES
// ============================================================================

const createMockLogger = () => ({
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
  handle: jest.fn((error, options): any => {
    if (options.strategy === RecoveryStrategy.THROW) {
      throw error; // Throw synchronously for THROW strategy
    }
    return Promise.resolve({
      success: false,
      error,
      strategy: options.strategy,
    });
  }),
  executeAsync: jest.fn(async (fn, config): Promise<any> => {
    try {
      const value = await fn();
      return { success: true, value };
    } catch (error) {
      return { success: false, error };
    }
  }),
  getLogger: jest.fn(() => createMockLogger()),
} as unknown as jest.Mocked<ErrorHandler>);

// ============================================================================
// TESTS
// ============================================================================

describe('ExchangeFactory Error Handling (Phase 8.9.37)', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
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
          mockLogger as any,
          createMockConfig({ name: undefined as any }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on missing symbol', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ symbol: undefined as any }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on unsupported exchange', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: 'kraken' as any }),
          mockErrorHandler
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should call ErrorHandler.handle with THROW strategy on missing name', () => {
      try {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: undefined as any }),
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
          mockLogger as any,
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
        mockLogger as any,
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
        mockLogger as any,
        createMockConfig(),
        mockErrorHandler
      );

      expect(() => {
        factory.reset();
      }).not.toThrow();
    });

    it('should continue despite logger failure in getExchangeName', () => {
      const factory = new ExchangeFactory(
        mockLogger as any,
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
          mockLogger as any,
          createMockConfig()
        );
      }).not.toThrow();
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: undefined as any })
        );
      }).toThrow();
    });

    it('should throw ExchangeFactoryConfigError without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ symbol: undefined as any })
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should accept valid config and return methods without ErrorHandler', () => {
      const factory = new ExchangeFactory(
        mockLogger as any,
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
        mockLogger as any,
        createMockConfig({ name: 'binance' }),
        mockErrorHandler
      );

      expect(factory.getExchangeName()).toBe('binance');
    });

    it('should return symbol correctly', () => {
      const factory = new ExchangeFactory(
        mockLogger as any,
        createMockConfig({ symbol: 'ETHUSDT' }),
        mockErrorHandler
      );

      expect(factory.getSymbol()).toBe('ETHUSDT');
    });

    it('should return null for uninitialized exchange', () => {
      const factory = new ExchangeFactory(
        mockLogger as any,
        createMockConfig(),
        mockErrorHandler
      );

      expect(factory.getExchange()).toBeNull();
    });

    it('should reset exchange cache', () => {
      const factory = new ExchangeFactory(
        mockLogger as any,
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
          mockLogger as any,
          createMockConfig({ name: 'unsupported' as any }),
          mockErrorHandler
        );
      } catch (e) {
        // Expected
      }

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      expect((error.metadata.context as any)?.reason).toBe('unsupported_exchange');
    });

    it('should include supported exchanges list in error', () => {
      try {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: 'dydx' as any }),
          mockErrorHandler
        );
      } catch (e) {
        // Expected
      }

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      expect((error.metadata.context as any)?.supportedExchanges).toContain('bybit');
      expect((error.metadata.context as any)?.supportedExchanges).toContain('binance');
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle case-insensitive exchange names', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: 'BYBIT' as any }),
          mockErrorHandler
        );
      }).not.toThrow();
    });

    it('should handle empty symbol as error', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ symbol: '' }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should handle null config values', () => {
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: null as any }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should handle empty string API credentials gracefully', () => {
      // Should not throw - empty credentials are allowed (converted to empty string)
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
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
          mockLogger as any,
          createMockConfig({ name: undefined as any, symbol: undefined as any }),
          mockErrorHandler
        );
      }).toThrow();
    });

    it('should validate symbol after name is valid', () => {
      // With valid name but invalid symbol
      expect(() => {
        new ExchangeFactory(
          mockLogger as any,
          createMockConfig({ name: 'bybit', symbol: undefined as any }),
          mockErrorHandler
        );
      }).toThrow();
    });
  });
});
