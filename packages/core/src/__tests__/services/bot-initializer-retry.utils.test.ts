import { ICONS } from '../../cli/cli-runtime';
import { ExchangeConnectionError } from '../../errors/DomainErrors';
import type { RetryConfig } from '../../errors/ErrorHandler';
import { createBotInitializerMockLogger } from '../helpers/bot-initializer-test.utils';
import {
  calculateBotInitializerRetryDelay,
  runBotInitializerRetryOperation,
} from '../../services/bot-initializer/bot-initializer-retry.utils';

describe('bot-initializer retry utils', () => {
  const config: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 100,
    backoffMultiplier: 2,
    maxDelayMs: 250,
  };

  test('calculates capped exponential retry delays', () => {
    expect(calculateBotInitializerRetryDelay(1, config)).toBe(100);
    expect(calculateBotInitializerRetryDelay(2, config)).toBe(200);
    expect(calculateBotInitializerRetryDelay(3, config)).toBe(250);
  });

  test('uses custom backoff strategy when provided', () => {
    const customConfig: RetryConfig = {
      ...config,
      customBackoff: (attempt) => attempt * 175,
    };

    expect(calculateBotInitializerRetryDelay(1, customConfig)).toBe(175);
    expect(calculateBotInitializerRetryDelay(2, customConfig)).toBe(250);
  });

  test('retries until the operation succeeds', async () => {
    const logger = createBotInitializerMockLogger();
    const wait = jest.fn().mockResolvedValue(undefined);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('ok');

    const result = await runBotInitializerRetryOperation(operation, {
      classifyError: (error, operationName) =>
        new ExchangeConnectionError(operationName, { exchangeName: 'bybit' }, error as Error),
      config,
      logger,
      operation: 'initializeBybit',
      retryLabel: 'Bybit init',
      wait,
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(100);
    expect(logger.warn).toHaveBeenCalledWith(
      `${ICONS.warning} Retrying Bybit init (attempt 1)...`,
      { delayMs: 100 },
    );
  });

  test('classifies and throws the final failure on retry exhaustion', async () => {
    const logger = createBotInitializerMockLogger();
    const wait = jest.fn().mockResolvedValue(undefined);
    const operation = jest.fn().mockRejectedValue(new Error('still failing'));

    await expect(
      runBotInitializerRetryOperation(operation, {
        classifyError: (error, operationName) =>
          new ExchangeConnectionError(operationName, { exchangeName: 'bybit' }, error as Error),
        config,
        logger,
        operation: 'initializeBybit',
        retryLabel: 'Bybit init',
        wait,
      }),
    ).rejects.toBeInstanceOf(ExchangeConnectionError);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 100);
    expect(wait).toHaveBeenNthCalledWith(2, 200);
  });
});
