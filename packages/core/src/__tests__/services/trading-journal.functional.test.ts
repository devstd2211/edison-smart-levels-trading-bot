import * as fs from 'fs';
import * as path from 'path';

import { ExitType, PositionSide, SignalDirection, SignalType } from '../../types/legacy';
import {
  createJournalCloseParams,
  createJournalExitCondition,
  createManagedTradingJournalContext,
} from '../helpers/trading-journal-test.utils';

describe('TradingJournalService - functional lifecycle', () => {
  it('requires explicit start before business operations', () => {
    const context = createManagedTradingJournalContext({ autoStart: false });

    try {
      expect(() => context.journal.getAllTrades()).toThrow('TradingJournalService has not been started');
    } finally {
      context.cleanup();
    }
  });

  it('starts trade-history and virtual-balance dependencies from one explicit start boundary', async () => {
    const context = createManagedTradingJournalContext({ autoStart: false });

    try {
      const journal = context.createService({
        autoStart: false,
        tradeHistoryConfig: {
          enabled: true,
          dataDir: context.dataDir,
          includeIndicators: false,
          autoBackup: false,
        },
        baseDeposit: 1000,
      });

      journal.start();
      journal.recordTradeOpen({
        id: 'FUNC_1',
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        entryPrice: 50000,
        quantity: 0.01,
        leverage: 5,
        entryCondition: {
          signal: {
            price: 50000,
            confidence: 0.9,
            type: SignalType.LEVEL_BASED,
            direction: SignalDirection.LONG,
            stopLoss: 49000,
            takeProfits: [{ level: 1, price: 51000, percent: 1, sizePercent: 100, hit: false }],
            reason: 'functional test',
            timestamp: Date.now(),
          },
        },
      });
      journal.recordTradeClose({
        ...createJournalCloseParams({
          id: 'FUNC_1',
          exitPrice: 51000,
          exitCondition: createJournalExitCondition(ExitType.TAKE_PROFIT_1, 51000, 20, 100, 5, [1], false),
          realizedPnL: 100,
        }),
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(journal.getVirtualBalanceService()).toBeDefined();
      expect(journal.getVirtualBalance()).toBe(1000);
      expect(fs.existsSync(path.join(context.dataDir, 'trade-history.csv'))).toBe(true);
      expect(fs.existsSync(path.join(context.dataDir, 'virtual-balance.json'))).toBe(true);
    } finally {
      context.cleanup();
    }
  });
});
