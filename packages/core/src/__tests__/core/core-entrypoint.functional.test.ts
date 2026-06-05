import * as fs from 'fs';
import * as path from 'path';
const mockCreate = jest.fn();
const mockCreateRuntime = jest.fn();
const mockLoadOptionalRuntimeConfig = jest.fn();

jest.mock('../../bot-factory', () => ({
  BotFactory: {
    create: mockCreate,
    createRuntime: mockCreateRuntime,
  },
}));

jest.mock('../../config/index', () => ({
  loadOptionalRuntimeConfig: mockLoadOptionalRuntimeConfig,
}));

import * as coreEntrypointModule from '../../core';
import * as coreEntrypointRuntimeModule from '../../core/core-entrypoint-runtime';
import {
  CORE_ENTRYPOINT_EXPORT_NAMES,
  createBot,
  createBotRuntime,
  createConfiguredBot,
  createConfiguredBotRuntime,
  loadBotRuntimeConfig,
  startBot,
  startConfiguredBot,
} from '../../core';
import type {
  CoreRuntimeConfigAction,
  CoreRuntimeConfigLoader,
} from '../../core/core-entrypoint-runtime';
import { withLoadedRuntimeConfig } from '../../core/core-entrypoint-runtime';
import { createCoreEntrypointBoundaryLegacyCandleRuntimeConfig } from '../helpers/bot-factory-runtime-test.utils';

describe('core entrypoint boundary', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreateRuntime.mockReset();
    mockLoadOptionalRuntimeConfig.mockReset();
  });

  test('keeps the programmatic core entrypoint export surface focused on runtime creation helpers', () => {
    expect(Object.isFrozen(CORE_ENTRYPOINT_EXPORT_NAMES)).toBe(true);
    expect(Object.keys(coreEntrypointModule).sort()).toEqual(
      [...CORE_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect([...CORE_ENTRYPOINT_EXPORT_NAMES]).toEqual([
      'CORE_ENTRYPOINT_EXPORT_NAMES',
      'createBot',
      'createBotRuntime',
      'createConfiguredBot',
      'createConfiguredBotRuntime',
      'loadBotRuntimeConfig',
      'startBot',
      'startConfiguredBot',
    ]);
    expect(Object.keys(coreEntrypointModule)).not.toContain('ConfigPipelineLoader');
    expect(Object.keys(coreEntrypointModule)).not.toContain('ConfigPipelineBaseConfigLoader');
    expect(Object.keys(coreEntrypointModule)).not.toContain('ConfigPipelineConfigValidator');
  });

  test('createBot delegates to BotFactory without starting the runtime', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockCreate.mockResolvedValue(bot);

    const result = await createBot(config);

    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(result).toBe(bot);
    expect(bot.start).not.toHaveBeenCalled();
  });

  test('createBotRuntime delegates to BotFactory runtime creation without starting the bot', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const runtime = {
      bot: {
        start: jest.fn(),
      },
      runtimeSource: {
        coreServices: {},
      },
      webApiAdapter: {},
    };
    mockCreateRuntime.mockReturnValue(runtime);

    const result = await createBotRuntime(config);

    expect(mockCreateRuntime).toHaveBeenCalledWith(config);
    expect(result).toEqual({
      bot: runtime.bot,
      webApiAdapter: runtime.webApiAdapter,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(runtime.bot.start).not.toHaveBeenCalled();
    expect('runtimeSource' in (result as unknown as Record<string, unknown>)).toBe(false);
  });

  test('createBotRuntime reuses the explicit runtime handoff without rediscovering the web adapter from bot internals', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const runtime = {
      bot: {
        start: jest.fn(),
        getWebApiAdapter: jest.fn(() => {
          throw new Error('should not be called');
        }),
      },
      runtimeSource: {
        coreServices: {},
      },
      webApiAdapter: { kind: 'runtime-web-adapter' },
    };
    mockCreateRuntime.mockReturnValue(runtime);

    const result = await createBotRuntime(config);

    expect(mockCreateRuntime).toHaveBeenCalledWith(config);
    expect(result.webApiAdapter).toBe(runtime.webApiAdapter);
    expect(runtime.bot.getWebApiAdapter).not.toHaveBeenCalled();
    expect('runtimeSource' in (result as unknown as Record<string, unknown>)).toBe(false);
  });

  test('startBot starts the created runtime before returning it', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockCreate.mockResolvedValue(bot);

    const result = await startBot(config);

    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(result).toBe(bot);
  });

  test('loadBotRuntimeConfig delegates to ConfigPipeline runtime loading', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const loader = {
      loadBaseConfig: jest.fn(() => config),
      validate: jest.fn(),
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig(loader);

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(loader);
    expect(result).toBe(config);
  });

  test('loadBotRuntimeConfig uses the validated default loader path when no custom loader is provided', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig();

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(result).toBe(config);
  });

  test('configured helper exports stay aligned around the shared loadBotRuntimeConfig seam', () => {
    expect([...CORE_ENTRYPOINT_EXPORT_NAMES]).toEqual(
      expect.arrayContaining([
        'createConfiguredBot',
        'createConfiguredBotRuntime',
        'loadBotRuntimeConfig',
        'startConfiguredBot',
      ]),
    );
  });

  test('configured helper source binds the public config-loader seam once for all configured helper paths', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'core', 'core-entrypoint-runtime.ts'),
      'utf8',
    );

    expect(source).toContain('function createConfiguredCoreEntrypointHelpers(');
    expect(source).toContain(
      'const configuredCoreEntrypointHelpers = createConfiguredCoreEntrypointHelpers();',
    );
    expect(source).toContain('return configuredCoreEntrypointHelpers.createConfiguredBot(loader);');
    expect(source).toContain(
      'return configuredCoreEntrypointHelpers.createConfiguredBotRuntime(loader);',
    );
    expect(source).toContain('return configuredCoreEntrypointHelpers.startConfiguredBot(loader);');
  });

  test('core barrel re-exports the runtime helper implementations directly', () => {
    expect(createBot).toBe(coreEntrypointRuntimeModule.createBot);
    expect(createBotRuntime).toBe(coreEntrypointRuntimeModule.createBotRuntime);
    expect(createConfiguredBot).toBe(coreEntrypointRuntimeModule.createConfiguredBot);
    expect(createConfiguredBotRuntime).toBe(
      coreEntrypointRuntimeModule.createConfiguredBotRuntime,
    );
    expect(loadBotRuntimeConfig).toBe(
      coreEntrypointRuntimeModule.loadBotRuntimeConfig,
    );
    expect(startBot).toBe(coreEntrypointRuntimeModule.startBot);
    expect(startConfiguredBot).toBe(
      coreEntrypointRuntimeModule.startConfiguredBot,
    );
  });

  test('the core entrypoint keeps ConfigPipelineLoader as a type-only convenience re-export', () => {
    expect(coreEntrypointModule).not.toHaveProperty('ConfigPipelineLoader');
  });

  test('the core entrypoint source keeps CoreEntrypointRuntime as a type-only runtime handoff contract', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'core', 'index.ts'),
      'utf8',
    );

    expect(source).toContain("export type { BotLike, CoreEntrypointRuntime } from './core-entrypoint-runtime';");
    expect(coreEntrypointModule).not.toHaveProperty('CoreEntrypointRuntime');
  });

  test('configured runtime orchestration keeps the config loader injected at the core boundary', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const loader = {
      loadBaseConfig: jest.fn(() => config),
      validate: jest.fn(),
    };
    const loadRuntimeConfig: CoreRuntimeConfigLoader = jest.fn(async (nextLoader) => {
      expect(nextLoader).toBe(loader);
      return config;
    });
    const action: CoreRuntimeConfigAction<string> = jest.fn(async (nextConfig) => {
      expect(nextConfig).toBe(config);
      return 'runtime-ready';
    });

    await expect(
      withLoadedRuntimeConfig(action, loadRuntimeConfig, loader),
    ).resolves.toBe('runtime-ready');
    expect(loadRuntimeConfig).toHaveBeenCalledWith(loader);
    expect(action).toHaveBeenCalledWith(config);
  });

  test('createConfiguredBot loads validated runtime config before delegating to BotFactory', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);
    mockCreate.mockResolvedValue(bot);

    const result = await createConfiguredBot();

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(result).toBe(bot);
  });

  test('createConfiguredBotRuntime loads validated runtime config before creating the runtime', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const runtime = {
      bot: {
        start: jest.fn(),
      },
      runtimeSource: {
        coreServices: {},
      },
      webApiAdapter: {},
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);
    mockCreateRuntime.mockReturnValue(runtime);

    const result = await createConfiguredBotRuntime();

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(mockCreateRuntime).toHaveBeenCalledWith(config);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      bot: expect.objectContaining({
        start: expect.any(Function),
      }),
      webApiAdapter: {},
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect('runtimeSource' in (result as unknown as Record<string, unknown>)).toBe(false);
  });

  test('createConfiguredBotRuntime forwards a custom ConfigPipelineLoader through the configured runtime helper path', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const loader = {
      loadBaseConfig: jest.fn(() => config),
      validate: jest.fn(),
    };
    const runtime = {
      bot: {
        start: jest.fn(),
      },
      runtimeSource: {
        coreServices: {},
      },
      webApiAdapter: {},
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);
    mockCreateRuntime.mockReturnValue(runtime);

    const result = await createConfiguredBotRuntime(loader);

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(loader);
    expect(mockCreateRuntime).toHaveBeenCalledWith(config);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.bot.start).not.toHaveBeenCalled();
    expect(result.webApiAdapter).toBe(runtime.webApiAdapter);
    expect('runtimeSource' in (result as unknown as Record<string, unknown>)).toBe(false);
  });

  test('startConfiguredBot loads validated runtime config before starting the bot', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);
    mockCreate.mockResolvedValue(bot);

    const result = await startConfiguredBot();

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(undefined);
    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(mockCreateRuntime).not.toHaveBeenCalled();
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(result).toBe(bot);
  });

  test('startConfiguredBot forwards a custom ConfigPipelineLoader through the one-shot startup helper path', async () => {
    const config = createCoreEntrypointBoundaryLegacyCandleRuntimeConfig();
    const loader = {
      loadBaseConfig: jest.fn(() => config),
      validate: jest.fn(),
    };
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockLoadOptionalRuntimeConfig.mockResolvedValue(config);
    mockCreate.mockResolvedValue(bot);

    const result = await startConfiguredBot(loader);

    expect(mockLoadOptionalRuntimeConfig).toHaveBeenCalledWith(loader);
    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(mockCreateRuntime).not.toHaveBeenCalled();
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(result).toBe(bot);
  });
});
