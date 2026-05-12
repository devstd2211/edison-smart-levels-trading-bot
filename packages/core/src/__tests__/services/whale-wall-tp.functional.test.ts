import { ICONS } from '../../cli/cli-runtime';
import { SignalDirection } from '../../types/legacy';
import {
  createManagedWhaleWallTPContext,
  createWhaleWallTPMockLoggerService,
  createWhaleWallTPWall,
} from '../helpers/whale-wall-tp-test.utils';

describe('WhaleWallTPService functional', () => {
  it('logs ASCII-safe TP and SL changes when both adjustments are applied', () => {
    const logger = createWhaleWallTPMockLoggerService();
    const { service, cleanup } = createManagedWhaleWallTPContext({ logger });

    try {
      service.adjustTPSL(
        [
          createWhaleWallTPWall('ASK', 101.5, 10, 1.5),
          createWhaleWallTPWall('BID', 98.5, 12, 1.5),
        ],
        100,
        SignalDirection.LONG,
        102,
        97,
      );

      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.whale} Whale Wall Adjustment`,
        expect.objectContaining({
          tpChange: '102.0000 to 101.5000',
          slChange: '97.0000 to 98.4015',
        }),
      );
    } finally {
      cleanup();
    }
  });
});
