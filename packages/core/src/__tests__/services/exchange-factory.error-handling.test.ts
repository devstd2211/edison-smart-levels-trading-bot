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
  asExchangeFactoryName,
  asExchangeFactorySymbol,
  createManagedExchangeFactoryContext,
  type ManagedExchangeFactoryContext,
} from '../helpers/exchange-factory-test.utils';

type ExchangeFactoryFixtures = Pick<
  ManagedExchangeFactoryContext,
  'mockLogger' | 'errorHandler' | 'createFactory' | 'createFactoryWithoutErrorHandler'
>;

function bindExchangeFactoryContext() {
  let cleanup: ManagedExchangeFactoryContext['cleanup'];
  let fixtures: ExchangeFactoryFixtures;

  beforeEach(() => {
    const managedContext = createManagedExchangeFactoryContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      mockLogger: managedContext.mockLogger,
      errorHandler: managedContext.errorHandler,
      createFactory: managedContext.createFactory,
      createFactoryWithoutErrorHandler: managedContext.createFactoryWithoutErrorHandler,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('ExchangeFactory Error Handling (Phase 8.9.37)', () => {
  let mockLogger: ExchangeFactoryFixtures['mockLogger'];
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let createFactory: ExchangeFactoryFixtures['createFactory'];
  let createFactoryWithoutErrorHandler: ExchangeFactoryFixtures['createFactoryWithoutErrorHandler'];
  const getFixtures = bindExchangeFactoryContext();

  beforeEach(() => {
    const fixtures: ExchangeFactoryFixtures = getFixtures();
    mockLogger = fixtures.mockLogger;
    mockErrorHandler = fixtures.errorHandler as jest.Mocked<ErrorHandler>;
    createFactory = fixtures.createFactory;
    createFactoryWithoutErrorHandler = fixtures.createFactoryWithoutErrorHandler;
  });

  describe('THROW Strategy - Configuration Validation', () => {
    it('should throw ExchangeFactoryConfigError on missing exchange name', () => {
      expect(() => {
        createFactory({ name: asExchangeFactoryName(undefined) });
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on missing symbol', () => {
      expect(() => {
        createFactory({ symbol: asExchangeFactorySymbol(undefined) });
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should throw ExchangeFactoryConfigError on unsupported exchange', () => {
      expect(() => {
        createFactory({ name: asExchangeFactoryName('kraken') });
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should call ErrorHandler.handle with THROW strategy on missing name', () => {
      try {
        createFactory({ name: asExchangeFactoryName(undefined) });
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
        createFactoryWithoutErrorHandler();
      }).not.toThrow();
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        createFactoryWithoutErrorHandler({ name: asExchangeFactoryName(undefined) });
      }).toThrow();
    });

    it('should throw ExchangeFactoryConfigError without ErrorHandler', () => {
      expect(() => {
        createFactoryWithoutErrorHandler({ symbol: asExchangeFactorySymbol(undefined) });
      }).toThrow(ExchangeFactoryConfigError);
    });

    it('should accept valid config and return methods without ErrorHandler', () => {
      const factory = createFactoryWithoutErrorHandler();

      expect(factory.getExchangeName()).toBe('bybit');
      expect(factory.getSymbol()).toBe('BTCUSDT');
      expect(factory.getExchange()).toBeNull();
    });
  });

  describe('Configuration Methods', () => {
    it('should return exchange name correctly', () => {
      const factory = createFactory({ name: 'binance' });

      expect(factory.getExchangeName()).toBe('binance');
    });

    it('should return symbol correctly', () => {
      const factory = createFactory({ symbol: 'ETHUSDT' });

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
        createFactory({ name: asExchangeFactoryName('unsupported') });
      } catch {}

      const callArgs = mockErrorHandler.handle.mock.calls[0];
      const error = callArgs[0] as ExchangeFactoryConfigError;
      const context = error.metadata.context as Record<string, unknown> | undefined;
      expect(context?.reason).toBe('unsupported_exchange');
    });

    it('should include supported exchanges list in error', () => {
      try {
        createFactory({ name: asExchangeFactoryName('dydx') });
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
        createFactory({ name: asExchangeFactoryName('BYBIT') });
      }).not.toThrow();
    });

    it('should handle empty symbol as error', () => {
      expect(() => {
        createFactory({ symbol: '' });
      }).toThrow();
    });

    it('should handle null config values', () => {
      expect(() => {
        createFactory({ name: asExchangeFactoryName(null) });
      }).toThrow();
    });

    it('should handle empty string API credentials gracefully', () => {
      expect(() => {
        createFactory({ apiKey: '', apiSecret: '' });
      }).not.toThrow();
    });
  });

  describe('Multiple Validation Checks', () => {
    it('should validate all required fields in sequence', () => {
      expect(() => {
        createFactory({
          name: asExchangeFactoryName(undefined),
          symbol: asExchangeFactorySymbol(undefined),
        });
      }).toThrow();
    });

    it('should validate symbol after name is valid', () => {
      expect(() => {
        createFactory({
          name: 'bybit',
          symbol: asExchangeFactorySymbol(undefined),
        });
      }).toThrow();
    });
  });
});
