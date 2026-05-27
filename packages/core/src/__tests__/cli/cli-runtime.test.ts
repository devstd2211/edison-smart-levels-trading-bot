import {
  CLI_DEFAULT_PORTS,
  CLI_PORT_ENV_KEYS,
  detectCliActiveStrategyLabel,
  formatCliExchangeModeLabel,
  ICONS,
  isMainnetMode,
  resolveCliPorts,
} from '../../cli/cli-runtime';
import { createCliBoundaryRuntimeDefaultConfig } from '../helpers/bot-factory-runtime-test.utils';

describe('cli runtime helpers', () => {
  test('resolveCliPorts falls back when env values are missing or invalid', () => {
    expect(CLI_DEFAULT_PORTS).toEqual({ apiPort: 4000, wsPort: 4001 });
    expect(CLI_PORT_ENV_KEYS).toEqual({ apiPort: 'API_PORT', wsPort: 'WS_PORT' });
    expect(resolveCliPorts({})).toEqual(CLI_DEFAULT_PORTS);
    expect(resolveCliPorts({ API_PORT: '4100', WS_PORT: 'invalid' })).toEqual({
      apiPort: 4100,
      wsPort: CLI_DEFAULT_PORTS.wsPort,
    });
  });

  test('detectCliActiveStrategyLabel preserves priority for enabled scalping strategies', () => {
    const config = createCliBoundaryRuntimeDefaultConfig();
    config.scalpingMicroWall = { enabled: true } as typeof config.scalpingMicroWall;
    config.scalpingTickDelta = { enabled: true } as typeof config.scalpingTickDelta;
    config.strategies = {
      ...config.strategies,
      levelBased: { ...(config.strategies?.levelBased ?? {}), enabled: true },
    };

    expect(detectCliActiveStrategyLabel(config)).toBe('Micro-Wall');
  });

  test('formatCliExchangeModeLabel and isMainnetMode distinguish demo, testnet, and mainnet', () => {
    const config = createCliBoundaryRuntimeDefaultConfig();

    config.exchange.demo = true;
    config.exchange.testnet = false;
    expect(isMainnetMode(config)).toBe(false);
    expect(formatCliExchangeModeLabel(config)).toBe(`DEMO ${ICONS.demo}`);

    config.exchange.demo = false;
    config.exchange.testnet = true;
    expect(isMainnetMode(config)).toBe(false);
    expect(formatCliExchangeModeLabel(config)).toBe(`TESTNET ${ICONS.warning}`);

    config.exchange.testnet = false;
    expect(isMainnetMode(config)).toBe(true);
    expect(formatCliExchangeModeLabel(config)).toBe(`MAINNET ${ICONS.mainnet}`);
  });
});
