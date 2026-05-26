/**
 * Legacy compatibility wrapper.
 *
 * Delegates to the dedicated CLI entrypoint while the stable programmatic surface
 * lives in `src/core`, and relies on the shared standalone if-main helper for direct execution.
 */

import { main } from './cli';
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
export { main };
export type { ConfigPipelineLoader } from './config/index';
export { runLegacyCliEntrypoint };

// Start the CLI only when this legacy wrapper is executed directly via the shared standalone if-main helper.
void runLegacyCliEntrypointIfMain(module);
