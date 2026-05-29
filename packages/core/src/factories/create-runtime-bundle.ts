import type {
  IBotRuntimeBundle,
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces';
import { createTradingBotRuntimeDependencies } from '../services/runtime-service-adapters';

export type BotRuntimeBundle = IBotRuntimeBundle;
export type BotRuntimeReadApi = Pick<IBotRuntimeBundle, 'webApiAdapter'>;

export const createBotRuntimeDependencies = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencies => {
  return createTradingBotRuntimeDependencies(runtimeSource);
};

export const createBotRuntimeReadApi = (
  runtimeDependencies: Pick<ITradingBotRuntimeDependencies, 'readAdapters'>,
): BotRuntimeReadApi => ({
  webApiAdapter: runtimeDependencies.readAdapters.webApiAdapter,
});

export const createBotRuntimeBundleFromDependencies = (
  runtimeDependencies: ITradingBotRuntimeDependencies,
): BotRuntimeBundle => ({
  runtimeDependencies,
  ...createBotRuntimeReadApi(runtimeDependencies),
});

export const createBotRuntimeBundle = (
  runtimeSource: IBotRuntimeSource,
): BotRuntimeBundle => {
  return createBotRuntimeBundleFromDependencies(
    createBotRuntimeDependencies(runtimeSource),
  );
};
