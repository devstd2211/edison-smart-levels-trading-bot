/**
 * Core entrypoint
 *
 * Creates the trading bot without CLI concerns.
 */

import type { Config } from '../types/legacy';
import type { BotFactoryRuntime } from '../bot-factory';
import type { TradingBotAppApi } from '../types/trading-bot';
import { BotFactory } from '../bot-factory';
import {
  loadRuntimeConfig,
  loadValidatedConfig,
  type ConfigPipelineLoader,
} from '../config/index';

export type BotLike = TradingBotAppApi;

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function createBotRuntime(config: Config): Promise<BotFactoryRuntime> {
  return BotFactory.createRuntime(config);
}

export async function startBot(config: Config): Promise<BotLike> {
  const bot = await createBot(config);
  await bot.start();
  return bot;
}

export async function loadBotRuntimeConfig(
  loader?: ConfigPipelineLoader,
): Promise<Config> {
  return loader ? loadRuntimeConfig(loader) : loadValidatedConfig();
}

export async function createConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return createBot(await loadBotRuntimeConfig(loader));
}

export async function createConfiguredBotRuntime(
  loader?: ConfigPipelineLoader,
): Promise<BotFactoryRuntime> {
  return createBotRuntime(await loadBotRuntimeConfig(loader));
}

export async function startConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return startBot(await loadBotRuntimeConfig(loader));
}
