/**
 * CLI entrypoint runtime boundary.
 *
 * Keeps the public CLI surface as a thin compatibility barrel over the dedicated
 * runtime helper boundary. RunCliMainDependencies keeps CLI composition injectable,
 * while concrete startup composition and dependency binding stay in
 * `cli-entrypoint-runtime.ts`. Shared standalone if-main guard wiring also stays on
 * this entrypoint surface so direct execution remains explicit.
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
