/**
 * Legacy entrypoint (wrapper).
 *
 * Delegates to CLI entrypoint while core entrypoint lives in `src/core`.
 */

import {
  runLegacyCliEntrypoint,
  runLegacyCliEntrypointIfMain,
} from './legacy-entrypoint-runtime';

export {
  createBot,
  createBotRuntime,
  createConfiguredBot,
  createConfiguredBotRuntime,
  loadBotRuntimeConfig,
  startBot,
  startConfiguredBot,
} from './core';
export { BotFactory } from './bot-factory';
export type { BotFactoryRuntime, BotFactoryRuntimeBundle } from './bot-factory';
export { main } from './cli';
export type { ConfigPipelineLoader } from './config/index';
export { runLegacyCliEntrypoint };

// Start the CLI by default only when this legacy wrapper is executed directly.
void runLegacyCliEntrypointIfMain(module, require.main);
