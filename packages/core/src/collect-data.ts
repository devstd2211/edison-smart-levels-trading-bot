/**
 * Data Collector Entry Point (Standalone)
 *
 * Standalone script for collecting real-time market data for backtesting.
 * NO TRADING LOGIC - data collection only!
 *
 * Usage:
 *   npm run collect-data
 */

import { ICONS } from './cli/cli-runtime';
import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  createCollectDataRuntimeServices,
  initializeCollectDataRuntime,
  logCollectDataStartupSummary,
  loadCollectDataRuntimeConfig,
  registerCollectDataShutdown,
  startCollectDataRecurringTasks,
} from './collect-data.entrypoint';
import { printStandaloneScriptBanner } from './standalone-script-console';

// ============================================================================
// MAIN
// ============================================================================

export async function main(): Promise<void> {
  printStandaloneScriptBanner(console, 'Data Collector - Standalone Script', ICONS.cabinet);

  try {
    const config = loadCollectDataRuntimeConfig();
    const services = createCollectDataRuntimeServices(config);

    logCollectDataStartupSummary(services.logger, config);
    registerCollectDataShutdown(process, services);
    await initializeCollectDataRuntime(services);
    startCollectDataRecurringTasks(services);
    services.logger.info('Press Ctrl+C to stop collecting data');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

const collectDataEntrypointRunners = createStandaloneEntrypointRunners(main);

export const runCollectDataEntrypoint = collectDataEntrypointRunners.runEntrypoint;
export const runCollectDataEntrypointIfMain = collectDataEntrypointRunners.runEntrypointIfMain;

void runCollectDataEntrypointIfMain(module, require.main);
