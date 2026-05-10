import { ICONS } from '../../cli/cli-runtime';
import {
  createManagedTakeProfitManagerContext,
  createTakeProfitManagerCloseSequence,
} from '../helpers/take-profit-manager-test.utils';

describe('TakeProfitManagerService - Functional behavior', () => {
  it('records a TP sequence, preserves quantities, and logs partial closes with shared icons', () => {
    const { createManager, logger, cleanup } = createManagedTakeProfitManagerContext();
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    try {
      const manager = createManager();

      createTakeProfitManagerCloseSequence([1.1676, 1.1617, 1.1363]).forEach((close) => {
        manager.recordPartialClose(close.level, close.quantity, close.exitPrice);
      });

      expect(manager.isFullyClosed()).toBe(true);
      expect(manager.getRemainingQuantity()).toBeCloseTo(0, 1);
      expect(infoSpy).toHaveBeenCalledWith(
        `${ICONS.chart} Partial close recorded`,
        expect.objectContaining({
          positionId: 'test_123',
          level: 'TP1',
        }),
      );
    } finally {
      cleanup();
    }
  });
});
