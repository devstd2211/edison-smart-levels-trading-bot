/**
 * Stable non-CLI core entrypoint.
 *
 * Keeps programmatic bot creation and config-aware runtime helpers on one
 * focused package surface without pulling callers into CLI or source-path details.
 * Re-exports the composed ConfigPipelineLoader type from the dedicated config barrel.
 * The lower-level loader-contract aliases stay on `@edison/core/config`.
 * Config-aware callers can stay on this entrypoint when that single convenience type is useful.
 */

import type { Config } from '../types/legacy';
import type { TradingBotAppApi } from '../types/trading-bot';
import { BotFactory } from '../bot-factory';
import {
  loadOptionalRuntimeConfig,
  type ConfigPipelineLoader,
} from '../config/index';
import {
  createCoreEntrypointRuntime,
  type CoreEntrypointRuntime,
  startBotWithRuntimeConfig,
  withLoadedRuntimeConfig,
} from './core-entrypoint-runtime';

export type BotLike = TradingBotAppApi;
export type { ConfigPipelineLoader };

export const CORE_ENTRYPOINT_EXPORT_NAMES = [
  'CORE_ENTRYPOINT_EXPORT_NAMES',
  'createBot',
  'createBotRuntime',
  'createConfiguredBot',
  'createConfiguredBotRuntime',
  'loadBotRuntimeConfig',
  'startBot',
  'startConfiguredBot',
] as const;

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function createBotRuntime(
  config: Config,
): Promise<CoreEntrypointRuntime> {
  return createCoreEntrypointRuntime(BotFactory.createRuntime(config));
}

export async function startBot(config: Config): Promise<BotLike> {
  return startBotWithRuntimeConfig(config, createBot);
}

export async function loadBotRuntimeConfig(
  loader?: ConfigPipelineLoader,
): Promise<Config> {
  return loadOptionalRuntimeConfig(loader);
}

// Reuses the same public config-loader handoff for all config-aware helper paths.
async function runWithLoadedRuntimeConfig<TResult>(
  action: (config: Config) => Promise<TResult>,
  loader?: ConfigPipelineLoader,
): Promise<TResult> {
  return withLoadedRuntimeConfig(action, loadBotRuntimeConfig, loader);
}

export async function createConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return runWithLoadedRuntimeConfig(createBot, loader);
}

export async function createConfiguredBotRuntime(
  loader?: ConfigPipelineLoader,
): Promise<CoreEntrypointRuntime> {
  return runWithLoadedRuntimeConfig(createBotRuntime, loader);
}

export async function startConfiguredBot(
  loader?: ConfigPipelineLoader,
): Promise<BotLike> {
  return runWithLoadedRuntimeConfig(startBot, loader);
}
