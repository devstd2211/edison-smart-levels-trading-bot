import {
  createBotInitializerConfig,
  createBotInitializerMockErrorHandler,
  createBotInitializerMockServices,
  createManagedBotInitializerTestContext,
} from './bot-initializer-test.utils';

describe('bot-initializer test utils', () => {
  test('managed context keeps live references after rebuild overrides', async () => {
    const context = createManagedBotInitializerTestContext();
    const nextServices = createBotInitializerMockServices();
    const nextConfig = createBotInitializerConfig({
      exchange: {
        name: 'bybit',
        timeframe: '1',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        demo: false,
        testnet: true,
        symbol: 'ETHUSDT',
      },
    });
    const nextErrorHandler = createBotInitializerMockErrorHandler();

    const rebuilt = context.rebuild({
      services: nextServices,
      config: nextConfig,
      errorHandler: nextErrorHandler,
    });

    expect(context.services).toBe(nextServices);
    expect(context.config).toBe(nextConfig);
    expect(context.errorHandler).toBe(nextErrorHandler);
    expect(context.initializer).toBe(rebuilt);
    expect(context.createWithoutHandler()).toBeDefined();

    await context.cleanup();
  });
});
