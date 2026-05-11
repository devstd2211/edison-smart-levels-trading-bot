import { ICONS } from '../../cli/cli-runtime';
import { SessionStatsService } from '../../services/session-stats.service';
import {
  cleanupSessionStatsTempDir,
  createSessionStatsConfig,
  createSessionStatsExitUpdate,
  createSessionStatsTempDir,
  createSessionStatsTrade,
} from '../helpers/session-stats-test.utils';

describe('SessionStatsService functional', () => {
  it('logs trade exits with shared icons instead of mojibake', () => {
    const tempDir = createSessionStatsTempDir();
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    try {
      const service = new SessionStatsService(logger as never, tempDir);
      service.start();
      service.startSession(createSessionStatsConfig(), 'BTCUSDT');

      const trade = createSessionStatsTrade('trade-1');
      service.recordTradeEntry(trade);
      service.updateTradeExit(trade.tradeId, createSessionStatsExitUpdate());

      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.note} Trade exit updated`,
        expect.objectContaining({
          tradeId: 'trade-1',
        }),
      );
    } finally {
      cleanupSessionStatsTempDir(tempDir);
    }
  });
});
