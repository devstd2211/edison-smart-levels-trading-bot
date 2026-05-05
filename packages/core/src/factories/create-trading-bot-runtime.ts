import type { Config } from '../types/legacy';
import type { IBotFactoryServiceSource } from '../interfaces';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
import { ICONS } from '../cli/cli-runtime';
import { createTradingBotRuntimeDependencies } from '../services/bot-services-adapter';
import { BotFactory as ServicesBotFactory } from '../services/bot-factory.service';

export type TradingBotRuntime = {
  bot: TradingBot;
  services: IBotFactoryServiceSource;
};

export const createTradingBotRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotRuntime => {
  const services = ServicesBotFactory.create(config, serviceOverrides ?? {});
  const runtimeDependencies = createTradingBotRuntimeDependencies(services);
  services.coreServices.logger.info(`${ICONS.robot} TradingBot created successfully via BotFactory`);

  return {
    bot: new TradingBot(runtimeDependencies, config),
    services,
  };
};

export const createTradingBot = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBot => createTradingBotRuntime(config, serviceOverrides).bot;
