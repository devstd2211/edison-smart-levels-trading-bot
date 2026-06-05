import type { Config } from '../types/legacy';
import type {
  IBotRuntimeSource,
  ITradingBotFactoryRuntime,
  ITradingBotRuntime,
} from '../interfaces/runtime-contracts';
import type { BotFactoryOptions } from '../services/factories/bot-factory-options';
import { TradingBot } from '../bot';
import { ICONS } from '../cli/cli-runtime';
import { createBotRuntimeBundle } from './create-runtime-bundle';
import { BotFactory as ServicesBotFactory } from '../services/bot-factory.service';

export type TradingBotFactoryRuntime = ITradingBotFactoryRuntime;
export type TradingBotRuntime = ITradingBotRuntime;

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

export const createTradingBotRuntimeFromRuntimeSource = (
  runtimeSource: IBotRuntimeSource,
  config: Config,
): TradingBotRuntime => {
  return createTradingBotRuntimeFromFactoryRuntime(
    {
      runtimeSource,
      runtimeBundle: createBotRuntimeBundle(runtimeSource),
    },
    config,
  );
};

export const createTradingBotRuntimeFromFactoryRuntime = (
  factoryRuntime: TradingBotFactoryRuntime,
  config: Config,
): TradingBotRuntime => {
  factoryRuntime.runtimeSource.coreServices.logger.info(
    `${ICONS.robot} TradingBot created successfully via BotFactory`,
  );

  return {
    bot: new TradingBot(factoryRuntime.runtimeBundle.runtimeDependencies, config),
    runtimeSource: factoryRuntime.runtimeSource,
    runtimeBundle: factoryRuntime.runtimeBundle,
    webApiAdapter: factoryRuntime.runtimeBundle.webApiAdapter,
  };
};

export const createTradingBotRuntime = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBotRuntime => {
  return createTradingBotRuntimeFromFactoryRuntime(
    createTradingBotFactoryRuntime(
      config,
      serviceOverrides,
    ),
    config,
  );
};

export const createTradingBot = (
  config: Config,
  serviceOverrides?: BotFactoryOptions,
): TradingBot => createTradingBotRuntime(config, serviceOverrides).bot;
