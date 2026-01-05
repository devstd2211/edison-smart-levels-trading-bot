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

import { Config } from './types';
import { TradingBot } from './bot';
import { BotEventEmitter } from './bot-event-emitter';
import { BotServices } from './services/bot-services';

export interface BotFactoryConfig {
  config: Config;
}

/**
 * Factory for creating TradingBot instances
 */
export class BotFactory {
  /**
   * Create a new TradingBot instance with all dependencies
   *
   * @param factoryConfig - Configuration for bot creation
   * @returns Initialized TradingBot instance
   *
   * @example
   * const config = loadConfig('config.json');
   * const bot = BotFactory.create({ config });
   * await bot.start();
   */
  static create(factoryConfig: BotFactoryConfig): TradingBot {
    const { config } = factoryConfig;

    // 1. Initialize all services in dependency order
    const services = new BotServices(config);

    // 2. Create bot with injected dependencies
    const bot = new TradingBot(services, config);

    // 3. Log successful creation
    services.logger.info('🤖 TradingBot created successfully via BotFactory');

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
    serviceOverrides?: Partial<BotServices>,
  ): TradingBot {
    // Create services normally
    const services = new BotServices(config);

    // Override specific services for testing
    if (serviceOverrides) {
      Object.assign(services, serviceOverrides);
    }

    return new TradingBot(services, config);
  }

  /**
   * Create a TradingBot with event emitter adapter
   *
   * Recommended approach for applications that need event API.
   * Returns both bot (for trading) and emitter (for events).
   *
   * @param factoryConfig - Configuration for bot creation
   * @returns Object with bot and emitter
   *
   * @example
   * const { bot, emitter } = BotFactory.createWithEmitter({ config });
   * emitter.on('signal', (signal) => { });
   * await bot.start();
   */
  static createWithEmitter(
    factoryConfig: BotFactoryConfig
  ): { bot: TradingBot; emitter: BotEventEmitter } {
    const bot = this.create(factoryConfig);
    const emitter = new BotEventEmitter(bot.eventBus);
    return { bot, emitter };
  }

  /**
   * Get services without creating bot
   *
   * Useful for direct service access in tests or standalone usage.
   *
   * @param config - Configuration for services
   * @returns Initialized BotServices container
   */
  static createServices(config: Config): BotServices {
    return new BotServices(config);
  }
}
