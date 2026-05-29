import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type {
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces';
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

export const createBotRuntimeBundleFromDependencies = (
  runtimeDependencies: ITradingBotRuntimeDependencies,
): BotRuntimeBundle => ({
  runtimeDependencies,
  webApiAdapter: runtimeDependencies.readAdapters.webApiAdapter,
});

export const createBotRuntimeBundle = (
  runtimeSource: IBotRuntimeSource,
): BotRuntimeBundle => {
  return createBotRuntimeBundleFromDependencies(
    createBotRuntimeDependencies(runtimeSource),
  );
};
