import type {
  IBotRuntimeBundle,
  ITradingBotReadAdapters,
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces/runtime-contracts';
import { createTradingBotRuntimeDependencies } from '../services/runtime-service-adapters';

export type BotRuntimeBundle = IBotRuntimeBundle;
export type BotRuntimeReadApi = Pick<IBotRuntimeBundle, 'webApiAdapter'>;

export const createBotRuntimeDependencies = (
  runtimeSource: IBotRuntimeSource,
): ITradingBotRuntimeDependencies => {
  return createTradingBotRuntimeDependencies(runtimeSource);
};

export const createBotRuntimeReadApi = (
  readAdapters: ITradingBotReadAdapters,
): BotRuntimeReadApi => ({
  webApiAdapter: readAdapters.webApiAdapter,
});

export const createBotRuntimeBundleFromDependencies = (
  runtimeDependencies: ITradingBotRuntimeDependencies,
): BotRuntimeBundle => ({
  runtimeDependencies,
  ...createBotRuntimeReadApi(runtimeDependencies.readAdapters),
});

export const createBotRuntimeBundle = (
  runtimeSource: IBotRuntimeSource,
): BotRuntimeBundle => {
  return createBotRuntimeBundleFromDependencies(
    createBotRuntimeDependencies(runtimeSource),
  );
};
