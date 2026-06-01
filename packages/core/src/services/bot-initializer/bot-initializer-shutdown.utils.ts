import { ICONS } from '../../cli/cli-runtime';
import { getErrorMessage } from '../../utils/error.utils';

type ShutdownLogger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

export type BotInitializerShutdownStep = {
  name: string;
  run: () => void | Promise<void>;
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

export async function runBotInitializerShutdownSteps(
  logger: ShutdownLogger,
  steps: Iterable<BotInitializerShutdownStep>,
): Promise<void> {
  for (const step of steps) {
    await runBotInitializerShutdownStep(logger, step.name, step.run);
  }
}
