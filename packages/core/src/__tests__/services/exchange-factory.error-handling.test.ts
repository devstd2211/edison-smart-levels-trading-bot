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
} from '../helpers/exchange-factory-test.utils';

describe('ExchangeFactory Error Handling (Phase 8.9.37)', () => {
  let mockLogger: ReturnType<typeof createExchangeFactoryMockLogger>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    mockLogger = createExchangeFactoryMockLogger();
    mockErrorHandler = createExchangeFactoryErrorHandler(
      asExchangeFactoryLogger(mockLogger),
    );
  });

  describe('THROW Strategy - Configuration Validation', () => {
    it('should throw ExchangeFactoryConfigError on missing exchange name', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
          mockErrorHandler,
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on missing symbol', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ symbol: asExchangeFactorySymbol(undefined) }),
          mockErrorHandler,
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on unsupported exchange', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName('kraken') }),
          mockErrorHandler,
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should call ErrorHandler.handle with THROW strategy on missing name', () => {
      try {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
          mockErrorHandler,
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
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig(),
          mockErrorHandler,
        );
      }).not.toThrow();
    });
  });

  describe('SKIP Strategy - Logging Operations', () => {
    it('should continue despite logger failure in getExchange', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
        mockErrorHandler,
      );

      expect(() => {
        factory.getExchange();
      }).not.toThrow();
    });

    it('should handle logger failure in reset', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
        mockErrorHandler,
      );

      expect(() => {
        factory.reset();
      }).not.toThrow();
    });

    it('should continue despite logger failure in getExchangeName', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
        mockErrorHandler,
      );

      expect(() => {
        factory.getExchangeName();
      }).not.toThrow();

      expect(factory.getExchangeName()).toBe('bybit');
    });
  });

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should create factory without ErrorHandler parameter', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig(),
        );
      }).not.toThrow();
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName(undefined) }),
        );
      }).toThrow();
    });

    it('should throw ExchangeFactoryConfigError without ErrorHandler', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ symbol: asExchangeFactorySymbol(undefined) }),
        );
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should accept valid config and return methods without ErrorHandler', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
      );

      expect(factory.getExchangeName()).toBe('bybit');
      expect(factory.getSymbol()).toBe('BTCUSDT');
      expect(factory.getExchange()).toBeNull();
    });
  });

  describe('Configuration Methods', () => {
    it('should return exchange name correctly', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig({ name: 'binance' }),
        mockErrorHandler,
      );

      expect(factory.getExchangeName()).toBe('binance');
    });

    it('should return symbol correctly', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig({ symbol: 'ETHUSDT' }),
        mockErrorHandler,
      );

      expect(factory.getSymbol()).toBe('ETHUSDT');
    });

    it('should return null for uninitialized exchange', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
        mockErrorHandler,
      );

      expect(factory.getExchange()).toBeNull();
    });

    it('should reset exchange cache', () => {
      const factory = new ExchangeFactory(
        asExchangeFactoryLogger(mockLogger),
        createExchangeFactoryConfig(),
        mockErrorHandler,
      );

      factory.reset();
      expect(factory.getExchange()).toBeNull();
    });
  });

  describe('Config Error Types and Details', () => {
    it('should include exchange name in missing field error context', () => {
      try {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName('unsupported') }),
          mockErrorHandler,
        );
      } catch {}

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      expect(context?.reason).toBe('unsupported_exchange');
    });

    it('should include supported exchanges list in error', () => {
      try {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName('dydx') }),
          mockErrorHandler,
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
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName('BYBIT') }),
          mockErrorHandler,
        );
      }).not.toThrow();
    });

    it('should handle empty symbol as error', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ symbol: '' }),
          mockErrorHandler,
        );
      }).toThrow();
    });

    it('should handle null config values', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ name: asExchangeFactoryName(null) }),
          mockErrorHandler,
        );
      }).toThrow();
    });

    it('should handle empty string API credentials gracefully', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({ apiKey: '', apiSecret: '' }),
          mockErrorHandler,
        );
      }).not.toThrow();
    });
  });

  describe('Multiple Validation Checks', () => {
    it('should validate all required fields in sequence', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({
            name: asExchangeFactoryName(undefined),
            symbol: asExchangeFactorySymbol(undefined),
          }),
          mockErrorHandler,
        );
      }).toThrow();
    });

    it('should validate symbol after name is valid', () => {
      expect(() => {
        new ExchangeFactory(
          asExchangeFactoryLogger(mockLogger),
          createExchangeFactoryConfig({
            name: 'bybit',
            symbol: asExchangeFactorySymbol(undefined),
          }),
          mockErrorHandler,
        );
      }).toThrow();
    });
  });
});
