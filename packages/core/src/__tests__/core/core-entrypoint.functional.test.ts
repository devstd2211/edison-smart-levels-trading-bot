const mockCreate = jest.fn();
const mockCreateRuntime = jest.fn();
const mockLoadRuntimeConfig = jest.fn();
const mockLoadValidatedConfig = jest.fn();

jest.mock('../../bot-factory', () => ({
  BotFactory: {
    create: mockCreate,
    createRuntime: mockCreateRuntime,
  },
}));

jest.mock('../../config/index', () => ({
  loadRuntimeConfig: mockLoadRuntimeConfig,
  loadValidatedConfig: mockLoadValidatedConfig,
}));

import {
  createBot,
  createBotRuntime,
  createConfiguredBot,
  createConfiguredBotRuntime,
  loadBotRuntimeConfig,
  startBot,
  startConfiguredBot,
} from '../../core';
import { createMinimalLifecycleConfig } from '../helpers/service-lifecycle-test.utils';

describe('core entrypoint boundary', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreateRuntime.mockReset();
    mockLoadRuntimeConfig.mockReset();
    mockLoadValidatedConfig.mockReset();
  });

  test('createBot delegates to BotFactory without starting the runtime', async () => {
    const config = createMinimalLifecycleConfig();
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
    const config = createMinimalLifecycleConfig();
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
    expect(result).toBe(runtime);
    expect(runtime.bot.start).not.toHaveBeenCalled();
  });

  test('startBot starts the created runtime before returning it', async () => {
    const config = createMinimalLifecycleConfig();
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
    const config = createMinimalLifecycleConfig();
    const loader = {
      loadBaseConfig: jest.fn(() => config),
      validate: jest.fn(),
    };
    mockLoadRuntimeConfig.mockResolvedValue(config);
    mockLoadValidatedConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig(loader);

    expect(mockLoadRuntimeConfig).toHaveBeenCalledWith(loader);
    expect(mockLoadValidatedConfig).not.toHaveBeenCalled();
    expect(result).toBe(config);
  });

  test('loadBotRuntimeConfig uses the validated default loader path when no custom loader is provided', async () => {
    const config = createMinimalLifecycleConfig();
    mockLoadValidatedConfig.mockResolvedValue(config);

    const result = await loadBotRuntimeConfig();

    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(mockLoadValidatedConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe(config);
  });

  test('createConfiguredBot loads validated runtime config before delegating to BotFactory', async () => {
    const config = createMinimalLifecycleConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockLoadValidatedConfig.mockResolvedValue(config);
    mockCreate.mockResolvedValue(bot);

    const result = await createConfiguredBot();

    expect(mockLoadValidatedConfig).toHaveBeenCalledTimes(1);
    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(result).toBe(bot);
  });

  test('createConfiguredBotRuntime loads validated runtime config before creating the runtime', async () => {
    const config = createMinimalLifecycleConfig();
    const runtime = {
      bot: {
        start: jest.fn(),
      },
      runtimeSource: {
        coreServices: {},
      },
      webApiAdapter: {},
    };
    mockLoadValidatedConfig.mockResolvedValue(config);
    mockCreateRuntime.mockResolvedValue(runtime);

    const result = await createConfiguredBotRuntime();

    expect(mockLoadValidatedConfig).toHaveBeenCalledTimes(1);
    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(mockCreateRuntime).toHaveBeenCalledWith(config);
    expect(result).toBe(runtime);
  });

  test('startConfiguredBot loads validated runtime config before starting the bot', async () => {
    const config = createMinimalLifecycleConfig();
    const bot = {
      isRunning: false,
      eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    mockLoadValidatedConfig.mockResolvedValue(config);
    mockCreate.mockResolvedValue(bot);

    const result = await startConfiguredBot();

    expect(mockLoadValidatedConfig).toHaveBeenCalledTimes(1);
    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({ config });
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(result).toBe(bot);
  });
});
