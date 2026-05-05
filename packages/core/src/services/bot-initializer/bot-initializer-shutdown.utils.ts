import { ICONS } from '../../cli/cli-runtime';
import { getErrorMessage } from '../../utils/error.utils';

type ShutdownLogger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

export async function runBotInitializerShutdownStep(
  logger: ShutdownLogger,
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logger.warn(`${ICONS.warning} Error during ${name}, skipping:`, {
      error: getErrorMessage(error),
    });
  }
}
