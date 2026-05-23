import { INTEGER_MULTIPLIERS, TIME_INTERVALS } from './constants';
import { registerGracefulShutdownSignals } from './cli/cli-shutdown';
import { ICONS } from './cli/cli-runtime';
import { getConfig } from './config';
import type { IExchange } from './interfaces/IExchange';
import { BybitService } from './services/bybit';
import { BybitServiceAdapter } from './services/bybit/bybit-service.adapter';
import { DataCollectorService } from './services/data-collector.service';
import { LoggerService } from './services/logger.service';
import { printStandaloneScriptBanner } from './standalone-script-console';
import { TimeService } from './services/time.service';
import { LogLevel } from './types/enums';
import type { DataCollectionConfig } from './types/config/config';
import type { Config } from './types/legacy';

export type CollectDataRuntimeConfig = {
  dataCollection: DataCollectionConfig;
  exchange: Config['exchange'];
  system: Config['system'];
};

export type CollectDataTimeSyncSettings = {
  syncIntervalMs: number;
  maxSyncFailures: number;
};

type SyncInfoSnapshot = {
  offset: number;
  nextSyncIn: number;
};

type CollectDataStatsSnapshot = {
  candles: number;
  orderbook_snapshots: number;
  trade_ticks: number;
};

export type CollectDataRuntimeServices = {
  logger: LoggerService;
  bybitService: IExchange;
  timeService: Pick<TimeService, 'setBybitService' | 'syncWithExchange' | 'getSyncInfo'>;
  collector: Pick<
    DataCollectorService,
    'initialize' | 'start' | 'stop' | 'getStats'
  >;
};

type CollectDataServiceFactories = {
  createLogger?: () => LoggerService;
  createRawBybitService?: (
    exchange: Config['exchange'],
    logger: LoggerService,
  ) => BybitService;
  createBybitService?: (
    rawBybitService: BybitService,
    logger: LoggerService,
  ) => IExchange;
  createTimeService?: (
    logger: LoggerService,
    syncIntervalMs: number,
    maxSyncFailures: number,
  ) => TimeService;
  createCollector?: (
    dataCollection: DataCollectionConfig,
    logger: LoggerService,
  ) => DataCollectorService;
};

type CollectDataProcessLike = {
  exit(code: number): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

type CollectDataIntervalHandle = ReturnType<typeof setInterval>;

type CollectDataScheduler = {
  setInterval(callback: () => void, delay: number): CollectDataIntervalHandle;
  clearInterval(handle: CollectDataIntervalHandle): void;
};

export type RunCollectDataWorkflowOptions = {
  configLoader?: () => Config;
  exit?: (code: number) => void;
  factories?: CollectDataServiceFactories;
  processRef?: CollectDataProcessLike;
  scheduler?: CollectDataScheduler;
};

export function loadCollectDataRuntimeConfig(
  configLoader: () => Config = getConfig,
): CollectDataRuntimeConfig {
  const config = configLoader();

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

export function createCollectDataRuntimeServices(
  config: CollectDataRuntimeConfig,
  factories: CollectDataServiceFactories = {},
): CollectDataRuntimeServices {
  const timeSyncSettings = resolveCollectDataTimeSyncSettings(config.system);
  const logger =
    factories.createLogger?.() ?? new LoggerService(LogLevel.INFO, './logs', true);
  const rawBybitService =
    factories.createRawBybitService?.(config.exchange, logger) ??
    new BybitService(config.exchange, logger);
  const bybitService =
    factories.createBybitService?.(rawBybitService, logger) ??
    new BybitServiceAdapter(rawBybitService, logger);
  const timeService =
    factories.createTimeService?.(
      logger,
      timeSyncSettings.syncIntervalMs,
      timeSyncSettings.maxSyncFailures,
    ) ??
    new TimeService(
      logger,
      timeSyncSettings.syncIntervalMs,
      timeSyncSettings.maxSyncFailures,
    );
  const collector =
    factories.createCollector?.(config.dataCollection, logger) ??
    new DataCollectorService(config.dataCollection, logger);

  timeService.setBybitService(bybitService);

  return {
    logger,
    bybitService,
    timeService,
    collector,
  };
}

export function resolveCollectDataTimeSyncSettings(
  system: CollectDataRuntimeConfig['system'] | undefined,
): CollectDataTimeSyncSettings {
  return {
    syncIntervalMs: system?.timeSyncIntervalMs ?? TIME_INTERVALS.MS_PER_5_MINUTES,
    maxSyncFailures: system?.timeSyncMaxFailures ?? INTEGER_MULTIPLIERS.THREE,
  };
}

export function logCollectDataStartupSummary(
  logger: Pick<LoggerService, 'info'>,
  config: Pick<CollectDataRuntimeConfig, 'dataCollection'>,
): void {
  logger.info('Data Collector starting (Multi-Symbol)...', {
    symbols: config.dataCollection.symbols,
    symbolCount: config.dataCollection.symbols.length,
    timeframes: config.dataCollection.timeframes,
    orderbookInterval: `${config.dataCollection.orderbookInterval}s`,
    compression: config.dataCollection.database.compression,
  });
}

export function registerCollectDataShutdown(
  processRef: CollectDataProcessLike,
  services: Pick<CollectDataRuntimeServices, 'logger' | 'collector'>,
  exit: (code: number) => void = process.exit.bind(process),
): void {
  const shutdown = async (signal: string): Promise<void> => {
    services.logger.info(`\n\n${signal} received - stopping data collector...`);

    try {
      await services.collector.stop();
      services.logger.info('Data collector stopped successfully');
      exit(0);
    } catch (error) {
      services.logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      exit(1);
    }
  };

  registerGracefulShutdownSignals(processRef, {
    onSigint: () => {
      void shutdown('SIGINT');
    },
    onSigterm: () => {
      void shutdown('SIGTERM');
    },
    onUncaughtException: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      services.logger.error('Uncaught exception', {
        error: errorMessage,
        stack: errorStack,
      });
      void shutdown('UNCAUGHT_EXCEPTION');
    },
    onUnhandledRejection: (reason) => {
      services.logger.error('Unhandled rejection', { reason });
      void shutdown('UNHANDLED_REJECTION');
    },
  });
}

export function startCollectDataRecurringTasks(
  services: Pick<CollectDataRuntimeServices, 'logger' | 'timeService' | 'collector'>,
  scheduler: CollectDataScheduler = globalThis,
): () => void {
  const handles = [
    scheduler.setInterval(() => {
      void syncTimeWithExchange(services.logger, services.timeService);
    }, TIME_INTERVALS.MS_PER_MINUTE),
    scheduler.setInterval(() => {
      void logCollectorStats(services.logger, services.collector);
    }, TIME_INTERVALS.MS_PER_MINUTE),
  ];

  return () => {
    for (const handle of handles) {
      scheduler.clearInterval(handle);
    }
  };
}

export async function initializeCollectDataRuntime(
  services: CollectDataRuntimeServices,
): Promise<void> {
  services.logger.info('Initializing Bybit API...');
  if (services.bybitService.initialize) {
    await services.bybitService.initialize();
  }
  services.logger.info(`${ICONS.success} Bybit API initialized`);

  services.logger.info(`${ICONS.alarm_clock} Synchronizing time with Bybit...`);
  await services.timeService.syncWithExchange();
  const syncInfo = services.timeService.getSyncInfo();
  services.logger.info(`${ICONS.success} Time synchronized`, {
    offset: syncInfo.offset,
    nextSyncIn: `${Math.round(syncInfo.nextSyncIn / INTEGER_MULTIPLIERS.ONE_THOUSAND)}s`,
  });

  await services.collector.initialize();
  services.logger.info(`${ICONS.success} Data collector initialized`);

  await services.collector.start();
  services.logger.info(`${ICONS.success} Data collector started - collecting data...\n`);
}

export async function runCollectDataWorkflow(
  options: RunCollectDataWorkflowOptions = {},
): Promise<void> {
  printStandaloneScriptBanner(console, 'Data Collector - Standalone Script', ICONS.cabinet);

  const config = loadCollectDataRuntimeConfig(options.configLoader);
  const services = createCollectDataRuntimeServices(config, options.factories);

  logCollectDataStartupSummary(services.logger, config);
  registerCollectDataShutdown(
    options.processRef ?? process,
    services,
    options.exit ?? process.exit.bind(process),
  );
  await initializeCollectDataRuntime(services);
  startCollectDataRecurringTasks(services, options.scheduler ?? globalThis);
  services.logger.info('Press Ctrl+C to stop collecting data');
}

async function syncTimeWithExchange(
  logger: LoggerService,
  timeService: Pick<TimeService, 'syncWithExchange' | 'getSyncInfo'>,
): Promise<void> {
  try {
    logger.debug(`${ICONS.alarm_clock} Re-syncing time with Bybit...`);
    await timeService.syncWithExchange();
    const updatedSyncInfo: SyncInfoSnapshot = timeService.getSyncInfo();
    logger.debug('Time re-synced', {
      offset: updatedSyncInfo.offset,
    });
  } catch (error) {
    logger.warn('Failed to re-sync time', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function logCollectorStats(
  logger: LoggerService,
  collector: Pick<DataCollectorService, 'getStats'>,
): Promise<void> {
  try {
    const stats: CollectDataStatsSnapshot = await collector.getStats();
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
}
