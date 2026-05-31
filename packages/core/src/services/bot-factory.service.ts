/**
 * BotFactory - Dependency Injection Container
 *
 * Phase 5: Dependency Injection Enhancement
 * Phase 8.9.41: ErrorHandler Integration for config validation & service creation
 *
 * Manages creation and configuration of the narrowed bot runtime source with proper DI and error handling.
 */

import { LoggerService } from './logger.service';
import { Config } from '../types/legacy';
import type { IBotFactoryRuntimeSource } from '../interfaces';
import { BotFactoryInitializationError } from '../errors/DomainErrors';
import type { BotFactoryOptions } from './factories/bot-factory-options';
import {
  buildBotFactoryServiceState as buildBotFactoryServiceStateInternal,
  createBotFactoryRuntimeSource as createBotFactoryRuntimeSourceInternal,
  createBotFactoryRuntimeSourceFromState as createBotFactoryRuntimeSourceFromStateInternal,
  finalizeBotFactoryServiceState as finalizeBotFactoryServiceStateInternal,
} from './factories/bot-service-state';
import { validateBotConfig } from './factories/bot-services.validate';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

export type SafeBotFactoryRuntimeSourceResult =
  { success: true; services: IBotFactoryRuntimeSource }
  | { success: false; error: Error };

const logBotFactoryError = (
  logger: LoggerService | undefined,
  message: string,
  error: unknown,
): void => {
  if (!logger) {
    return;
  }

  logger.error(message, {
    error: getErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
};

const validateBotFactoryConfig = (config: Config): void => {
  validateBotConfig(config);
};

export function createValidatedBotFactoryRuntimeSource(
  config: Config,
  options: BotFactoryOptions = {},
  logger?: LoggerService,
): IBotFactoryRuntimeSource {
  try {
    validateBotFactoryConfig(config);
  } catch (err) {
    logBotFactoryError(logger, 'Config validation failed', err);
    throw err;
  }

  const services = (() => {
    try {
      return buildBotFactoryServiceStateInternal(config);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logBotFactoryError(logger, 'Bot factory runtime-source initialization failed', err);

      throw new BotFactoryInitializationError(
        `Failed to initialize bot factory runtime source: ${errorMsg}`,
        { originalError: errorMsg },
      );
    }
  })();

  try {
    return finalizeBotFactoryServiceStateInternal(services, options);
  } catch (err) {
    if (logger) {
      logger.warn('Could not apply all DI overrides', {
        error: getErrorMessage(err),
      });
    }
    return createBotFactoryRuntimeSourceFromStateInternal(services);
  }
}

export function createSafeBotFactoryRuntimeSource(
  config: Config,
  options: BotFactoryOptions = {},
  logger?: LoggerService,
): SafeBotFactoryRuntimeSourceResult {
  try {
    const services = createValidatedBotFactoryRuntimeSource(config, options, logger);
    return { success: true, services };
  } catch (err) {
    const error = normalizeError(err);
    return { success: false, error };
  }
}

export class BotFactory {
  private static logError(logger: LoggerService | undefined, message: string, error: unknown): void {
    logBotFactoryError(logger, message, error);
  }

  private static validateConfig(config: Config): void {
    validateBotFactoryConfig(config);
  }

  static create(
    config: Config,
    options: BotFactoryOptions = {},
  ): IBotFactoryRuntimeSource {
    return createBotFactoryRuntimeSourceInternal(config, options);
  }

  static createWithValidation(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): IBotFactoryRuntimeSource {
    return createValidatedBotFactoryRuntimeSource(config, options, logger);
  }

  static createTestRuntimeSource(
    config: Config,
    mockServices: BotFactoryOptions = {},
  ): IBotFactoryRuntimeSource {
    return this.createWithValidation(config, mockServices);
  }

  static createSafe(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): SafeBotFactoryRuntimeSourceResult {
    return createSafeBotFactoryRuntimeSource(config, options, logger);
  }
}

/**
 * Side-effect-free services factory for composition roots and tests.
 * Builds the runtime source only; lifecycle startup remains explicit via initializer/start().
 */
export function createBotFactoryRuntimeSource(
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource {
  return BotFactory.create(config, options);
}

export type { BotFactoryOptions } from './factories/bot-factory-options';
export type { BotServiceState } from './bot-services.builder';
