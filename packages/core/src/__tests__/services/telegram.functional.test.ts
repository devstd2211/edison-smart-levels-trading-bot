import { ICONS } from '../../cli/cli-runtime';
import { PositionSide, SignalDirection } from '../../types/legacy';
import { createManagedTelegramContext } from '../helpers/telegram-test.utils';

describe('TelegramService functional behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats stop reasons and TP markers with shared icons', async () => {
    const { telegramService, fetchMock, cleanup } = createManagedTelegramContext();
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await telegramService.notifyBotStopped('manual shutdown');
    await telegramService.notifyPositionOpened({
      id: 'pos-1',
      symbol: 'BTCUSDT',
      side: PositionSide.LONG,
      quantity: 1,
      entryPrice: 65000,
      marginUsed: 1000,
      leverage: 5,
      takeProfits: [{ level: 1, price: 65500, percent: 0.77, sizePercent: '50%', hit: true }],
      stopLoss: { price: 64500, percent: -0.77, hit: false },
      openedAt: Date.now(),
      strategy: 'Functional',
      confidence: 0.8,
      reason: 'Breakout',
    } as never);

    const stopBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).text as string;
    const openBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).text as string;

    expect(stopBody).toContain(`${ICONS.note} Reason: manual shutdown`);
    expect(openBody).toContain(`50%% ${ICONS.success}`);

    cleanup();
  });

  it('formats entry notifications with shared TP bullet icons', async () => {
    const { telegramService, fetchMock, cleanup } = createManagedTelegramContext();
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await telegramService.sendTradeNotification({
      type: 'ENTRY',
      direction: SignalDirection.LONG,
      price: 100,
      stopLoss: 95,
      takeProfits: [{ level: 1, price: 105, sizePercent: 50 }],
      reason: 'Momentum',
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).text as string;
    expect(body).toContain(`${ICONS.small_blue_diamond} TP1: $105.0000 (50%)`);

    cleanup();
  });
});
