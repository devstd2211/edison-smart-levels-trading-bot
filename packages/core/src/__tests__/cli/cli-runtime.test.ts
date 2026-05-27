import {
  CLI_ACTIVE_STRATEGY_FALLBACK_LABEL,
  CLI_ACTIVE_STRATEGY_PRIORITY,
  CLI_DEFAULT_PORTS,
  CLI_EXCHANGE_MODE_LABELS,
  CLI_PORT_ENV_KEYS,
  CLI_WEB_CLIENT_DEV_SERVER,
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
    expect(CLI_WEB_CLIENT_DEV_SERVER).toEqual({
      command: 'cd packages/web-client && npm run dev',
      port: 3000,
    });
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
    expect(CLI_ACTIVE_STRATEGY_PRIORITY.map((strategy) => strategy.label)).toContain('Micro-Wall');
    expect(CLI_ACTIVE_STRATEGY_FALLBACK_LABEL).toBe('Mixed Strategies');
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
    expect(CLI_EXCHANGE_MODE_LABELS.map((mode) => mode.label)).toEqual([
      `DEMO ${ICONS.demo}`,
      `TESTNET ${ICONS.warning}`,
      `MAINNET ${ICONS.mainnet}`,
    ]);
  });
});
