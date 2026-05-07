import type { IWebApiAdapter } from '@edison/contracts';
import type {
  ITradingBotRuntimeDependencies,
  ITradingBotRuntimeDependencySource,
} from '../interfaces';
import { createWebApiAdapter } from '../api/create-web-api-adapter';
import { createTradingBotRuntimeDependencies } from '../services/bot-services-adapter';

export interface TradingBotRuntimeBundle {
  runtimeDependencies: ITradingBotRuntimeDependencies;
  webApiAdapter: IWebApiAdapter;
}

export type TradingBotRuntimeBundleArtifacts = TradingBotRuntimeBundle;

export const createRuntimeBundle = (
  services: ITradingBotRuntimeDependencySource,
): TradingBotRuntimeBundle => {
  const runtimeDependencies = createTradingBotRuntimeDependencies(services);

  return {
    runtimeDependencies,
    webApiAdapter: createWebApiAdapter(runtimeDependencies.webApiServices),
  };
};
