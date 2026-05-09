import * as fs from 'fs';
import { ICONS } from '../../cli/cli-runtime';
import {
  createManagedGracefulShutdownTestContext,
  setupGracefulShutdownFsMocks,
} from '../helpers/graceful-shutdown-test.utils';

jest.mock('fs');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
}));

describe('GracefulShutdownManager functional', () => {
  it('keeps retry and recovery warning logs aligned with shared icons', async () => {
    setupGracefulShutdownFsMocks({ exists: true });
    const { manager, mocks, cleanup } = createManagedGracefulShutdownTestContext();

    try {
      mocks.exchange.cancelAllOrders.mockRejectedValue(new Error('API timeout'));
      mocks.exchange.cancelAllConditionalOrders.mockRejectedValue(new Error('API timeout'));
      await (manager as unknown as { cancelAllPendingOrders: () => Promise<number> }).cancelAllPendingOrders();

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Corrupted snapshot');
      });

      const recovery = await manager.recoverState();
      expect(recovery).toBeNull();

      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${ICONS.warning} Could not cancel hanging orders after retries, continuing shutdown`),
      );
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${ICONS.warning} Could not cancel conditional orders after retries, continuing shutdown`),
      );
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${ICONS.warning} State recovery failed, starting with fresh state`),
        expect.any(Object),
      );
    } finally {
      cleanup();
    }
  });
});
