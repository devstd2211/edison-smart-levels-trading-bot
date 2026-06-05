/**
 * Legacy compatibility wrapper.
 *
 * Root compatibility re-exports stay limited to core helpers plus the legacy CLI handoff.
 * The root surface does not expose dedicated web startup helpers; new web callers use `@edison/core/web`.
 * Runtime ownership for the CLI handoff stays in `legacy-entrypoint-runtime.ts`,
 * so this wrapper can remain a thin compatibility barrel.
 * Direct execution still uses the shared standalone if-main behavior,
 * but that wiring now stays inside `legacy-entrypoint-runtime.ts`.
 */

import {
  main,
  runLegacyCliEntrypoint,
  runLegacyCliEntrypointFromModule,
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

// Start the CLI only when this legacy wrapper is executed directly; the runtime helper owns the if-main wiring.
void runLegacyCliEntrypointFromModule(module);
