/**
 * Config-aware core helper runtime boundary.
 *
 * Keeps configured helper orchestration behind `@edison/core/core` while the
 * publishable loader-contract aliases remain owned by `@edison/core/config`.
 * `loadBotRuntimeConfig(loader?)` is the single injected config-loader seam for
 * create/start helpers that need validated runtime config.
 */

import type { Config } from '../types/legacy';
import type { ConfigPipelineLoader } from '../config/index';
import type { ITradingBotRuntime } from '../interfaces';

export type CoreRuntimeConfigAction<TResult> = (
  config: Config,
) => Promise<TResult>;

export type CoreRuntimeConfigLoader = (
  loader?: ConfigPipelineLoader,
) => Promise<Config>;

export type CoreEntrypointRuntime = Pick<ITradingBotRuntime, 'bot' | 'webApiAdapter'>;

export function createCoreEntrypointRuntime(
  runtime: ITradingBotRuntime,
): CoreEntrypointRuntime {
  return {
    bot: runtime.bot,
    webApiAdapter: runtime.webApiAdapter,
  };
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
