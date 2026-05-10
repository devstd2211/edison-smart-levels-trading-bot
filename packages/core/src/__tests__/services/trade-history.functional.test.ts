import * as fs from 'fs';
import * as path from 'path';

import {
  createManagedTradeHistoryContext,
  createTradeHistoryRecord,
} from '../helpers/trade-history-test.utils';

describe('TradeHistoryService - functional lifecycle', () => {
  it('requires explicit start before business operations', async () => {
    const context = createManagedTradeHistoryContext();
    const service = context.createService({ autoStart: false });

    try {
      await expect(service.appendTrade(createTradeHistoryRecord())).rejects.toThrow(
        'TradeHistoryService has not been started',
      );
    } finally {
      context.cleanup();
    }
  });

  it('creates schema and CSV files from one explicit start boundary and persists appended fields', async () => {
    const context = createManagedTradeHistoryContext();
    const service = context.createService({ autoStart: false });
    const trade = createTradeHistoryRecord({
      id: 'trade-functional-1',
      customIndicator: 'RSI_SIGNAL',
      regime: 'trend',
    });

    try {
      service.start();
      await service.appendTrade(trade);

      const trades = await service.readAllTrades();
      const csvPath = path.join(context.tempDir, 'trade-history.csv');
      const schemaPath = path.join(context.tempDir, 'csv-schema.json');

      expect(fs.existsSync(csvPath)).toBe(true);
      expect(fs.existsSync(schemaPath)).toBe(true);
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        id: 'trade-functional-1',
        customIndicator: 'RSI_SIGNAL',
        regime: 'trend',
      });
      expect(service.getCurrentSchema()).toEqual(
        expect.arrayContaining(['customIndicator', 'regime']),
      );
    } finally {
      context.cleanup();
    }
  });
});
