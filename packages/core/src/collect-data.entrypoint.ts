/**
 * Stable collect-data entrypoint helper barrel.
 *
 * Keeps the public standalone workflow surface on `collect-data.entrypoint.ts`,
 * while concrete runtime orchestration lives in
 * `collect-data-entrypoint-runtime.ts`.
 */

export {
  createCollectDataRuntimeServices,
  createCollectDataWorkflowRuntime,
  initializeCollectDataRuntime,
  loadCollectDataRuntimeConfig,
  logCollectDataStartupSummary,
  registerCollectDataShutdown,
  resolveCollectDataTimeSyncSettings,
  runCollectDataWorkflow,
  startCollectDataRecurringTasks,
  startCollectDataWorkflowRuntime,
} from './collect-data-entrypoint-runtime';
export type {
  CollectDataRuntimeConfig,
  CollectDataRuntimeServices,
  CollectDataTimeSyncSettings,
  CollectDataWorkflowRuntime,
  RunCollectDataWorkflowOptions,
} from './collect-data-entrypoint-runtime';
