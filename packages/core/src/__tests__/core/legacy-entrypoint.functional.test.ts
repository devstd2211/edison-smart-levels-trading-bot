const mockMain = jest.fn();

jest.mock('../../cli', () => ({
  main: mockMain,
}));

import { main, runLegacyCliEntrypoint } from '../../index';
import { BotFactory } from '../../index';
import type { IExchange } from '../../interfaces';
import { createBotFactoryTestConfig } from '../helpers/bot-factory-test.utils';

describe('legacy entrypoint wrapper', () => {
  beforeEach(() => {
    mockMain.mockReset();
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
    const config = createBotFactoryTestConfig();
    const mockExchange = {
      name: 'MockExchange',
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;

    const bundle = BotFactory.createRuntimeBundle(config, { bybitService: mockExchange });

    expect(bundle.runtimeDependencies.webApiServices.bybitService).toBe(mockExchange);
    expect('marketDataServices' in bundle.runtimeDependencies.tradingBotServices).toBe(false);
  });
});
