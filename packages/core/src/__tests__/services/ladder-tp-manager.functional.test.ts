import { SignalDirection, PositionSide } from '../../types/legacy';
import {
  createLadderTpPosition,
  createManagedLadderTpContext,
} from '../helpers/ladder-tp-manager-test.utils';

describe('LadderTpManagerService functional behavior', () => {
  it('progresses through TP hit, partial close, breakeven move, and trailing update for a long position', async () => {
    const { service, bybitService, cleanup } = createManagedLadderTpContext();
    const position = createLadderTpPosition(PositionSide.LONG, 100, 3);
    const levels = service.createLadderLevels(100, SignalDirection.LONG);

    bybitService.closePosition.mockResolvedValue(undefined);
    bybitService.updateStopLoss.mockResolvedValue(undefined);

    expect(service.checkTpHit(levels[0], 100.08, SignalDirection.LONG)).toBe(true);
    expect(await service.executePartialClose(levels[0], position)).toBe(true);
    expect(await service.moveToBreakeven(position)).toBe(true);

    position.stopLoss!.price = position.entryPrice;

    expect(await service.moveTrailing(position, 100.2)).toBe(true);
    expect(bybitService.closePosition).toHaveBeenCalledWith({
      positionId: position.id,
      percentage: levels[0].closePercent,
    });
    expect(bybitService.updateStopLoss).toHaveBeenNthCalledWith(1, {
      positionId: position.id,
      newPrice: position.entryPrice,
    });
    expect(bybitService.updateStopLoss).toHaveBeenNthCalledWith(2, {
      positionId: position.id,
      newPrice: 100.1499,
    });

    cleanup();
  });
});
