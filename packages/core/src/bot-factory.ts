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
import { createTradingBotRuntime } from './factories/create-trading-bot-runtime';
import {
  createServices as createServiceState,
  type BotFactoryOptions,
} from './services/bot-factory.service';
import type { IBotFactoryServiceSource } from './interfaces';
import type { TradingBot } from './bot';

export interface BotFactoryConfig {
  // Config should be pre-processed by ConfigPipeline (strategy merge + env overrides).
  config: Config;
}

type CreateTradingBotResult = {
  bot: TradingBot;
  services: IBotFactoryServiceSource;
};

/**
 * Factory for creating TradingBot instances
 */
export class BotFactory {
  private static createTradingBot(
    config: Config,
    serviceOverrides?: BotFactoryOptions,
  ): CreateTradingBotResult {
    return createTradingBotRuntime(config, serviceOverrides);
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

    const { bot, services } = this.createTradingBot(config);

    // 4. Log successful creation
    services.coreServices.logger.info('🤖 TradingBot created successfully via BotFactory');

    return bot;
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
    return this.createTradingBot(config, serviceOverrides).bot;
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
    factoryConfig: BotFactoryConfig
  ): Promise<{ bot: TradingBot; emitter: BotEventEmitter }> {
    const bot = await this.create(factoryConfig);
    const emitter = new BotEventEmitter(bot.eventBus);
    emitter.start();
    return { bot, emitter };
  }

  /**
   * Get services without creating bot
   *
   * Useful for direct service access in tests or standalone usage.
   *
   * @param config - Configuration for services
   * @returns Initialized services state
   */
  static createServices(
    config: Config,
    serviceOverrides?: BotFactoryOptions,
  ): IBotFactoryServiceSource {
    return createServiceState(config, serviceOverrides);
  }
}
