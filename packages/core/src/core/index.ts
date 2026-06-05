/**
 * Stable non-CLI core entrypoint.
 *
 * Keeps programmatic bot creation and config-aware runtime helpers on one
 * focused package surface without pulling callers into CLI or source-path details.
 * The concrete helper/runtime orchestration stays in `core-entrypoint-runtime.ts`,
 * so this file remains a thin public barrel over that runtime boundary.
 * The named CoreEntrypointRuntime handoff type stays here as the public
 * programmatic runtime pair contract for bot plus web adapter consumers.
 * Re-exports the composed ConfigPipelineLoader type from the dedicated config barrel.
 * The lower-level loader-contract aliases stay on `@edison/core/config`.
 * Config-aware callers can stay on this entrypoint when that single convenience type is useful.
 */

import type { ConfigPipelineLoader } from '../config/config-loader-contracts';
export type { ConfigPipelineLoader };
export type { BotLike, CoreEntrypointRuntime } from './core-entrypoint-runtime';
export {
  CORE_ENTRYPOINT_EXPORT_NAMES,
  createBot,
  createBotRuntime,
  createConfiguredBot,
  createConfiguredBotRuntime,
  loadBotRuntimeConfig,
  startBot,
  startConfiguredBot,
} from './core-entrypoint-runtime';
