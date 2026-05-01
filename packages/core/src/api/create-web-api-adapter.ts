import { BotWebAPI } from './bot-web-api';
import { createWebApiReadServices } from '../services/containers/web-api-read-services';
import type { IWebApiAdapter } from 'trading-bot-web-server';
import type { ITradingBotServices } from '../interfaces';

export const createWebApiAdapter = (
  services: ITradingBotServices,
): IWebApiAdapter => {
  return new BotWebAPI(createWebApiReadServices(services));
};
