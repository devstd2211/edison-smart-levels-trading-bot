import {
  detectActiveStrategy,
  formatExchangeMode,
  ICONS,
  isMainnetMode,
  resolveCliPorts,
} from '../../cli/cli-runtime';
import { createCliRuntimeDefaultConfig } from '../helpers/bot-factory-runtime-test.utils';

describe('cli runtime helpers', () => {
  test('resolveCliPorts falls back when env values are missing or invalid', () => {
    expect(resolveCliPorts({})).toEqual({ apiPort: 4000, wsPort: 4001 });
    expect(resolveCliPorts({ API_PORT: '4100', WS_PORT: 'invalid' })).toEqual({
      apiPort: 4100,
      wsPort: 4001,
    });
  });

  test('detectActiveStrategy preserves priority for enabled scalping strategies', () => {
    const config = createCliRuntimeDefaultConfig();
    config.scalpingMicroWall = { enabled: true } as typeof config.scalpingMicroWall;
    config.scalpingTickDelta = { enabled: true } as typeof config.scalpingTickDelta;
    config.strategies = {
      ...config.strategies,
      levelBased: { ...(config.strategies?.levelBased ?? {}), enabled: true },
    };

    expect(detectActiveStrategy(config)).toBe('Micro-Wall');
  });

  test('formatExchangeMode and isMainnetMode distinguish demo, testnet, and mainnet', () => {
    const config = createCliRuntimeDefaultConfig();

    config.exchange.demo = true;
    config.exchange.testnet = false;
    expect(isMainnetMode(config)).toBe(false);
    expect(formatExchangeMode(config)).toBe(`DEMO ${ICONS.demo}`);

    config.exchange.demo = false;
    config.exchange.testnet = true;
    expect(isMainnetMode(config)).toBe(false);
    expect(formatExchangeMode(config)).toBe(`TESTNET ${ICONS.warning}`);

    config.exchange.testnet = false;
    expect(isMainnetMode(config)).toBe(true);
    expect(formatExchangeMode(config)).toBe(`MAINNET ${ICONS.mainnet}`);
  });
});
