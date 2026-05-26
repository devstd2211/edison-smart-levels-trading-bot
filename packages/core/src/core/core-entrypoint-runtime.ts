/**
 * Shared config-aware core helper runtime.
 *
 * Threads the dedicated config-entrypoint loader contract through the non-CLI
 * helper surface without turning `@edison/core/core` into another config barrel.
 * `loadBotRuntimeConfig(loader?)` stays as the public loader seam for configured helper paths.
 */

import type { Config } from '../types/legacy';
import type { ConfigPipelineLoader } from '../config/index';

type ConfiguredCoreAction<TResult> = (config: Config) => Promise<TResult>;

export type CoreRuntimeConfigLoader = (
  loader?: ConfigPipelineLoader,
) => Promise<Config>;

export async function startBotWithRuntimeConfig<BotLike>(
  config: Config,
  createBot: (nextConfig: Config) => Promise<BotLike & { start(): Promise<void> }>,
): Promise<BotLike> {
  const bot = await createBot(config);
  await bot.start();
  return bot;
}

export async function withLoadedRuntimeConfig<TResult>(
  action: ConfiguredCoreAction<TResult>,
  loadRuntimeConfig: CoreRuntimeConfigLoader,
  loader?: ConfigPipelineLoader,
): Promise<TResult> {
  const config = await loadRuntimeConfig(loader);
  return action(config);
}
