const mockMain = jest.fn();
const mockLoadOptionalRuntimeConfig = jest.fn();

jest.mock('../../cli', () => ({
  main: mockMain,
}));

jest.mock('../../config/index', () => ({
  loadOptionalRuntimeConfig: mockLoadOptionalRuntimeConfig,
}));

import * as rootEntrypoint from '../../index';
import { main, runLegacyCliEntrypoint } from '../../index';
import { BotFactory } from '../../index';
import type { IExchange } from '../../interfaces';
import { createBotRuntime, loadBotRuntimeConfig } from '../../index';
import {
  createLegacyEntrypointRunners,
  LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES,
  runLegacyCliEntrypoint as runLegacyCliEntrypointFromRuntime,
  runLegacyCliEntrypointIfMain,
  shouldRunLegacyCliEntrypoint,
} from '../../legacy-entrypoint-runtime';
import {
  createLegacyEntrypointCandleRuntimeConfig,
  createLegacyPreRuntimeDefaultsConfig,
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

  test('wrapper re-exports the shared legacy runtime helper directly', () => {
    expect(runLegacyCliEntrypoint).toBe(runLegacyCliEntrypointFromRuntime);
  });

  test('wrapper keeps the root runtime export surface limited to the legacy compatibility contract', () => {
    expect(Object.keys(rootEntrypoint).sort()).toEqual(
      [...LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect(Object.keys(rootEntrypoint)).not.toContain('startWebServer');
  });

  test('wrapper direct-execution guard only runs the CLI when the legacy entrypoint is the main module', async () => {
    mockMain.mockResolvedValue(undefined);

    const currentModule = { id: 'legacy-wrapper' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;

    expect(shouldRunLegacyCliEntrypoint(currentModule, currentModule)).toBe(true);
    expect(shouldRunLegacyCliEntrypoint(currentModule, otherModule)).toBe(false);
    expect(
      runLegacyCliEntrypointIfMain(currentModule, otherModule, mockMain),
    ).toBeUndefined();

    await expect(
      runLegacyCliEntrypointIfMain(currentModule, currentModule, mockMain),
    ).resolves.toBeUndefined();
    expect(mockMain).toHaveBeenCalledTimes(1);
  });

  test('wrapper if-main helper uses the shared default main-module resolution when mainModule is omitted', async () => {
    mockMain.mockResolvedValue(undefined);
    const currentModule = { id: 'legacy-wrapper' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;
    const resolveMainModule = jest.fn(() => currentModule);
    const runners = createLegacyEntrypointRunners(mockMain, resolveMainModule);

    expect(runners.runEntrypointIfMain(otherModule)).toBeUndefined();
    await expect(runners.runEntrypointIfMain(currentModule)).resolves.toBeUndefined();

    expect(mockMain).toHaveBeenCalledTimes(1);
    expect(resolveMainModule).toHaveBeenCalledTimes(2);
  });

  test('wrapper re-exports BotFactory runtime bundle creation without widening the runtime contract', () => {
    const config = createLegacyEntrypointCandleRuntimeConfig();
    const mockExchange = {
      name: 'MockExchange',
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;

    const bundle = BotFactory.createBotRuntimeBundle(config, { bybitService: mockExchange });

    expect(bundle.runtimeDependencies.balanceReader).toBe(mockExchange);
    expect('marketDataServices' in bundle.runtimeDependencies.tradingBotServices).toBe(false);
  });

  test('wrapper re-exports the core runtime factory without auto-starting lifecycle', async () => {
    const config = createLegacyEntrypointCandleRuntimeConfig();
    const runtime = await createBotRuntime(config);

    expect(runtime.bot.isRunning).toBe(false);
    expect(runtime.runtimeSource.coreServices.logger).toBeDefined();
  });

  test('wrapper re-exports the config-aware runtime config loader without auto-starting the CLI', async () => {
    const config = createLegacyPreRuntimeDefaultsConfig();
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig();

    expect(mockMain).not.toHaveBeenCalled();
    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(result).toBe(config);
  });
});
