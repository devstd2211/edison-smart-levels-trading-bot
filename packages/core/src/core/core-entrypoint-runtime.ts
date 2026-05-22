import type { Config } from '../types/legacy';
import type { ConfigPipelineLoader } from '../config/index';

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
  action: (config: Config) => Promise<TResult>,
  loadRuntimeConfig: CoreRuntimeConfigLoader,
  loader?: ConfigPipelineLoader,
): Promise<TResult> {
  const config = await loadRuntimeConfig(loader);
  return action(config);
}
