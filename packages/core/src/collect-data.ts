/**
 * Data Collector Entry Point (Standalone)
 *
 * Standalone script for collecting real-time market data for backtesting.
 * NO TRADING LOGIC - data collection only!
 *
 * Usage:
 *   npm run collect-data
 */

import {
  createStandaloneEntrypointModuleRunners,
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  runCollectDataWorkflow,
} from './collect-data.entrypoint';

export const COLLECT_DATA_ENTRYPOINT_EXPORT_NAMES = [
  'COLLECT_DATA_ENTRYPOINT_EXPORT_NAMES',
  'main',
  'runCollectDataEntrypoint',
  'runCollectDataEntrypointIfMain',
  'shouldRunCollectDataEntrypoint',
] as const;

// ============================================================================
// MAIN
// ============================================================================

export async function main(): Promise<void> {
  try {
    await runCollectDataWorkflow();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

const collectDataEntrypointRunners = createStandaloneEntrypointRunners(main);
const collectDataModuleEntrypointRunners =
  createStandaloneEntrypointModuleRunners(module, main);

export function shouldRunCollectDataEntrypoint(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
): boolean {
  if (currentModule === module) {
    return collectDataModuleEntrypointRunners.shouldRunCurrentEntrypoint(mainModule);
  }

  return collectDataEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export const runCollectDataEntrypoint = collectDataEntrypointRunners.runEntrypoint;
export function runCollectDataEntrypointIfMain(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
  entrypoint = main,
): Promise<void> | undefined {
  if (currentModule === module) {
    return collectDataModuleEntrypointRunners.runCurrentEntrypointIfMain(
      mainModule,
      entrypoint,
    );
  }

  return collectDataEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    entrypoint,
  );
}

void runCollectDataEntrypointIfMain();
