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
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  runCollectDataWorkflow,
} from './collect-data.entrypoint';

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

export const runCollectDataEntrypoint = collectDataEntrypointRunners.runEntrypoint;
export const runCollectDataEntrypointIfMain = collectDataEntrypointRunners.runEntrypointIfMain;

void runCollectDataEntrypointIfMain(module, require.main);
