import type { Position } from '../../types/legacy';
import {
  asBotInitializerMock,
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
});
