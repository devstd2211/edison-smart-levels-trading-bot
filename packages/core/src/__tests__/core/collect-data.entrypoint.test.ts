import * as fs from 'fs';
import * as path from 'path';
import {
  createCollectDataRuntimeServices,
  createCollectDataWorkflowRuntime,
  initializeCollectDataRuntime,
  loadCollectDataRuntimeConfig,
  logCollectDataStartupSummary,
  registerCollectDataShutdown,
  resolveCollectDataTimeSyncSettings,
  runCollectDataWorkflow,
  startCollectDataWorkflowRuntime,
  startCollectDataRecurringTasks,
} from '../../collect-data.entrypoint';
import { INTEGER_MULTIPLIERS, TIME_INTERVALS } from '../../constants';

describe('collect-data entrypoint helpers', () => {
  test('keeps the public collect-data helper surface as a thin barrel over the runtime helper module', () => {
    const entrypointSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'collect-data.entrypoint.ts'),
      'utf8',
    );
    const runtimeSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'collect-data-entrypoint-runtime.ts'),
      'utf8',
    );

    expect(entrypointSource).toContain("from './collect-data-entrypoint-runtime';");
    expect(entrypointSource).not.toContain("import { getConfig } from './config';");
    expect(runtimeSource).toContain("import { getConfig } from './config';");
    expect(runtimeSource).toContain('export async function runCollectDataWorkflow');
  });

  test('loadCollectDataRuntimeConfig keeps only the runtime config sections used by the standalone entrypoint', () => {
    const result = loadCollectDataRuntimeConfig(
      () =>
        ({
          dataCollection: {
            enabled: true,
            symbols: ['BTCUSDT'],
            timeframes: ['1'],
            orderbookInterval: 5,
            database: { compression: true, path: './data.sqlite' },
          },
          exchange: { symbol: 'BTCUSDT' },
          system: { timeSyncIntervalMs: 1234, timeSyncMaxFailures: 7 },
        }) as never,
    );

    expect(result).toEqual({
      dataCollection: {
        enabled: true,
        symbols: ['BTCUSDT'],
        timeframes: ['1'],
        orderbookInterval: 5,
        database: { compression: true, path: './data.sqlite' },
      },
      exchange: { symbol: 'BTCUSDT' },
      system: { timeSyncIntervalMs: 1234, timeSyncMaxFailures: 7 },
    });
  });

  test('loadCollectDataRuntimeConfig rejects missing or disabled data collection config', () => {
    expect(() =>
      loadCollectDataRuntimeConfig(
        () =>
          ({
            exchange: {},
            system: {},
          }) as never,
      ),
    ).toThrow('dataCollection config section not found');

    expect(() =>
      loadCollectDataRuntimeConfig(
        () =>
          ({
            dataCollection: { enabled: false },
            exchange: {},
            system: {},
          }) as never,
      ),
    ).toThrow('dataCollection is disabled');
  });

  test('resolveCollectDataTimeSyncSettings keeps overrides and fallback defaults in one place', () => {
    expect(
      resolveCollectDataTimeSyncSettings({
        timeSyncIntervalMs: 1234,
        timeSyncMaxFailures: 7,
      } as never),
    ).toEqual({
      syncIntervalMs: 1234,
      maxSyncFailures: 7,
    });

    expect(resolveCollectDataTimeSyncSettings(undefined)).toEqual({
      syncIntervalMs: TIME_INTERVALS.MS_PER_5_MINUTES,
      maxSyncFailures: INTEGER_MULTIPLIERS.THREE,
    });
  });

  test('createCollectDataRuntimeServices wires the exchange adapter into time sync', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const rawBybitService = {};
    const bybitService = { initialize: jest.fn() };
    const timeService = {
      setBybitService: jest.fn(),
      syncWithExchange: jest.fn(),
      getSyncInfo: jest.fn(),
    };
    const collector = {
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      getStats: jest.fn(),
    };

    const services = createCollectDataRuntimeServices(
      {
        dataCollection: {
          enabled: true,
          symbols: ['BTCUSDT'],
          timeframes: ['1'],
          orderbookInterval: 5,
          database: { compression: true, path: './data.sqlite' },
        } as never,
        exchange: { symbol: 'BTCUSDT' } as never,
        system: { timeSyncIntervalMs: 1234, timeSyncMaxFailures: 7 } as never,
      },
      {
        createLogger: () => logger as never,
        createRawBybitService: () => rawBybitService as never,
        createBybitService: () => bybitService as never,
        createTimeService: () => timeService as never,
        createCollector: () => collector as never,
      },
    );

    expect(timeService.setBybitService).toHaveBeenCalledWith(bybitService);
    expect(services).toMatchObject({
      logger,
      bybitService,
      timeService,
      collector,
    });
  });

  test('createCollectDataWorkflowRuntime keeps config loading and runtime service creation in one explicit step', () => {
    const configLoader = jest.fn(
      () =>
        ({
          dataCollection: {
            enabled: true,
            symbols: ['BTCUSDT'],
            timeframes: ['1'],
            orderbookInterval: 5,
            database: { compression: true, path: './data.sqlite' },
          },
          exchange: { symbol: 'BTCUSDT' },
          system: { timeSyncIntervalMs: 1234, timeSyncMaxFailures: 7 },
        }) as never,
    );
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const services = createCollectDataWorkflowRuntime({
      configLoader,
      factories: {
        createLogger: () => logger as never,
        createRawBybitService: () => ({}) as never,
        createBybitService: () => ({ initialize: jest.fn() }) as never,
        createTimeService: () =>
          ({
            setBybitService: jest.fn(),
            syncWithExchange: jest.fn(),
            getSyncInfo: jest.fn(),
          }) as never,
        createCollector: () =>
          ({
            initialize: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            getStats: jest.fn(),
          }) as never,
      },
    });

    expect(configLoader).toHaveBeenCalledTimes(1);
    expect(services.config).toMatchObject({
      dataCollection: expect.objectContaining({ symbols: ['BTCUSDT'] }),
      exchange: { symbol: 'BTCUSDT' },
    });
    expect(services.services.logger).toBe(logger);
  });

  test('initializeCollectDataRuntime runs exchange sync and collector startup in order', async () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const bybitService = { initialize: jest.fn().mockResolvedValue(undefined) };
    const timeService = {
      syncWithExchange: jest.fn().mockResolvedValue(undefined),
      getSyncInfo: jest.fn().mockReturnValue({ offset: 25, nextSyncIn: 1000 }),
    };
    const collector = {
      initialize: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      getStats: jest.fn(),
    };

    await initializeCollectDataRuntime({
      logger: logger as never,
      bybitService: bybitService as never,
      timeService: timeService as never,
      collector: collector as never,
    });

    expect(bybitService.initialize).toHaveBeenCalledTimes(1);
    expect(timeService.syncWithExchange).toHaveBeenCalledTimes(1);
    expect(collector.initialize).toHaveBeenCalledTimes(1);
    expect(collector.start).toHaveBeenCalledTimes(1);
  });

  test('logCollectDataStartupSummary emits the multi-symbol startup snapshot from runtime config', () => {
    const logger = {
      info: jest.fn(),
    };
    const config = {
      dataCollection: {
        enabled: true,
        symbols: ['BTCUSDT', 'ETHUSDT'],
        timeframes: ['1', '5'],
        orderbookInterval: 15,
        database: { compression: true, path: './data.sqlite' },
      },
    };

    logCollectDataStartupSummary(logger as never, config as never);

    expect(logger.info).toHaveBeenCalledWith('Data Collector starting (Multi-Symbol)...', {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      symbolCount: 2,
      timeframes: ['1', '5'],
      orderbookInterval: '15s',
      compression: true,
    });
  });

  test('registerCollectDataShutdown stops the collector and exits on SIGINT', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processRef = {
      exit: jest.fn(),
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    const collector = { stop: jest.fn().mockResolvedValue(undefined) };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const exit = jest.fn();

    registerCollectDataShutdown(
      processRef,
      { logger: logger as never, collector: collector as never },
      exit,
    );

    listeners.get('SIGINT')?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(collector.stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('startCollectDataRecurringTasks schedules time sync and stats logging and returns cleanup', async () => {
    const scheduled: Array<() => void> = [];
    const handles: Array<ReturnType<typeof setInterval>> = [
      {} as ReturnType<typeof setInterval>,
      {} as ReturnType<typeof setInterval>,
    ];
    const cleared: Array<ReturnType<typeof setInterval>> = [];
    const scheduler = {
      setInterval: jest.fn((callback: () => void, intervalMs: number) => {
        expect(intervalMs).toBe(TIME_INTERVALS.MS_PER_MINUTE);
        scheduled.push(callback);
        const handle = handles[scheduled.length - 1];
        return handle;
      }),
      clearInterval: jest.fn((handle: ReturnType<typeof setInterval>) => {
        cleared.push(handle);
      }),
    };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const timeService = {
      syncWithExchange: jest.fn().mockResolvedValue(undefined),
      getSyncInfo: jest.fn().mockReturnValue({ offset: 5 }),
    };
    const collector = {
      getStats: jest.fn().mockResolvedValue({
        candles: 1,
        orderbook_snapshots: 2,
        trade_ticks: 3,
      }),
    };

    const stop = startCollectDataRecurringTasks(
      {
        logger: logger as never,
        timeService: timeService as never,
        collector: collector as never,
      },
      scheduler,
    );

    expect(scheduler.setInterval).toHaveBeenCalledTimes(2);

    scheduled.forEach((callback) => callback());
    await Promise.resolve();
    await Promise.resolve();

    expect(timeService.syncWithExchange).toHaveBeenCalledTimes(1);
    expect(collector.getStats).toHaveBeenCalledTimes(1);

    stop();

    expect(scheduler.clearInterval).toHaveBeenCalledTimes(2);
    expect(cleared).toHaveLength(2);
  });

  test('startCollectDataWorkflowRuntime registers shutdown before startup, returns recurring-task cleanup, and logs the stop hint', async () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const collector = {
      initialize: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      getStats: jest.fn(),
    };
    const services = {
      logger,
      bybitService: { initialize: jest.fn().mockResolvedValue(undefined) },
      timeService: {
        syncWithExchange: jest.fn().mockResolvedValue(undefined),
        getSyncInfo: jest.fn().mockReturnValue({ offset: 0, nextSyncIn: 1000 }),
      },
      collector,
    };
    const processRef = {
      exit: jest.fn(),
      on: jest.fn(),
    };
    const scheduler = {
      setInterval: jest.fn().mockReturnValue({} as ReturnType<typeof setInterval>),
      clearInterval: jest.fn(),
    };

    const stop = await startCollectDataWorkflowRuntime(
      {
        config: {
          dataCollection: {
            enabled: true,
            symbols: ['BTCUSDT'],
            timeframes: ['1'],
            orderbookInterval: 5,
            database: { compression: true, path: './data.sqlite' },
          } as never,
        } as never,
        services: services as never,
      },
      {
        processRef,
        scheduler,
      },
    );

    expect(processRef.on).toHaveBeenCalled();
    expect(collector.initialize).toHaveBeenCalledTimes(1);
    expect(collector.start).toHaveBeenCalledTimes(1);
    expect(scheduler.setInterval).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('Press Ctrl+C to stop collecting data');

    stop();

    expect(scheduler.clearInterval).toHaveBeenCalledTimes(2);
  });

  test('runCollectDataWorkflow composes config loading, runtime startup, and recurring tasks through the shared helpers', async () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const collector = {
      initialize: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      getStats: jest.fn(),
    };
    const services = createCollectDataRuntimeServices(
      {
        dataCollection: {
          enabled: true,
          symbols: ['BTCUSDT'],
          timeframes: ['1'],
          orderbookInterval: 5,
          database: { compression: true, path: './data.sqlite' },
        } as never,
        exchange: { symbol: 'BTCUSDT' } as never,
        system: {} as never,
      },
      {
        createLogger: () => logger as never,
        createRawBybitService: () => ({ initialize: jest.fn().mockResolvedValue(undefined) }) as never,
        createBybitService: (rawService) => rawService as never,
        createTimeService: () =>
          ({
            setBybitService: jest.fn(),
            syncWithExchange: jest.fn().mockResolvedValue(undefined),
            getSyncInfo: jest.fn().mockReturnValue({ offset: 0, nextSyncIn: 1000 }),
          }) as never,
        createCollector: () => collector as never,
      },
    );
    const scheduler = {
      setInterval: jest.fn().mockReturnValue({} as ReturnType<typeof setInterval>),
      clearInterval: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
      on: jest.fn(),
    };

    await runCollectDataWorkflow({
      configLoader: () =>
        ({
          dataCollection: {
            enabled: true,
            symbols: ['BTCUSDT'],
            timeframes: ['1'],
            orderbookInterval: 5,
            database: { compression: true, path: './data.sqlite' },
          },
          exchange: { symbol: 'BTCUSDT' },
          system: {},
        }) as never,
      factories: {
        createLogger: () => services.logger,
        createRawBybitService: () => services.bybitService as never,
        createBybitService: (rawService) => rawService as never,
        createTimeService: () => services.timeService as never,
        createCollector: () => services.collector as never,
      },
      processRef,
      scheduler,
    });

    expect(processRef.on).toHaveBeenCalled();
    expect(scheduler.setInterval).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'Data Collector starting (Multi-Symbol)...',
      expect.objectContaining({ symbolCount: 1 }),
    );
    expect(logger.info).toHaveBeenCalledWith('Press Ctrl+C to stop collecting data');
  });
});
