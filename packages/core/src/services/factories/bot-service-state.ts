import type { Config } from '../../types/legacy';
import type { IBotFactoryRuntimeSource } from '../../interfaces';
import { buildBotServiceState as buildRawBotServiceState, type BotServiceState } from '../bot-services.builder';
import { applyBotServiceOverrides } from './bot-services.overrides';
import type { BotFactoryOptions } from './bot-factory-options';

export const buildBotFactoryServiceState = (
  config: Config,
): BotServiceState => {
  return buildRawBotServiceState(config);
};

export const finalizeBotFactoryServiceState = (
  services: BotServiceState,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource => {
  applyBotServiceOverrides(services, options);
  return services;
};

export const createBotFactoryServiceState = (
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource => {
  return finalizeBotFactoryServiceState(buildBotFactoryServiceState(config), options);
};
