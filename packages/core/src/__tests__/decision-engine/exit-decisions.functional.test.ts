import { evaluateExit, type ExitDecisionContext } from '../../decision-engine/exit-decisions';
import { PositionSide, PositionState } from '../../types/legacy';

function createPosition() {
  return {
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    entryPrice: 100,
    quantity: 1,
    takeProfits: [
      { level: 1, price: 101, percent: 1, hit: false, quantity: 0.5 },
      { level: 2, price: 102, percent: 2, hit: false, quantity: 0.3 },
      { level: 3, price: 105, percent: 5, hit: false, quantity: 0.2 },
    ],
    stopLoss: 99,
  } as never;
}

describe('exit-decisions functional', () => {
  it('keeps lifecycle transition strings ASCII-safe across TP progression', () => {
    const position = createPosition();
    const lifecycle: Array<Pick<ExitDecisionContext, 'currentPrice' | 'currentState'>> = [
      { currentPrice: 101, currentState: PositionState.OPEN },
      { currentPrice: 102, currentState: PositionState.TP1_HIT },
      { currentPrice: 105, currentState: PositionState.TP2_HIT },
      { currentPrice: 105, currentState: PositionState.TP3_HIT },
    ];

    const transitions = lifecycle.map((step) =>
      evaluateExit({
        position,
        currentPrice: step.currentPrice,
        currentState: step.currentState,
      }).stateTransition,
    );

    expect(transitions).toEqual([
      'OPEN to TP1_HIT',
      'TP1_HIT to TP2_HIT',
      'TP2_HIT to TP3_HIT',
      'TP3_HIT to HOLDING',
    ]);
    transitions.forEach((transition) => {
      expect(transition).not.toContain('->');
      expect(transition).not.toMatch(/[âÃð]/);
    });
  });
});
