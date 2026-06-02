import {
  createManagedWebSocketManagerContext,
  createTestnetWebSocketManagerHarness,
} from './websocket-manager-test.utils';

describe('websocket-manager test utils', () => {
  test('testnet harness keeps the forced testnet boundary even when overrides disagree', () => {
    const harness = createTestnetWebSocketManagerHarness({
      configOverrides: {
        testnet: false,
        demo: true,
      },
    });

    expect(harness.config.testnet).toBe(true);
  });

  test('managed testnet context preserves the forced testnet boundary for created services', async () => {
    const context = createManagedWebSocketManagerContext({
      testnet: true,
      configOverrides: {
        testnet: false,
      },
    });

    expect(context.config.testnet).toBe(true);
    expect(context.createStandardTestnetService().isConnected()).toBe(false);

    await context.cleanup();
  });
});
