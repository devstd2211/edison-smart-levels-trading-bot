import { ICONS } from '../../cli/cli-runtime';
import { createBotInitializerMockLogger } from '../helpers/bot-initializer-test.utils';
import { runBotInitializerShutdownStep } from '../../services/bot-initializer/bot-initializer-shutdown.utils';

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
});
