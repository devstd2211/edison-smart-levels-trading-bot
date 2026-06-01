import { ICONS } from '../../cli/cli-runtime';
import { createBotInitializerMockLogger } from '../helpers/bot-initializer-test.utils';
import {
  runBotInitializerShutdownStep,
  runBotInitializerShutdownSteps,
} from '../../services/bot-initializer/bot-initializer-shutdown.utils';

describe('bot-initializer shutdown utils', () => {
  test('swallows shutdown errors and logs skip warnings', async () => {
    const logger = createBotInitializerMockLogger();

    await expect(
      runBotInitializerShutdownStep(logger, 'stop lifecycle services', async () => {
        throw new Error('stop failed');
      }),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      `${ICONS.warning} Error during stop lifecycle services, skipping:`,
      { error: 'stop failed' },
    );
  });

  test('continues through later shutdown steps after an earlier failure', async () => {
    const logger = createBotInitializerMockLogger();
    const callOrder: string[] = [];

    await expect(
      runBotInitializerShutdownSteps(logger, [
        {
          name: 'stop lifecycle services',
          run: async () => {
            callOrder.push('stop lifecycle services');
            throw new Error('stop failed');
          },
        },
        {
          name: 'send Telegram notification',
          run: async () => {
            callOrder.push('send Telegram notification');
          },
        },
      ]),
    ).resolves.toBeUndefined();

    expect(callOrder).toEqual([
      'stop lifecycle services',
      'send Telegram notification',
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      `${ICONS.warning} Error during stop lifecycle services, skipping:`,
      { error: 'stop failed' },
    );
  });
});
