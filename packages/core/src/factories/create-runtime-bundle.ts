import type { IWebApiAdapter } from '@edison/contracts';
import type {
  ITradingBotRuntimeDependencies,
  ITradingBotRuntimeDependencySource,
} from '../interfaces';
import { createWebApiAdapter } from '../api/create-web-api-adapter';
import { createTradingBotRuntimeDependencies } from '../services/bot-services-adapter';

export interface TradingBotRuntimeBundleArtifacts {
  runtimeDependencies: ITradingBotRuntimeDependencies;
  createWebApiAdapter(): IWebApiAdapter;
}

export const createRuntimeBundleArtifacts = (
  services: ITradingBotRuntimeDependencySource,
): TradingBotRuntimeBundleArtifacts => {
  const runtimeDependencies = createTradingBotRuntimeDependencies(services);

  return {
    runtimeDependencies,
    createWebApiAdapter: () => createWebApiAdapter(runtimeDependencies.webApiServices),
  };
};
