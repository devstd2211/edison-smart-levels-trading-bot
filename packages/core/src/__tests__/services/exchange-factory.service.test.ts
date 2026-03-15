/**
 * ExchangeFactory Tests
 * Testing exchange factory instantiation, configuration, and caching
 */

import { BinanceServiceAdapter } from '../../services/binance/binance-service.adapter';
import { BybitServiceAdapter } from '../../services/bybit/bybit-service.adapter';
import { ExchangeFactory } from '../../services/exchange-factory.service';
import {
  asExchangeFactoryName,
  asExchangeFactorySymbol,
  createExchangeFactoryConfig,
  createExchangeFactoryHarness,
  createExchangeFactoryService,
} from '../helpers/exchange-factory-test.utils';

describe('ExchangeFactory Service', () => {
  let createFactory: (overrides?: Partial<Parameters<typeof createExchangeFactoryConfig>[0]>) => ExchangeFactory;

  beforeEach(() => {
    const harness = createExchangeFactoryHarness();
    createFactory = (overrides = {}) =>
      createExchangeFactoryService({
        logger: harness.logger,
        config: createExchangeFactoryConfig(overrides),
        errorHandler: harness.errorHandler,
      });
  });

  describe('Factory Initialization', () => {
    it('should initialize factory with valid Bybit config', () => {
      const factory = createFactory({
        name: 'bybit',
        symbol: 'XRPUSDT',
        demo: true,
        testnet: false,
      });

      expect(factory.getExchangeName()).toEqual('bybit');
      expect(factory.getSymbol()).toEqual('XRPUSDT');
    });

    it('should initialize factory with valid Binance config', () => {
      const factory = createFactory({
        name: 'binance',
        symbol: 'BTCUSDT',
        demo: true,
        testnet: false,
      });

      expect(factory.getExchangeName()).toEqual('binance');
      expect(factory.getSymbol()).toEqual('BTCUSDT');
    });

    it('should reject missing exchange name', () => {
      expect(() => {
        createFactory({
          name: asExchangeFactoryName(undefined),
        });
      }).toThrow();
    });

    it('should reject missing symbol', () => {
      expect(() => {
        createFactory({
          symbol: asExchangeFactorySymbol(undefined),
        });
      }).toThrow();
    });

    it('should reject unsupported exchange', () => {
      expect(() => {
        createFactory({
          name: asExchangeFactoryName('kraken'),
        });
      }).toThrow();
    });

    it('should accept case-insensitive exchange names in config validation', () => {
      const factory = createFactory({
        name: 'BYBIT' as unknown as 'bybit' | 'binance',
        symbol: 'XRPUSDT',
      });
      expect(factory).toBeDefined();
    });
  });

  describe('Bybit Exchange Creation', () => {
    it('should create Bybit adapter', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT', demo: true });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
      expect(exchange.name).toEqual('Bybit');
    });

    it('should return BybitServiceAdapter instance', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      const exchange = await factory.createExchange();
      expect(exchange instanceof BybitServiceAdapter).toBe(true);
    });

    it('should handle all Bybit config parameters', async () => {
      const factory = createFactory({
        name: 'bybit',
        symbol: 'ETHUSDT',
        demo: false,
        testnet: true,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
      expect(exchange.name).toEqual('Bybit');
    });

    it('should use default values for optional Bybit params', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
    });
  });

  describe('Binance Exchange Creation', () => {
    it('should create Binance adapter', async () => {
      const factory = createFactory({ name: 'binance', symbol: 'BTCUSDT', demo: true });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
      expect(exchange.name).toEqual('Binance');
    });

    it('should return BinanceServiceAdapter instance', async () => {
      const factory = createFactory({ name: 'binance', symbol: 'BTCUSDT' });

      const exchange = await factory.createExchange();
      expect(exchange instanceof BinanceServiceAdapter).toBe(true);
    });

    it('should handle all Binance config parameters', async () => {
      const factory = createFactory({
        name: 'binance',
        symbol: 'ETHUSDT',
        demo: false,
        testnet: true,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
      expect(exchange.name).toEqual('Binance');
    });

    it('should use default values for optional Binance params', async () => {
      const factory = createFactory({ name: 'binance', symbol: 'BTCUSDT' });

      const exchange = await factory.createExchange();
      expect(exchange).toBeDefined();
    });
  });

  describe('Exchange Caching', () => {
    it('should return same instance on cached calls', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT', demo: true });

      const exchange1 = await factory.createExchange();
      const exchange2 = await factory.createExchange();

      expect(exchange1).toBe(exchange2);
    });

    it('should retrieve cached exchange with getExchange()', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      const exchange = await factory.createExchange();
      const cached = factory.getExchange();

      expect(cached).toBe(exchange);
    });

    it('should return null when exchange not initialized', () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      expect(factory.getExchange()).toBeNull();
    });

    it('should clear cache on reset', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      const exchange1 = await factory.createExchange();
      factory.reset();

      expect(factory.getExchange()).toBeNull();

      const exchange2 = await factory.createExchange();
      expect(exchange1).not.toBe(exchange2);
    });
  });

  describe('Symbol Handling', () => {
    it('should handle trading pairs for Bybit', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT', demo: true });

      const exchange = await factory.createExchange();
      expect(typeof exchange.getSymbol).toBe('function');
    });

    it('should handle trading pairs for Binance', async () => {
      const factory = createFactory({ name: 'binance', symbol: 'BTCUSDT', demo: true });

      const exchange = await factory.createExchange();
      expect(typeof exchange.getSymbol).toBe('function');
    });
  });

  describe('IExchange Interface Compliance', () => {
    it('should implement full IExchange interface for Bybit', async () => {
      const factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      const exchange = await factory.createExchange();

      expect(typeof exchange.initialize).toBe('function');
      expect(typeof exchange.connect).toBe('function');
      expect(typeof exchange.disconnect).toBe('function');
      expect(typeof exchange.getCandles).toBe('function');
      expect(typeof exchange.getLatestPrice).toBe('function');
      expect(typeof exchange.openPosition).toBe('function');
      expect(typeof exchange.closePosition).toBe('function');
      expect(exchange.name).toBeDefined();
    });

    it('should implement full IExchange interface for Binance', async () => {
      const factory = createFactory({ name: 'binance', symbol: 'BTCUSDT' });

      const exchange = await factory.createExchange();

      expect(typeof exchange.initialize).toBe('function');
      expect(typeof exchange.connect).toBe('function');
      expect(typeof exchange.disconnect).toBe('function');
      expect(typeof exchange.getCandles).toBe('function');
      expect(typeof exchange.getLatestPrice).toBe('function');
      expect(typeof exchange.openPosition).toBe('function');
      expect(typeof exchange.closePosition).toBe('function');
      expect(exchange.name).toBeDefined();
    });

    it('should have consistent method signatures across exchanges', async () => {
      const bybitFactory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });
      const binanceFactory = createFactory({ name: 'binance', symbol: 'BTCUSDT' });

      const bybitExchange = await bybitFactory.createExchange();
      const binanceExchange = await binanceFactory.createExchange();

      const expectedMethods = [
        'initialize', 'connect', 'disconnect', 'isConnected', 'healthCheck',
        'getCandles', 'getLatestPrice', 'getExchangeTime', 'getServerTime',
        'getCurrentPrice', 'getSymbolPrecision', 'openPosition', 'closePosition',
        'updateStopLoss', 'activateTrailing', 'getOpenPositions', 'getPosition',
        'hasPosition', 'createConditionalOrder', 'cancelOrder', 'getOrderStatus',
        'cancelAllOrders', 'cancelAllConditionalOrders', 'getBalance',
        'getLeverage', 'setLeverage', 'getFundingRate', 'getSymbol',
      ];

      for (const method of expectedMethods) {
        const bybitMethod = (bybitExchange as unknown as Record<string, unknown>)[method];
        const binanceMethod = (binanceExchange as unknown as Record<string, unknown>)[method];
        expect(typeof bybitMethod).toBe('function');
        expect(typeof binanceMethod).toBe('function');
      }
    });
  });

  describe('Multi-Exchange Switching', () => {
    it('should allow switching from Bybit to Binance', async () => {
      let factory = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });

      let exchange = await factory.createExchange();
      expect(exchange.name).toEqual('Bybit');

      factory.reset();
      factory = createFactory({ name: 'binance', symbol: 'XRPUSDT' });

      exchange = await factory.createExchange();
      expect(exchange.name).toEqual('Binance');
    });

    it('should maintain separate instances for different symbols', async () => {
      const bybitXRP = createFactory({ name: 'bybit', symbol: 'XRPUSDT' });
      const bybitBTC = createFactory({ name: 'bybit', symbol: 'BTCUSDT' });

      const xrpExchange = await bybitXRP.createExchange();
      const btcExchange = await bybitBTC.createExchange();

      expect(xrpExchange).not.toBe(btcExchange);
      expect(xrpExchange.name).toEqual('Bybit');
      expect(btcExchange.name).toEqual('Bybit');
    });

    it('should support demo and testnet modes', async () => {
      const demoFactory = createFactory({ name: 'bybit', symbol: 'XRPUSDT', demo: true });
      const testnetFactory = createFactory({ name: 'bybit', symbol: 'XRPUSDT', testnet: true });

      const demoExchange = await demoFactory.createExchange();
      const testnetExchange = await testnetFactory.createExchange();

      expect(demoExchange).toBeDefined();
      expect(testnetExchange).toBeDefined();
    });

    it('should support API credentials configuration', () => {
      const factory = createFactory({
        name: 'binance',
        symbol: 'BTCUSDT',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(factory.getExchangeName()).toEqual('binance');
      expect(factory.getSymbol()).toEqual('BTCUSDT');
    });
  });
});
