import {
  createManagedRiskManagerContext,
  createRiskManagerPosition,
  createRiskManagerSignal,
  createRiskManagerTrade,
} from '../helpers/risk-manager-test.utils';

describe('RiskManager functional', () => {
  it('applies trade checks and updates state across a small trading flow', async () => {
    const { riskManager, cleanup } = createManagedRiskManagerContext({
      balance: 1000,
    });

    try {
      const signal = createRiskManagerSignal({ price: 100, confidence: 70 });
      const before = await riskManager.canTrade(signal, 1000, []);
      expect(before.allowed).toBe(true);

      riskManager.recordTradeResult(createRiskManagerTrade({ realizedPnL: -25 }));
      const afterLoss = await riskManager.canTrade(
        signal,
        1000,
        [createRiskManagerPosition({ quantity: 1, entryPrice: 100 })],
      );

      expect(afterLoss.riskDetails?.consecutiveLosses).toBe(1);
      expect(riskManager.getRiskStatus().dailyPnL).toBe(-25);
    } finally {
      cleanup();
    }
  });
});
