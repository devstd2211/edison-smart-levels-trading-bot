/**
 * Legacy compatibility wrapper.
 *
 * Re-exports the stable non-CLI helpers from `src/core`, keeps the legacy CLI
 * handoff available for existing callers, and relies on the shared standalone
 * if-main helper for direct execution only.
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
// Type-only loader compatibility still comes through `./core`, so existing imports do not need to jump directly to `./config`.
export type { ConfigPipelineLoader } from './core';
export { runLegacyCliEntrypoint };

// Start the CLI only when this legacy wrapper is executed directly via the shared standalone if-main helper.
void runLegacyCliEntrypointIfMain(module);
