/**
 * Stable CLI package entrypoint.
 *
 * Keeps the public CLI surface as a thin compatibility barrel over the dedicated
 * runtime helper boundary. Concrete startup composition, dependency binding,
 * and standalone direct-execution checks stay in `cli-entrypoint-runtime.ts`.
 */

import { runCliMainIfMain } from './cli-entrypoint-runtime';

export type {
  RunCliMainDependencies,
  StartCliWebServerPhaseOptions,
} from './cli-entrypoint-runtime';
export {
  CLI_ENTRYPOINT_EXPORT_NAMES,
  createCliStartupPhaseRuntime,
  loadCliStartupConfigPhase,
  main,
  runCliMain,
  shouldRunCliMain,
  startCliWebServerPhase,
} from './cli-entrypoint-runtime';
export { runCliMainIfMain };

void runCliMainIfMain(module);
