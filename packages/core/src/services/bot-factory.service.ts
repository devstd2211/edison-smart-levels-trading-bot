/**
 * BotFactory - Dependency Injection Container
 *
 * Phase 5: Dependency Injection Enhancement
 * Phase 8.9.41: ErrorHandler Integration for config validation & service creation
 *
 * Manages creation and configuration of bot service state with proper DI and error handling.
 */

import { LoggerService } from './logger.service';
import { Config } from '../types/legacy';
import type { IBotFactoryRuntimeSource } from '../interfaces';
import { BotFactoryInitializationError } from '../errors/DomainErrors';
import type { BotFactoryOptions } from './factories/bot-factory-options';
import {
  buildBotFactoryServiceState as buildBotFactoryServiceStateInternal,
  createBotFactoryServiceState as createBotFactoryServiceStateInternal,
  finalizeBotFactoryServiceState as finalizeBotFactoryServiceStateInternal,
} from './factories/bot-service-state';
import { validateBotConfig } from './factories/bot-services.validate';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

export class BotFactory {
  private static logError(logger: LoggerService | undefined, message: string, error: unknown): void {
    if (!logger) {
      return;
    }

    logger.error(message, {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  private static validateConfig(config: Config): void {
    validateBotConfig(config);
  }

  static create(
    config: Config,
    options: BotFactoryOptions = {},
  ): IBotFactoryRuntimeSource {
    return createBotFactoryServiceStateInternal(config, options);
  }

  static createWithValidation(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): IBotFactoryRuntimeSource {
    try {
      this.validateConfig(config);
    } catch (err) {
      this.logError(logger, 'Config validation failed', err);
      throw err;
    }

    const services = (() => {
      try {
        return buildBotFactoryServiceStateInternal(config);
      } catch (err) {
        const errorMsg = getErrorMessage(err);
        this.logError(logger, 'Bot factory service-state initialization failed', err);

        throw new BotFactoryInitializationError(
          `Failed to initialize bot factory service state: ${errorMsg}`,
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
      return services;
    }
  }

  static createForTesting(
    config: Config,
    mockServices: BotFactoryOptions = {},
  ): IBotFactoryRuntimeSource {
    return this.createWithValidation(config, mockServices);
  }

  static createSafe(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): { success: true; services: IBotFactoryRuntimeSource } | { success: false; error: Error } {
    try {
      const services = this.createWithValidation(config, options, logger);
      return { success: true, services };
    } catch (err) {
      const error = normalizeError(err);
      return { success: false, error };
    }
  }
}

/**
 * Side-effect-free services factory for composition roots and tests.
 * Builds service state only; lifecycle startup remains explicit via initializer/start().
 */
export function createBotFactoryServiceState(
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource {
  return BotFactory.create(config, options);
}

export type { BotFactoryOptions } from './factories/bot-factory-options';
export type { BotServiceState } from './bot-services.builder';
