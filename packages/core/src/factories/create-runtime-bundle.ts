import type { IWebApiAdapter } from '@edison/contracts';
import type {
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces';
import { createWebApiAdapter } from '../api/create-web-api-adapter';
import { createTradingBotRuntimeDependencies } from '../services/bot-services-adapter';

export interface BotRuntimeBundle {
  runtimeDependencies: ITradingBotRuntimeDependencies;
  webApiAdapter: IWebApiAdapter;
}

export const createBotRuntimeBundle = (
  services: IBotRuntimeSource,
): BotRuntimeBundle => {
  const runtimeDependencies = createTradingBotRuntimeDependencies(services);

  return {
    runtimeDependencies,
    webApiAdapter: createWebApiAdapter(runtimeDependencies.webApiServices),
  };
};
