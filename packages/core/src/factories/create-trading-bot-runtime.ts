import type { Config } from '../types/legacy';
import type { IBotFactoryRuntimeSource } from '../interfaces';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
import { ICONS } from '../cli/cli-runtime';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import { createBotRuntimeBundle } from './create-runtime-bundle';
import { BotFactory as ServicesBotFactory } from '../services/bot-factory.service';
import type { BotRuntimeBundle } from './create-runtime-bundle';

export type TradingBotFactoryRuntime = {
  runtimeSource: IBotFactoryRuntimeSource;
  runtimeBundle: BotRuntimeBundle;
};

export type TradingBotRuntime = {
  bot: TradingBot;
  runtimeSource: IBotFactoryRuntimeSource;
  webApiAdapter: IWebApiAdapter;
};

export const createTradingBotFactoryRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotFactoryRuntime => {
  const runtimeSource = ServicesBotFactory.create(config, serviceOverrides ?? {});

  return {
    runtimeSource,
    runtimeBundle: createBotRuntimeBundle(runtimeSource),
  };
};

export const createTradingBotRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotRuntime => {
  const { runtimeSource, runtimeBundle } = createTradingBotFactoryRuntime(
    config,
    serviceOverrides,
  );
  runtimeSource.coreServices.logger.info(`${ICONS.robot} TradingBot created successfully via BotFactory`);

  return {
    bot: new TradingBot(runtimeBundle.runtimeDependencies, config),
    runtimeSource,
    webApiAdapter: runtimeBundle.webApiAdapter,
  };
};

export const createTradingBot = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBot => createTradingBotRuntime(config, serviceOverrides).bot;
