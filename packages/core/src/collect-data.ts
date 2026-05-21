/**
 * Data Collector Entry Point (Standalone)
 *
 * Standalone script for collecting real-time market data for backtesting.
 * NO TRADING LOGIC - data collection only!
 *
 * Usage:
 *   npm run collect-data
 */

import { LoggerService } from './services/logger.service';
import { LogLevel } from './types/enums';
import type { DataCollectionConfig } from './types/config/config';
import type { Config } from './types/legacy';
import { DataCollectorService } from './services/data-collector.service';
import { BybitService } from './services/bybit';
import { BybitServiceAdapter } from './services/bybit/bybit-service.adapter';
import { IExchange } from './interfaces/IExchange';
import { TimeService } from './services/time.service';
import { INTEGER_MULTIPLIERS, TIME_INTERVALS } from './constants';
import { ICONS } from './cli/cli-runtime';
import { registerGracefulShutdownSignals } from './cli/cli-shutdown';
import { getConfig } from './config';
import {
  runStandaloneEntrypoint,
  runStandaloneEntrypointIfMain,
} from './standalone-entrypoint-runtime';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Load configuration from config.json
 */
function loadConfig(): {
  dataCollection: DataCollectionConfig;
  exchange: Config['exchange'];
  system: Config['system'];
} {
  const config = getConfig();

  if (!config.dataCollection) {
    throw new Error('dataCollection config section not found in config.json');
  }

  if (!config.dataCollection.enabled) {
    throw new Error('dataCollection is disabled in config.json');
  }

  return {
    dataCollection: config.dataCollection,
    exchange: config.exchange,
    system: config.system,
  };
}

// ============================================================================
// MAIN
// ============================================================================

export async function main(): Promise<void> {
  console.log('========================================');
  console.log(`${ICONS.cabinet}  Data Collector - Standalone Script`);
  console.log('========================================\n');

  try {
    const config = loadConfig();
    const logger = new LoggerService(LogLevel.INFO, './logs', true);
    logger.info('Data Collector starting (Multi-Symbol)...', {
      symbols: config.dataCollection.symbols,
      symbolCount: config.dataCollection.symbols.length,
      timeframes: config.dataCollection.timeframes,
      orderbookInterval: config.dataCollection.orderbookInterval + 's',
      compression: config.dataCollection.database.compression,
    });

    const rawBybitService = new BybitService(config.exchange, logger);
    const bybitService: IExchange = new BybitServiceAdapter(rawBybitService, logger);

    const timeService = new TimeService(
      logger,
      config.system?.timeSyncIntervalMs || TIME_INTERVALS.MS_PER_5_MINUTES,
      config.system?.timeSyncMaxFailures || INTEGER_MULTIPLIERS.THREE,
    );

    timeService.setBybitService(bybitService);

    const collector = new DataCollectorService(config.dataCollection, logger);

    const shutdown = async (signal: string) => {
      logger.info(`\n\n${signal} received - stopping data collector...`);

      try {
        await collector.stop();
        logger.info('Data collector stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    registerGracefulShutdownSignals(process, {
      onSigint: () => {
        void shutdown('SIGINT');
      },
      onSigterm: () => {
        void shutdown('SIGTERM');
      },
      onUncaughtException: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('Uncaught exception', { error: errorMessage, stack: errorStack });
        void shutdown('UNCAUGHT_EXCEPTION');
      },
      onUnhandledRejection: (reason) => {
        logger.error('Unhandled rejection', { reason });
        void shutdown('UNHANDLED_REJECTION');
      },
    });

    logger.info('Initializing Bybit API...');
    if (bybitService.initialize) {
      await bybitService.initialize();
    }
    logger.info(`${ICONS.success} Bybit API initialized`);

    logger.info(`${ICONS.alarm_clock} Synchronizing time with Bybit...`);
    await timeService.syncWithExchange();
    const syncInfo = timeService.getSyncInfo();
    logger.info(`${ICONS.success} Time synchronized`, {
      offset: syncInfo.offset,
      nextSyncIn: `${Math.round(syncInfo.nextSyncIn / INTEGER_MULTIPLIERS.ONE_THOUSAND)}s`,
    });

    await collector.initialize();
    logger.info(`${ICONS.success} Data collector initialized`);

    await collector.start();
    logger.info(`${ICONS.success} Data collector started - collecting data...
`);

    setInterval(async () => {
      try {
        logger.debug(`${ICONS.alarm_clock} Re-syncing time with Bybit...`);
        await timeService.syncWithExchange();
        const updatedSyncInfo = timeService.getSyncInfo();
        logger.debug('Time re-synced', {
          offset: updatedSyncInfo.offset,
        });
      } catch (error) {
        logger.warn('Failed to re-sync time', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, TIME_INTERVALS.MS_PER_MINUTE);

    setInterval(async () => {
      try {
        const stats = await collector.getStats();
        logger.info(`${ICONS.chart} Collection stats`, {
          candles: stats.candles,
          orderbook_snapshots: stats.orderbook_snapshots,
          trade_ticks: stats.trade_ticks,
        });
      } catch (error) {
        logger.warn('Failed to get stats', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, TIME_INTERVALS.MS_PER_MINUTE);

    logger.info('Press Ctrl+C to stop collecting data');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

export function runCollectDataEntrypoint(
  entrypoint: () => Promise<void> = main,
): Promise<void> {
  return runStandaloneEntrypoint(entrypoint);
}

export function runCollectDataEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  entrypoint: () => Promise<void> = main,
): Promise<void> | undefined {
  return runStandaloneEntrypointIfMain(currentModule, mainModule, entrypoint);
}

void runCollectDataEntrypointIfMain(module, require.main, runCollectDataEntrypoint);
