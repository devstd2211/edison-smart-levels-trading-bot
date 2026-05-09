import {
  createManagedFunctionalExchangeFactoryContext,
  type FunctionalExchangeFactoryRuntime,
} from '../helpers/exchange-factory-test.utils';
import { ICONS } from '../../cli/cli-runtime';

describe('ExchangeFactory - Functional behavior', () => {
  let createBybitFactory: FunctionalExchangeFactoryRuntime['createBybitFactory'];
  let createBinanceFactory: FunctionalExchangeFactoryRuntime['createBinanceFactory'];
  let mockLogger: FunctionalExchangeFactoryRuntime['mockLogger'];
  let cleanup: FunctionalExchangeFactoryRuntime['cleanup'];

  beforeEach(() => {
    ({
      createBybitFactory,
      createBinanceFactory,
      mockLogger,
      cleanup,
    } = createManagedFunctionalExchangeFactoryContext());
  });

  afterEach(() => {
    cleanup();
  });

  it('caches the initialized adapter until reset is called', async () => {
    const factory = createBybitFactory({ symbol: 'ETHUSDT' });

    const firstExchange = await factory.createExchange();
    const secondExchange = await factory.createExchange();

    expect(firstExchange).toBe(secondExchange);
    expect(factory.getExchange()).toBe(firstExchange);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `${ICONS.success} Exchange initialized`,
      expect.objectContaining({
        name: 'Bybit',
        symbol: 'ETHUSDT',
      }),
    );
  });

  it('creates a fresh adapter after reset while preserving the selected config', async () => {
    const factory = createBinanceFactory({
      symbol: 'ADAUSDT',
      demo: false,
      testnet: true,
    });

    const firstExchange = await factory.createExchange();
    factory.reset();
    const secondExchange = await factory.createExchange();

    expect(firstExchange).not.toBe(secondExchange);
    expect(factory.getExchangeName()).toBe('binance');
    expect(factory.getSymbol()).toBe('ADAUSDT');
  });

  it('keeps different factory instances isolated per exchange selection', async () => {
    const bybitFactory = createBybitFactory({ symbol: 'BTCUSDT' });
    const binanceFactory = createBinanceFactory({ symbol: 'BTCUSDT' });

    const bybitExchange = await bybitFactory.createExchange();
    const binanceExchange = await binanceFactory.createExchange();

    expect(bybitExchange).not.toBe(binanceExchange);
    expect(bybitExchange.name).toBe('Bybit');
    expect(binanceExchange.name).toBe('Binance');
  });
});
