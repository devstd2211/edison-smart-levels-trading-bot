import type { Config } from '../../types/legacy';
import type { IBotFactoryServiceSource } from '../../interfaces';
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
): IBotFactoryServiceSource => {
  applyBotServiceOverrides(services, options);
  return services;
};

export const createBotFactoryServiceState = (
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryServiceSource => {
  return finalizeBotFactoryServiceState(buildBotFactoryServiceState(config), options);
};

export const buildBotServiceState = buildBotFactoryServiceState;
export const finalizeBotServiceState = finalizeBotFactoryServiceState;
export const createBotServiceState = createBotFactoryServiceState;
