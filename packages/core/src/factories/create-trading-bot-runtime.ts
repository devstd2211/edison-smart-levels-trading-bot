import type { Config } from '../types/legacy';
import type { IBotFactoryServiceSource } from '../interfaces';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
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

  return {
    bot: new TradingBot(runtimeDependencies, config),
    services,
  };
};
