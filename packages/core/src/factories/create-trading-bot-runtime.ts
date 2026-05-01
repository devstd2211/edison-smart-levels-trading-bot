import type { Config } from '../types/legacy';
import type { IBotServicesAdapterSource } from '../interfaces';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
import { createTradingBotServiceBundle } from '../services/bot-services-adapter';
import { BotFactory as ServicesBotFactory } from '../services/bot-factory.service';

export type TradingBotRuntime = {
  bot: TradingBot;
  services: IBotServicesAdapterSource;
};

export const createTradingBotRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotRuntime => {
  const services = ServicesBotFactory.create(config, serviceOverrides ?? {});
  const serviceBundle = createTradingBotServiceBundle(services);

  return {
    bot: new TradingBot(serviceBundle, config),
    services,
  };
};
