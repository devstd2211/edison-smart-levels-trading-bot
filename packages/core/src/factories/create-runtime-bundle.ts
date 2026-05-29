import type {
  IBotRuntimeBundle,
  ITradingBotRuntimeDependencies,
  IBotRuntimeSource,
} from '../interfaces';
import { createTradingBotRuntimeDependencies } from '../services/runtime-service-adapters';

export type BotRuntimeBundle = IBotRuntimeBundle;

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
