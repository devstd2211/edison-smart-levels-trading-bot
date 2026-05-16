import type { Config } from '../types/legacy';
import type { IBotFactoryRuntimeSource } from '../interfaces';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
import { ICONS } from '../cli/cli-runtime';
import type { IWebApiAdapter } from '@edison/contracts';
import { createBotRuntimeBundle } from './create-runtime-bundle';
import { BotFactory as ServicesBotFactory } from '../services/bot-factory.service';

export type TradingBotRuntime = {
  bot: TradingBot;
  runtimeSource: IBotFactoryRuntimeSource;
  webApiAdapter: IWebApiAdapter;
};

export const createTradingBotRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotRuntime => {
  const runtimeSource = ServicesBotFactory.create(config, serviceOverrides ?? {});
  const runtimeBundle = createBotRuntimeBundle(runtimeSource);
  runtimeSource.coreServices.logger.info(`${ICONS.robot} TradingBot created successfully via BotFactory`);

  return {
    bot: new TradingBot({
      ...runtimeBundle.runtimeDependencies,
      webApiAdapter: runtimeBundle.webApiAdapter,
    }, config),
    runtimeSource,
    webApiAdapter: runtimeBundle.webApiAdapter,
  };
};

export const createTradingBot = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBot => createTradingBotRuntime(config, serviceOverrides).bot;
