/**
 * Legacy compatibility wrapper.
 *
 * Root compatibility re-exports stay limited to core helpers plus the legacy CLI handoff.
 * The root surface does not expose dedicated web startup helpers; new web callers use `@edison/core/web`.
 * Direct execution still relies on the shared standalone if-main helper.
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
// Type-only loader compatibility still comes through `./core`, while the full loader-contract aliases stay on the dedicated `./config` entrypoint.
export type { ConfigPipelineLoader } from './core';
export { runLegacyCliEntrypoint };

// Start the CLI only when this legacy wrapper is executed directly via the shared standalone if-main helper.
void runLegacyCliEntrypointIfMain(module);
