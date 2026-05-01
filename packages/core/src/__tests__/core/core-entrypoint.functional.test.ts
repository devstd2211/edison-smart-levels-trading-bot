const mockCreate = jest.fn();

jest.mock('../../bot-factory', () => ({
  BotFactory: {
    create: mockCreate,
  },
}));

import { createBot, startBot } from '../../core';
import { createMinimalLifecycleConfig } from '../helpers/service-lifecycle-test.utils';

describe('core entrypoint boundary', () => {
  beforeEach(() => {
    mockCreate.mockReset();
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
});
