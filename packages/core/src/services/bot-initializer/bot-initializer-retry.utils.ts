import { ICONS } from '../../cli/cli-runtime';
import type { RetryConfig } from '../../errors/ErrorHandler';

type RetryLogger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

export type BotInitializerRetryOptions = {
  classifyError: (error: unknown, operation: string, context?: Record<string, unknown>) => Error;
  config: RetryConfig;
  context?: Record<string, unknown>;
  logger: RetryLogger;
  operation: string;
  retryLabel: string;
  wait?: (delayMs: number) => Promise<void>;
};

export function calculateBotInitializerRetryDelay(
  attempt: number,
  config: RetryConfig,
): number {
  const delay =
    config.initialDelayMs *
    Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs || delay);
}

export async function runBotInitializerRetryOperation<T>(
  operationFn: () => Promise<T> | T,
  options: BotInitializerRetryOptions,
): Promise<T> {
  const wait = options.wait ?? (async (delayMs: number) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  });

  for (let attempt = 1; attempt <= options.config.maxAttempts; attempt++) {
    try {
      return await operationFn();
    } catch (error) {
      if (attempt === options.config.maxAttempts) {
        throw options.classifyError(error, options.operation, options.context);
      }

      const delay = calculateBotInitializerRetryDelay(attempt, options.config);
      options.logger.warn(`${ICONS.warning} Retrying ${options.retryLabel} (attempt ${attempt})...`, {
        delayMs: delay,
      });
      await wait(delay);
    }
  }

  throw new Error(`Retry loop exited unexpectedly for ${options.operation}`);
}
