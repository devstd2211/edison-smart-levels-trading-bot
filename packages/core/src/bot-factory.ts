/**
 * BotFactory - Factory Pattern for TradingBot Creation
 *
 * Centralized factory for creating TradingBot instances.
 * Handles:
 * - Configuration loading and validation
 * - Service initialization via DI container
 * - Bot instantiation with all dependencies
 *
 * Benefits:
 * - Single point of bot creation
 * - Clear dependency graph
 * - Easy to mock for testing
 * - Easy to add pre/post-creation hooks
 */

import type { Config } from './types/legacy';
import { BotEventEmitter } from './bot-event-emitter';
import { createTradingBot } from './factories/create-trading-bot-runtime';
import {
  createBotRuntimeBundle,
  type BotRuntimeBundle,
} from './factories/create-runtime-bundle';
import {
  createBotFactoryServiceState,
  type BotFactoryOptions,
} from './services/bot-factory.service';
import type { TradingBot } from './bot';

export interface BotFactoryConfig {
  // Config should be pre-processed by ConfigPipeline (strategy merge + env overrides).
  config: Config;
}

export type BotFactoryRuntimeBundle = BotRuntimeBundle;

/**
 * Factory for creating TradingBot instances
 */
export class BotFactory {
  private static createTradingBot(
    config: Config,
    serviceOverrides?: BotFactoryOptions,
  ): TradingBot {
    return createTradingBot(config, serviceOverrides);
  }

  /**
   * Create a new TradingBot instance with all dependencies
   *
   * @param factoryConfig - Configuration for bot creation
   * @returns Initialized TradingBot instance
   *
   * @example
   * const config = loadConfig('config.json');
   * const bot = await BotFactory.create({ config });
   * await bot.start();
   */
  static async create(factoryConfig: BotFactoryConfig): Promise<TradingBot> {
    const { config } = factoryConfig;
    return this.createTradingBot(config);
  }

  /**
   * Create a TradingBot instance for testing
   *
   * Useful for unit tests where you want to mock specific services.
   *
   * @param config - Configuration for bot
   * @param serviceOverrides - Services to override (for testing)
   * @returns Initialized TradingBot instance with overridden services
   *
   * @example
   * const mockBybitService = mock(BybitService);
   * const bot = BotFactory.createForTesting(config, {
   *   bybitService: mockBybitService
   * });
   */
  static createForTesting(
    config: Config,
    serviceOverrides?: BotFactoryOptions,
  ): TradingBot {
    return this.createTradingBot(config, serviceOverrides);
  }

  /**
   * Create the narrowed runtime bundle without exposing the broader service state.
   *
   * Preferred for composition roots and tests that need runtime collaborators
   * or the read-only web API adapter without constructing a TradingBot.
   */
  static createBotRuntimeBundle(
    config: Config,
    serviceOverrides?: BotFactoryOptions,
  ): BotFactoryRuntimeBundle {
    const services = createBotFactoryServiceState(config, serviceOverrides);
    const runtimeBundle = createBotRuntimeBundle(services);

    return {
      runtimeDependencies: runtimeBundle.runtimeDependencies,
      webApiAdapter: runtimeBundle.webApiAdapter,
    };
  }

  /**
   * Create a TradingBot with event emitter adapter
   *
   * Recommended approach for applications that need event API.
   * Returns both bot (for trading) and emitter (for events).
   *
   * @param factoryConfig - Configuration for bot creation
   * @returns Promise resolving to object with bot and emitter
   *
   * @example
   * const { bot, emitter } = await BotFactory.createWithEmitter({ config });
   * emitter.on('signal', (signal) => { });
   * await bot.start();
   */
  static async createWithEmitter(
    factoryConfig: BotFactoryConfig,
  ): Promise<{ bot: TradingBot; emitter: BotEventEmitter }> {
    const bot = await this.create(factoryConfig);
    const emitter = new BotEventEmitter(bot.eventBus);
    emitter.start();
    return { bot, emitter };
  }
}
