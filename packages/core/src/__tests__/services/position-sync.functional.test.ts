import { ICONS } from '../../cli/cli-runtime';
import type { LoggerService } from '../../types/legacy';
import {
  createManagedPositionSyncContext,
  createPositionSyncAgedPosition,
  prepareClosedPositionSync,
} from '../helpers/position-sync-test.utils';

function createMockLogger(): LoggerService {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

describe('PositionSyncService - Functional behavior', () => {
  it('syncs an exchange-closed position and emits shared-icon sync messages', async () => {
    const logger = createMockLogger();
    const { service, mockBybit, mockTelegram, mockPositionManager, cleanup } =
      createManagedPositionSyncContext({ logger });

    try {
      const position = createPositionSyncAgedPosition(180000);
      prepareClosedPositionSync({ mockBybit }, { currentPrice: 105 });

      await service.syncClosedPosition(position);

      expect(logger.warn).toHaveBeenCalledWith(
        `${ICONS.warning} Position closed on exchange but WebSocket event missed`,
        expect.objectContaining({ positionId: position.id }),
      );
      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining(`${ICONS.warning} SYNC: Position closed on exchange`),
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Position state synced with exchange`,
        expect.objectContaining({ positionId: position.id }),
      );
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('passes deep sync protection checks and logs shared-icon lifecycle markers', async () => {
    const logger = createMockLogger();
    const { service, mockBybit, cleanup } = createManagedPositionSyncContext({ logger });

    try {
      const position = createPositionSyncAgedPosition(180000);
      position.stopLoss.isTrailing = true;
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders.mockResolvedValue([]);

      await service.deepSyncCheck(position);

      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.note} Running deep sync check`,
        expect.objectContaining({ positionId: position.id }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.success} Deep sync check passed`,
        expect.objectContaining({
          hasTrailingStop: true,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
