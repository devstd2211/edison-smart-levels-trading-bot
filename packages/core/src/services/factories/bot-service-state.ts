import type { Config } from '../../types/legacy';
import type { IBotServicesAdapterSource } from '../../interfaces';
import { buildBotServices, type BotServicesState } from '../bot-services.builder';
import { applyBotServiceOverrides } from './bot-services.overrides';
import type { BotFactoryOptions } from './bot-factory-options';

export const buildBotServiceState = (
  config: Config,
): BotServicesState => {
  return buildBotServices(config);
};

export const finalizeBotServiceState = (
  services: BotServicesState,
  options: BotFactoryOptions = {},
): IBotServicesAdapterSource => {
  applyBotServiceOverrides(services, options);
  return services;
};

export const createBotServices = (
  config: Config,
  options: BotFactoryOptions = {},
): IBotServicesAdapterSource => {
  return finalizeBotServiceState(buildBotServiceState(config), options);
};
