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
  loadOptionalRuntimeConfig,
  type ConfigPipelineLoader,
} from '../config/index';
import {
  startBotWithRuntimeConfig,
  withLoadedRuntimeConfig,
} from './core-entrypoint-runtime';

export type BotLike = TradingBotAppApi;
export type { ConfigPipelineLoader };

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function createBotRuntime(config: Config): Promise<BotFactoryRuntime> {
  return BotFactory.createRuntime(config);
}

export async function startBot(config: Config): Promise<BotLike> {
  return startBotWithRuntimeConfig(config, createBot);
}

export async function loadBotRuntimeConfig(
  loader?: ConfigPipelineLoader,
): Promise<Config> {
  return loadOptionalRuntimeConfig(loader);
}

export async function createConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return withLoadedRuntimeConfig(createBot, loadBotRuntimeConfig, loader);
}

export async function createConfiguredBotRuntime(
  loader?: ConfigPipelineLoader,
): Promise<BotFactoryRuntime> {
  return withLoadedRuntimeConfig(createBotRuntime, loadBotRuntimeConfig, loader);
}

export async function startConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return withLoadedRuntimeConfig(startBot, loadBotRuntimeConfig, loader);
}
