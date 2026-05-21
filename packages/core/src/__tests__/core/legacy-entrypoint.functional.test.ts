const mockMain = jest.fn();
const mockLoadOptionalRuntimeConfig = jest.fn();

jest.mock('../../cli', () => ({
  main: mockMain,
}));

jest.mock('../../config/index', () => ({
  loadOptionalRuntimeConfig: mockLoadOptionalRuntimeConfig,
}));

import { main, runLegacyCliEntrypoint } from '../../index';
import { BotFactory } from '../../index';
import type { IExchange } from '../../interfaces';
import { createBotRuntime, loadBotRuntimeConfig } from '../../index';
import {
  createLegacyEntrypointRuntimeConfig,
  createLegacyRuntimeDefaultsConfig,
} from '../helpers/service-lifecycle-test.utils';

describe('legacy entrypoint wrapper', () => {
  beforeEach(() => {
    mockMain.mockReset();
    mockLoadOptionalRuntimeConfig.mockReset();
  });

  test('importing the wrapper exports the CLI entrypoint without auto-starting it', () => {
    expect(main).toBe(mockMain);
    expect(mockMain).not.toHaveBeenCalled();
  });

  test('wrapper runtime delegates direct execution to the CLI entrypoint only', async () => {
    mockMain.mockResolvedValue(undefined);

    await expect(runLegacyCliEntrypoint()).resolves.toBeUndefined();
    expect(mockMain).toHaveBeenCalledTimes(1);
  });

  test('wrapper re-exports BotFactory runtime bundle creation without widening the runtime contract', () => {
    const config = createLegacyEntrypointRuntimeConfig();
    const mockExchange = {
      name: 'MockExchange',
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;

    const bundle = BotFactory.createBotRuntimeBundle(config, { bybitService: mockExchange });

    expect(bundle.runtimeDependencies.webApiServices.bybitService).toBe(mockExchange);
    expect('marketDataServices' in bundle.runtimeDependencies.tradingBotServices).toBe(false);
  });

  test('wrapper re-exports the core runtime factory without auto-starting lifecycle', async () => {
    const config = createLegacyEntrypointRuntimeConfig();
    const runtime = await createBotRuntime(config);

    expect(runtime.bot.isRunning).toBe(false);
    expect(runtime.runtimeSource.coreServices.logger).toBeDefined();
  });

  test('wrapper re-exports the config-aware runtime config loader without auto-starting the CLI', async () => {
    const config = createLegacyRuntimeDefaultsConfig();
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig();

    expect(mockMain).not.toHaveBeenCalled();
    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(result).toBe(config);
  });
});
