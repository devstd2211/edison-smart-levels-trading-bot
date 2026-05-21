import {
  createCollectDataRuntimeServices,
  initializeCollectDataRuntime,
  loadCollectDataRuntimeConfig,
  registerCollectDataShutdown,
  startCollectDataRecurringTasks,
} from '../../collect-data.entrypoint';
import { TIME_INTERVALS } from '../../constants';

describe('collect-data entrypoint helpers', () => {
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
});
