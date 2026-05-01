import {
  createLadderExitScenarioHarness,
  createManagedLadderExitContext,
  queueLadderExitOrderHistory,
} from '../helpers/ladder-exit-detector-test.utils';
import { ExitType } from '../../types/legacy';

describe('LadderExitDetectorService functional behavior', () => {
  it('detects a ladder hit, identifies the executed level, and confirms full ladder completion', async () => {
    const { bybitService, cleanup } = createManagedLadderExitContext();
    const { service, position } = createLadderExitScenarioHarness({
      bybitService,
    });

    expect(service.detectLadderTPHit(position, 100.25)).toBe(3);
    expect(service.identifyTPLevel(100.15, position)).toBe(2);

    queueLadderExitOrderHistory(bybitService, [
      { price: '100.25', orderType: 'Limit', reduceOnly: true },
    ]);

    const analysis = await service.analyzeExitExecution(position);
    expect(analysis.exitType).toBe(ExitType.TAKE_PROFIT_3);

    queueLadderExitOrderHistory(bybitService, [
      { price: '100.08', orderType: 'Limit', reduceOnly: true },
      { price: '100.15', orderType: 'Limit', reduceOnly: true },
      { price: '100.25', orderType: 'Limit', reduceOnly: true },
    ]);

    expect(await service.isCompleteLadderExecuted(position)).toBe(true);

    cleanup();
  });
});
