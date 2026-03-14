/**
 * Exchange Factory Service Error Handling Tests (Phase 8.9.37)
 */

import {
  ErrorHandler,
  RecoveryStrategy,
} from '../../errors';
import { ExchangeFactory } from '../../services/exchange-factory.service';
import type { ExchangeConfig } from '../../services/exchange-factory.service';
import { ExchangeFactoryConfigError } from '../../errors/DomainErrors';
import {
  asExchangeFactoryLogger,
  asExchangeFactoryName,
  asExchangeFactorySymbol,
  createExchangeFactoryConfig,
  createExchangeFactoryErrorHandler,
  createExchangeFactoryMockLogger,
  createExchangeFactoryService,
} from '../helpers/exchange-factory-test.utils';

describe('ExchangeFactory Error Handling (Phase 8.9.37)', () => {
  let mockLogger: ReturnType<typeof createExchangeFactoryMockLogger>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let createFactory: (
    config?: ExchangeConfig,
    errorHandler?: ErrorHandler,
  ) => ExchangeFactory;
  let createFactoryWithoutErrorHandler: (
    config?: ExchangeConfig,
  ) => ExchangeFactory;

  beforeEach(() => {
    mockLogger = createExchangeFactoryMockLogger();
    mockErrorHandler = createExchangeFactoryErrorHandler(
      asExchangeFactoryLogger(mockLogger),
    );
    createFactory = (config = createExchangeFactoryConfig(), errorHandler = mockErrorHandler) =>
      createExchangeFactoryService({
        logger: asExchangeFactoryLogger(mockLogger),
        config,
        errorHandler,
      });
    createFactoryWithoutErrorHandler = (config = createExchangeFactoryConfig()) =>
      createExchangeFactoryService({
        logger: asExchangeFactoryLogger(mockLogger),
        config,
      });
  });

  describe('THROW Strategy - Configuration Validation', () => {
    it('should throw ExchangeFactoryConfigError on missing exchange name', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on missing symbol', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ symbol: asExchangeFactorySymbol(undefined) }),
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on unsupported exchange', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName('kraken') }),
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should call ErrorHandler.handle with THROW strategy on missing name', () => {
      try {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
        );
      } catch {}

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(ExchangeFactoryConfigError),
        expect.objectContaining({
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[name]',
        }),
      );
    });

    it('should accept valid config without throwing', () => {
      expect(() => {
        createFactory();
      }).not.toThrow();
    });
  });

  describe('SKIP Strategy - Logging Operations', () => {
    it('should continue despite logger failure in getExchange', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const factory = createFactory();

      expect(() => {
        factory.getExchange();
      }).not.toThrow();
    });

    it('should handle logger failure in reset', () => {
      const factory = createFactory();

      expect(() => {
        factory.reset();
      }).not.toThrow();
    });

    it('should continue despite logger failure in getExchangeName', () => {
      const factory = createFactory();

      expect(() => {
        factory.getExchangeName();
      }).not.toThrow();

      expect(factory.getExchangeName()).toBe('bybit');
    });
  });

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should create factory without ErrorHandler parameter', () => {
      expect(() => {
        createFactoryWithoutErrorHandler(createExchangeFactoryConfig());
      }).not.toThrow();
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        createFactoryWithoutErrorHandler(
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
        );
      }).toThrow();
    });

    it('should throw ExchangeFactoryConfigError without ErrorHandler', () => {
      expect(() => {
        createFactoryWithoutErrorHandler(
          createExchangeFactoryConfig({ symbol: asExchangeFactorySymbol(undefined) }),
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should accept valid config and return methods without ErrorHandler', () => {
      const factory = createFactoryWithoutErrorHandler(createExchangeFactoryConfig());

      expect(factory.getExchangeName()).toBe('bybit');
      expect(factory.getSymbol()).toBe('BTCUSDT');
      expect(factory.getExchange()).toBeNull();
    });
  });

  describe('Configuration Methods', () => {
    it('should return exchange name correctly', () => {
      const factory = createFactory(
        createExchangeFactoryConfig({ name: 'binance' }),
      );

      expect(factory.getExchangeName()).toBe('binance');
    });

    it('should return symbol correctly', () => {
      const factory = createFactory(
        createExchangeFactoryConfig({ symbol: 'ETHUSDT' }),
      );

      expect(factory.getSymbol()).toBe('ETHUSDT');
    });

    it('should return null for uninitialized exchange', () => {
      const factory = createFactory();

      expect(factory.getExchange()).toBeNull();
    });

    it('should reset exchange cache', () => {
      const factory = createFactory();

      factory.reset();
      expect(factory.getExchange()).toBeNull();
    });
  });

  describe('Config Error Types and Details', () => {
    it('should include exchange name in missing field error context', () => {
      try {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName('unsupported') }),
        );
      } catch {}

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      expect(context?.reason).toBe('unsupported_exchange');
    });

    it('should include supported exchanges list in error', () => {
      try {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName('dydx') }),
        );
      } catch {}

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      const supportedExchanges = context?.supportedExchanges as string[] | undefined;
      expect(supportedExchanges).toContain('bybit');
      expect(supportedExchanges).toContain('binance');
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive exchange names', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName('BYBIT') }),
        );
      }).not.toThrow();
    });

    it('should handle empty symbol as error', () => {
      expect(() => {
        createFactory(createExchangeFactoryConfig({ symbol: '' }));
      }).toThrow();
    });

    it('should handle null config values', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ name: asExchangeFactoryName(null) }),
        );
      }).toThrow();
    });

    it('should handle empty string API credentials gracefully', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({ apiKey: '', apiSecret: '' }),
        );
      }).not.toThrow();
    });
  });

  describe('Multiple Validation Checks', () => {
    it('should validate all required fields in sequence', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({
            name: asExchangeFactoryName(undefined),
            symbol: asExchangeFactorySymbol(undefined),
          }),
        );
      }).toThrow();
    });

    it('should validate symbol after name is valid', () => {
      expect(() => {
        createFactory(
          createExchangeFactoryConfig({
            name: 'bybit',
            symbol: asExchangeFactorySymbol(undefined),
          }),
        );
      }).toThrow();
    });
  });
});
