import { BotWebAPI } from './bot-web-api';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type { IBotWebApiRuntimeServices } from '../interfaces';

export const createWebApiAdapter = (
  services: IBotWebApiRuntimeServices,
): IWebApiAdapter => {
  return new BotWebAPI(services);
};
