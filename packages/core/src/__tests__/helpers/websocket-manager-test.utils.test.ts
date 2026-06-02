import {
  createManagedWebSocketManagerContext,
  createTestnetWebSocketManagerHarness,
} from './websocket-manager-test.utils';
import type { ExchangeConfig } from '../../types/legacy';

function getServiceConfig(service: object): ExchangeConfig {
  return (service as { config: ExchangeConfig }).config;
}

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

  test('managed contexts keep standard and testnet factories on their respective config boundaries', async () => {
    const context = createManagedWebSocketManagerContext({
      configOverrides: {
        demo: true,
        testnet: false,
      },
    });

    const standardService = context.createStandardService({
      configOverrides: {
        demo: false,
      },
    });
    const testnetService = context.createTestnetService({
      configOverrides: {
        testnet: false,
        demo: true,
      },
    });

    expect(getServiceConfig(standardService).testnet).toBe(false);
    expect(getServiceConfig(testnetService).testnet).toBe(true);

    await context.cleanup();
  });
});
