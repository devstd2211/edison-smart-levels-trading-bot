import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type {
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces';
import { createWebApiAdapter } from '../api/create-web-api-adapter';
import { createTradingBotRuntimeDependencies } from '../services/runtime-service-adapters';

export interface BotRuntimeBundle {
  runtimeDependencies: ITradingBotRuntimeDependencies;
  webApiAdapter: IWebApiAdapter;
}

export const createBotRuntimeDependencies = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencies => {
  return createTradingBotRuntimeDependencies(runtimeSource);
};

export const createBotRuntimeBundle = (
  runtimeSource: IBotRuntimeSource,
): BotRuntimeBundle => {
  const runtimeDependencies = createBotRuntimeDependencies(runtimeSource);

  return {
    runtimeDependencies,
    webApiAdapter: createWebApiAdapter(runtimeDependencies.webApiServices),
  };
};
