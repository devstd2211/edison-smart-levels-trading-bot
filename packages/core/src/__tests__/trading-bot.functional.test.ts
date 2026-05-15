import { BotInitializer } from '../services/bot-initializer';
import type { Config } from '../types/legacy';
import type { Position } from '../types/position';
import type { IExchange } from '../interfaces';
import {
  createManagedTrackedServicesContext,
  createMinimalLifecycleConfig,
  type ManagedTrackedServicesContext,
} from './helpers/service-lifecycle-test.utils';

type DashboardTestConfig = {
  dashboard?: {
    enabled?: boolean;
  };
};

const createTestPosition = (): Position => ({
  id: 'pos-123',
  journalId: 'journal-123',
  orderId: 'order-123',
  side: 'LONG',
  symbol: 'XRPUSDT',
  entryPrice: 2,
  currentPrice: 2.1,
  quantity: 100,
  leverage: 10,
  marginUsed: 20,
  unrealizedPnL: 12.34,
  unrealizedPnLPercent: 61.7,
  takeProfits: [],
  stopLoss: { price: 1.96 },
  openedAt: Date.now() - 60_000,
  reason: 'test position',
  status: 'OPEN',
} as unknown as Position);

describe('TradingBot functional boundaries', () => {
  let context: ManagedTrackedServicesContext;

  beforeEach(() => {
    context = createManagedTrackedServicesContext();
  });

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('start() notifies Telegram with only enabled timeframe labels', async () => {
    const config = createMinimalLifecycleConfig();
    config.timeframes = {
      ...config.timeframes,
      context: { interval: '15', candleLimit: 250, enabled: false },
    };
    const { bot, telegram } = context.createTradingBotHarness({ config });

    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      await hooks?.afterStart?.();
    });
    jest.spyOn(BotInitializer.prototype, 'shutdown').mockResolvedValue(undefined);

    try {
      await bot.start();

      expect(telegram.notifyBotStarted).toHaveBeenCalledWith('XRPUSDT', [
        'entry(1m)',
        'primary(5m)',
      ]);
    } finally {
      await bot.stop().catch(() => undefined);
    }
  });

  test('getBalance() falls back to config-derived placeholder balance when exchange balance fails', async () => {
    const mockExchange = {
      name: 'MockExchange',
      getBalance: jest.fn().mockRejectedValue(new Error('balance offline')),
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;
    const { bot } = context.createTradingBotHarness({ exchange: mockExchange });

    await expect(bot.getBalance()).resolves.toBe(10000);
  });

  test('getStatus() reflects the current position from the narrowed execution contract', () => {
    const { bot, services } = context.createTradingBotHarness();
    const position = createTestPosition();

    jest.spyOn(services.executionServices.positionManager, 'getCurrentPosition').mockReturnValue(position);

    expect(bot.getStatus()).toEqual({
      isRunning: false,
      hasPosition: true,
      position,
    });
  });

  test('dashboard listeners normalize direct and wrapped position payloads without duplicating across restarts', async () => {
    const config = createMinimalLifecycleConfig();
    (config as Config & DashboardTestConfig).dashboard = { enabled: true };
    const { bot, services } = context.createTradingBotHarness({ config });
    const position = createTestPosition();
    const recordEventSpy = jest
      .spyOn(services.monitoringServices.dashboard, 'recordEvent')
      .mockImplementation(() => undefined);

    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      await hooks?.afterStart?.();
    });
    jest.spyOn(BotInitializer.prototype, 'shutdown').mockImplementation(async (hooks) => {
      await hooks?.beforeShutdown?.();
      await hooks?.afterShutdown?.();
    });

    try {
      await bot.start();

      services.coreServices.eventBus.emit('position-opened', position);
      services.coreServices.eventBus.emit('position-closed', {
        closedPosition: position,
        pnl: 12.34,
      });

      expect(recordEventSpy).toHaveBeenNthCalledWith(1, 'position-open', 'LONG @ 2.0000 | Qty: 100');
      expect(recordEventSpy).toHaveBeenNthCalledWith(2, 'position-close', 'LONG closed | P&L: +12.34 USDT');

      await bot.stop();
      services.coreServices.eventBus.emit('position-opened', position);
      expect(recordEventSpy).toHaveBeenCalledTimes(2);

      await bot.start();
      services.coreServices.eventBus.emit('position-opened', { position });
      expect(recordEventSpy).toHaveBeenCalledTimes(3);
      expect(recordEventSpy).toHaveBeenLastCalledWith('position-open', 'LONG @ 2.0000 | Qty: 100');
    } finally {
      await bot.stop().catch(() => undefined);
    }
  });
});
