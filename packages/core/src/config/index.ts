/**
 * Public config entrypoint surface.
 *
 * Keeps the dedicated runtime-config helpers and the publishable ConfigPipeline loader type together on one focused barrel.
 */

import type { ConfigPipelineLoader } from './config-pipeline';

export const CONFIG_ENTRYPOINT_EXPORT_NAMES = [
  'CONFIG_ENTRYPOINT_EXPORT_NAMES',
  'applyStrategyConfig',
  'getConfig',
  'loadConfigPipeline',
  'loadOptionalRuntimeConfig',
  'loadRuntimeConfig',
  'loadValidatedConfig',
] as const;

export { getConfig } from '../config';
export {
  applyStrategyConfig,
  loadConfigPipeline,
  loadOptionalRuntimeConfig,
  loadRuntimeConfig,
  loadValidatedConfig,
} from './config-pipeline';
export type { ConfigPipelineLoader };
