import type { Position } from '../../types/legacy';
import {
  BotInitializer,
  createBotInitializerCollaborators,
} from '../../services/bot-initializer';
import { createTradingBotRuntimeDependencies } from '../../services/runtime-service-adapters';
import { LifecycleManager } from '../../services/lifecycle-manager.service';
import {
  asBotInitializerMock,
  createBotInitializerConfig,
  createBotInitializerMockErrorHandler,
  createBotInitializerMockServices,
  createManagedBotInitializerTestContext,
} from '../helpers/bot-initializer-test.utils';
import {
  createManagedTrackedServicesRuntimeBundleRuntime,
  type TrackedServicesRuntimeBundleRuntime,
} from '../helpers/service-lifecycle-test.utils';

describe('BotInitializer functional behavior', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates grouped collaborators that keep exchange runtime reads live after handoff', () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerCollaborators(services);
    const replacementExchange = {
      ...services.exchangeRuntime.current,
      getOpenPositions: jest.fn().mockResolvedValue([{ id: 'replacement-open-position' }]),
    };

    services.exchangeRuntime.setCurrent(replacementExchange);

    expect(collaborators.exchangeRuntime.current).toBe(replacementExchange);
    expect(collaborators.core.logger).toBe(services.coreServices.logger);
    expect(collaborators.execution.positionMonitor).toBe(services.executionServices.positionMonitor);
    expect(collaborators.marketData.webSocketManager).toBe(services.marketDataServices.webSocketManager);
  });

  it('restores an open exchange position before periodic cleanup starts', async () => {
    jest.useFakeTimers();

    const context = createManagedBotInitializerTestContext();
    let currentPosition: Position | null = null;
    const exchangePosition = {
      id: 'exchange-pos-1',
      symbol: 'APEXUSDT',
      side: 'LONG',
      quantity: 0.01,
      entryPrice: 50000,
      stopLoss: 49000,
      takeProfit: 51000,
      trailingStop: undefined,
      status: 'OPEN',
      openedAt: Date.now(),
      journalId: 'journal-1',
      protectionVerifiedOnce: false,
    } as unknown as Position;
    const callOrder: string[] = [];

    asBotInitializerMock(context.services.exchangeRuntime.current.getOpenPositions).mockImplementation(
      async () => {
        callOrder.push('getOpenPositions');
        return [exchangePosition];
      },
    );
    asBotInitializerMock(context.services.executionServices.positionManager.syncWithWebSocket).mockImplementation(
      (position: Position) => {
        callOrder.push('syncWithWebSocket');
        currentPosition = position;
      },
    );
    asBotInitializerMock(context.services.executionServices.positionManager.getCurrentPosition).mockImplementation(
      () => currentPosition,
    );
    asBotInitializerMock(context.services.executionServices.positionMonitor.start).mockImplementation(async () => {
      callOrder.push('positionMonitor.start');
    });

    await context.initializer.startMonitoring();
    await jest.advanceTimersByTimeAsync(30_000);

    expect(callOrder).toEqual([
      'getOpenPositions',
      'syncWithWebSocket',
      'positionMonitor.start',
    ]);
    expect(context.services.exchangeRuntime.current.resyncTime).toHaveBeenCalledTimes(1);
    expect(context.services.exchangeRuntime.current.cancelAllConditionalOrders).not.toHaveBeenCalled();

    await context.cleanup();
  });

  it('retries a transient websocket startup failure and still warms trend analysis', async () => {
    jest.useFakeTimers();

    const context = createManagedBotInitializerTestContext({
      errorHandler: createBotInitializerMockErrorHandler(),
    });
    let privateAttempts = 0;

    asBotInitializerMock(context.services.marketDataServices.webSocketManager.start).mockImplementation(async () => {
      privateAttempts++;
      if (privateAttempts === 1) {
        throw new Error('ws:// temporary startup failure');
      }
    });

    const connectPromise = context.initializer.connectWebSockets();
    await jest.advanceTimersByTimeAsync(5_500);
    await connectPromise;

    expect(context.services.marketDataServices.webSocketManager.start).toHaveBeenCalledTimes(2);
    expect(context.services.marketDataServices.publicWebSocket.start).toHaveBeenCalledTimes(1);
    expect(context.services.executionServices.tradingOrchestrator.initializeTrendAnalysis).toHaveBeenCalledTimes(1);

    await context.cleanup();
  });

  it('switches follow-up lifecycle reads to the factory-created exchange', async () => {
    const initializerConfig = createBotInitializerConfig({
      exchange: {
        name: 'binance',
        timeframe: '1',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        demo: false,
        testnet: true,
        symbol: 'APEXUSDT',
      },
    });
    const context = createManagedBotInitializerTestContext({ config: initializerConfig });
    const initialExchange = context.services.exchangeRuntime.current;
    const runtimeExchange = {
      name: 'binance',
      initialize: jest.fn().mockResolvedValue(undefined),
      getOpenPositions: jest.fn().mockResolvedValue([]),
      getCandles: jest.fn().mockResolvedValue([]),
      getLatestPrice: jest.fn(),
      getExchangeTime: jest.fn(),
      getServerTime: jest.fn(),
      getCurrentPrice: jest.fn(),
      getSymbolPrecision: jest.fn(),
      openPosition: jest.fn(),
      closePosition: jest.fn(),
      updateStopLoss: jest.fn(),
      activateTrailing: jest.fn(),
      getPosition: jest.fn(),
      hasPosition: jest.fn(),
      placeOrder: jest.fn(),
      createConditionalOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrderStatus: jest.fn(),
      cancelAllOrders: jest.fn(),
      cancelAllConditionalOrders: jest.fn(),
      getBalance: jest.fn(),
      getLeverage: jest.fn(),
      setLeverage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
      healthCheck: jest.fn(),
    };

    context.services.exchangeFactory = {
      createExchange: jest.fn().mockResolvedValue(runtimeExchange),
    };

    await context.initializer.initialize();
    await context.initializer.startMonitoring();

    expect(context.services.exchangeFactory.createExchange).toHaveBeenCalledTimes(1);
    expect(context.services.exchangeRuntime.current).toBe(runtimeExchange);
    expect(runtimeExchange.getOpenPositions).toHaveBeenCalledTimes(1);
    expect(initialExchange.getOpenPositions).not.toHaveBeenCalled();

    await context.cleanup();
  });

  it('stores BTC candles through the shared BTC market state', async () => {
    const config = createBotInitializerConfig({
      btcConfirmation: {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1',
        lookbackCandles: 2,
      },
    } as never);
    const context = createManagedBotInitializerTestContext({ config });
    const btcCandles = [
      { timestamp: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { timestamp: 2, open: 2, high: 3, low: 2, close: 3, volume: 20 },
    ] as never[];

    asBotInitializerMock(context.services.exchangeRuntime.current.getCandles).mockResolvedValue(btcCandles);

    await context.initializer.initialize();

    expect(context.services.btcMarketState.btcCandles1m).toBe(btcCandles);
    expect(context.services.exchangeRuntime.current.getCandles).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      timeframe: '1',
      limit: 2,
    });

    await context.cleanup();
  });

  it('skips optional monitoring and resilience stages when their lifecycle shells are empty', async () => {
    const services = createBotInitializerMockServices();
    const context = createManagedBotInitializerTestContext({
      services: {
        ...services,
        monitoringServices: {},
        resilienceServices: {},
      } as never,
    });
    const startStageSpy = jest.spyOn(LifecycleManager.prototype, 'startStage');

    await context.initializer.initialize();

    expect(startStageSpy).toHaveBeenCalledWith('execution', { throwOnError: true });
    expect(startStageSpy).not.toHaveBeenCalledWith('monitoring');
    expect(startStageSpy).not.toHaveBeenCalledWith('resilience');

    await context.cleanup();
  });

  it('preserves exchange handoff behavior when created from grouped runtime dependencies', async () => {
    let createRuntimeBundleHarness!: TrackedServicesRuntimeBundleRuntime['createRuntimeBundleHarness'];
    let cleanupTrackedRuntime!: TrackedServicesRuntimeBundleRuntime['cleanup'];
    ({
      createRuntimeBundleHarness,
      cleanup: cleanupTrackedRuntime,
    } = createManagedTrackedServicesRuntimeBundleRuntime());

    const initializerConfig = createBotInitializerConfig({
      exchange: {
        name: 'binance',
        timeframe: '1',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        demo: false,
        testnet: true,
        symbol: 'APEXUSDT',
      },
    });
    const { services } = createRuntimeBundleHarness();
    const initialExchange = services.bybitService;
    const runtimeExchange = {
      ...initialExchange,
      name: 'binance',
      initialize: jest.fn().mockResolvedValue(undefined),
      getOpenPositions: jest.fn().mockResolvedValue([]),
      getCandles: jest.fn().mockResolvedValue([]),
    };
    services.exchangeFactory = {
      createExchange: jest.fn().mockResolvedValue(runtimeExchange),
    };

    const runtimeDependencies = createTradingBotRuntimeDependencies(services);
    const initializer = new BotInitializer(
      runtimeDependencies.lifecycleDependencies.initializerServices,
      initializerConfig,
    );

    await initializer.initialize();
    await initializer.startMonitoring();

    expect(runtimeDependencies.lifecycleDependencies.initializerServices.exchangeFactory?.createExchange)
      .toHaveBeenCalledTimes(1);
    expect(runtimeDependencies.lifecycleDependencies.initializerServices.exchangeRuntime.current)
      .toBe(runtimeExchange);
    expect(runtimeExchange.getOpenPositions).toHaveBeenCalledTimes(1);
    expect(initialExchange.getOpenPositions).not.toHaveBeenCalled();

    await initializer.shutdown().catch(() => undefined);
    await cleanupTrackedRuntime();
  });
});
