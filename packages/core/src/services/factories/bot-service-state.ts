import type { Config } from '../../types/legacy';
import type { IBotFactoryServiceSource } from '../../interfaces';
import { buildBotServices, type BotServiceState } from '../bot-services.builder';
import { applyBotServiceOverrides } from './bot-services.overrides';
import type { BotFactoryOptions } from './bot-factory-options';

export const buildBotServiceState = (
  config: Config,
): BotServiceState => {
  return buildBotServices(config);
};

export const finalizeBotServiceState = (
  services: BotServiceState,
  options: BotFactoryOptions = {},
): IBotFactoryServiceSource => {
  applyBotServiceOverrides(services, options);
  return services;
};

export const createBotServiceState = (
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryServiceSource => {
  return finalizeBotServiceState(buildBotServiceState(config), options);
};
