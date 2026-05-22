import { BotWebAPI } from './bot-web-api';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type { IWebApiReadServices } from '../interfaces';

export const createWebApiAdapter = (
  services: IWebApiReadServices,
): IWebApiAdapter => {
  return new BotWebAPI(services);
};
