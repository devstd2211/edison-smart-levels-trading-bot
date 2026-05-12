import { ExitOrchestrator } from '../../orchestrators/exit.orchestrator';
import {
  ExitAction,
  LogLevel,
  Position,
  PositionSide,
  PositionState,
  TakeProfit,
} from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';

class FunctionalTestLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

function createPosition(
  side: PositionSide = PositionSide.LONG,
  entryPrice: number = 100,
): Position {
  const tpPercents = [0.5, 1.0, 2.0];
  const takeProfits: TakeProfit[] = tpPercents.map((percent, index) => ({
    level: index + 1,
    percent,
    sizePercent: index === 0 ? 50 : index === 1 ? 30 : 20,
    price: side === PositionSide.LONG ? entryPrice * (1 + percent / 100) : entryPrice * (1 - percent / 100),
    hit: false,
  }));
  const slPrice = side === PositionSide.LONG ? entryPrice * 0.98 : entryPrice * 1.02;

  return {
    id: 'functional-position-1',
    symbol: 'BTCUSDT',
    side,
    quantity: 1,
    entryPrice,
    exitPrice: 0,
    leverage: 1,
    marginUsed: entryPrice,
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'functional-order-1',
    status: 'OPEN' as const,
    reason: 'functional test position',
    closedAt: 0,
    takeProfits,
    stopLoss: {
      price: slPrice,
      initialPrice: slPrice,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
  } as unknown as Position;
}

describe('ExitOrchestrator functional behavior', () => {
  it('progresses through TP states and finishes with a final close action', async () => {
    const orchestrator = new ExitOrchestrator(new FunctionalTestLogger());
    const position = createPosition(PositionSide.LONG, 100);

    const tp1 = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);
    expect(tp1.newState).toBe(PositionState.TP1_HIT);
    expect(tp1.stateTransition).toContain('OPEN to TP1_HIT');
    expect(tp1.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: ExitAction.CLOSE_PERCENT, percent: 50 }),
        expect.objectContaining({ action: ExitAction.UPDATE_SL }),
      ]),
    );

    const tp2 = await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01, {
      atrPercent: 2,
      currentVolume: 1300,
      avgVolume: 1000,
    });
    expect(tp2.newState).toBe(PositionState.TP2_HIT);
    expect(tp2.stateTransition).toContain('TP1_HIT to TP2_HIT');
    expect(tp2.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: ExitAction.CLOSE_PERCENT, percent: 30 }),
        expect.objectContaining({ action: ExitAction.ACTIVATE_TRAILING }),
      ]),
    );

    const tp3 = await orchestrator.evaluateExit(position, position.takeProfits[2].price + 0.01);
    expect(tp3.newState).toBe(PositionState.TP3_HIT);
    expect(tp3.stateTransition).toContain('TP2_HIT to TP3_HIT');
    expect(tp3.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 20 });

    const closed = await orchestrator.evaluateExit(position, position.stopLoss.price - 0.01);
    expect(closed.newState).toBe(PositionState.CLOSED);
    expect(closed.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
  });
});
