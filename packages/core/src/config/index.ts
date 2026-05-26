/**
 * Public config entrypoint surface.
 *
 * Keeps the publishable ConfigPipeline loader type and runtime-config helpers on one barrel.
 */

export { getConfig } from '../config';
export {
  applyStrategyConfig,
  type ConfigPipelineLoader,
  loadConfigPipeline,
  loadOptionalRuntimeConfig,
  loadRuntimeConfig,
  loadValidatedConfig,
} from './config-pipeline';
