/**
 * Config-aware core helper runtime boundary.
 *
 * Keeps the concrete core helper implementations behind one runtime boundary,
 * while `packages/core/src/core/index.ts` stays a thin public barrel.
 * The publishable loader-contract aliases remain owned by `@edison/core/config`.
 * `loadBotRuntimeConfig(loader?)` is the single injected config-loader seam for
 * create/start helpers that need validated runtime config.
 */

import { BotFactory } from '../bot-factory';
import {
  loadOptionalRuntimeConfig,
  type ConfigPipelineLoader,
} from '../config/index';
import type { Config } from '../types/legacy';
import type { TradingBotAppApi } from '../types/trading-bot';
import type { ITradingBotRuntime } from '../interfaces';

export type BotLike = TradingBotAppApi;
export type CoreRuntimeConfigAction<TResult> = (
  config: Config,
) => Promise<TResult>;

export type CoreRuntimeConfigLoader = (
  loader?: ConfigPipelineLoader,
) => Promise<Config>;

export type CoreEntrypointRuntime = Readonly<
  Pick<ITradingBotRuntime, 'bot' | 'webApiAdapter'>
>;

export const CORE_ENTRYPOINT_EXPORT_NAMES = Object.freeze([
  'CORE_ENTRYPOINT_EXPORT_NAMES',
  'createBot',
  'createBotRuntime',
  'createConfiguredBot',
  'createConfiguredBotRuntime',
  'loadBotRuntimeConfig',
  'startBot',
  'startConfiguredBot',
] as const);

export function createCoreEntrypointRuntime(
  runtime: ITradingBotRuntime,
): CoreEntrypointRuntime {
  return Object.freeze({
    bot: runtime.bot,
    webApiAdapter: runtime.webApiAdapter,
  });
}

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function createBotRuntime(
  config: Config,
): Promise<CoreEntrypointRuntime> {
  return createCoreEntrypointRuntime(BotFactory.createRuntime(config));
}

export async function startBotWithRuntimeConfig<BotLike>(
  config: Config,
  createBot: (nextConfig: Config) => Promise<BotLike & { start(): Promise<void> }>,
): Promise<BotLike> {
  const bot = await createBot(config);
  await bot.start();
  return bot;
}

export async function withLoadedRuntimeConfig<TResult>(
  action: CoreRuntimeConfigAction<TResult>,
  loadRuntimeConfig: CoreRuntimeConfigLoader,
  loader?: ConfigPipelineLoader,
): Promise<TResult> {
  const config = await loadRuntimeConfig(loader);
  return action(config);
}

export async function startBot(config: Config): Promise<BotLike> {
  return startBotWithRuntimeConfig(config, createBot);
}

export async function loadBotRuntimeConfig(
  loader?: ConfigPipelineLoader,
): Promise<Config> {
  return loadOptionalRuntimeConfig(loader);
}

type ConfiguredCoreEntrypointHelpers = Readonly<{
  createConfiguredBot: (loader?: ConfigPipelineLoader) => Promise<BotLike>;
  createConfiguredBotRuntime: (
    loader?: ConfigPipelineLoader,
  ) => Promise<CoreEntrypointRuntime>;
  startConfiguredBot: (loader?: ConfigPipelineLoader) => Promise<BotLike>;
}>;

// Reuses the same public config-loader handoff for all config-aware helper paths.
function createConfiguredCoreEntrypointHelpers(
  loadRuntimeConfig: CoreRuntimeConfigLoader = loadBotRuntimeConfig,
): ConfiguredCoreEntrypointHelpers {
  const runWithLoadedRuntimeConfig = <TResult>(
    action: (config: Config) => Promise<TResult>,
    loader?: ConfigPipelineLoader,
  ): Promise<TResult> => withLoadedRuntimeConfig(action, loadRuntimeConfig, loader);

  return Object.freeze({
    createConfiguredBot: (
      loader?: ConfigPipelineLoader,
    ): Promise<BotLike> => runWithLoadedRuntimeConfig(createBot, loader),
    createConfiguredBotRuntime: (
      loader?: ConfigPipelineLoader,
    ): Promise<CoreEntrypointRuntime> => runWithLoadedRuntimeConfig(createBotRuntime, loader),
    startConfiguredBot: (
      loader?: ConfigPipelineLoader,
    ): Promise<BotLike> => runWithLoadedRuntimeConfig(startBot, loader),
  });
}

const configuredCoreEntrypointHelpers = createConfiguredCoreEntrypointHelpers();

export async function createConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return configuredCoreEntrypointHelpers.createConfiguredBot(loader);
}

export async function createConfiguredBotRuntime(
  loader?: ConfigPipelineLoader,
): Promise<CoreEntrypointRuntime> {
  return configuredCoreEntrypointHelpers.createConfiguredBotRuntime(loader);
}

export async function startConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return configuredCoreEntrypointHelpers.startConfiguredBot(loader);
}
