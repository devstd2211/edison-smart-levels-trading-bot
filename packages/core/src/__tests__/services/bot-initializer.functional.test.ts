import type { Position } from '../../types/legacy';
import {
  asBotInitializerMock,
  createBotInitializerMockErrorHandler,
  createManagedBotInitializerTestContext,
} from '../helpers/bot-initializer-test.utils';

describe('BotInitializer functional behavior', () => {
  afterEach(() => {
    jest.useRealTimers();
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

    asBotInitializerMock(context.services.marketDataServices.bybitService.getOpenPositions).mockImplementation(
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
    expect(context.services.marketDataServices.bybitService.resyncTime).toHaveBeenCalledTimes(1);
    expect(context.services.marketDataServices.bybitService.cancelAllConditionalOrders).not.toHaveBeenCalled();

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
});
