import { BotWebAPI } from './bot-web-api';
import { createWebApiReadServices } from '../services/containers/web-api-read-services';
import type { IWebApiAdapter } from '@edison/contracts';
import type { IWebApiReadServices } from '../interfaces';

export const createWebApiAdapter = (
  services: IWebApiReadServices,
): IWebApiAdapter => {
  return new BotWebAPI(createWebApiReadServices(services));
};
