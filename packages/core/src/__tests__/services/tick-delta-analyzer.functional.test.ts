import { ICONS } from '../../cli/cli-runtime';
import { SignalDirection } from '../../types/legacy';
import {
  createManagedTickDeltaAnalyzerContext,
  createTickDeltaAnalyzerDirectionalTicks,
  seedTickDeltaAnalyzerHistory,
} from '../helpers/tick-delta-analyzer-test.utils';

describe('TickDeltaAnalyzerService - Functional behavior', () => {
  it('detects a long momentum spike and emits cleaned signal logs', () => {
    const { service, mockLogger, cleanup } = createManagedTickDeltaAnalyzerContext();

    try {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(
        service,
        createTickDeltaAnalyzerDirectionalTicks(40, 15, { timestamp: now }),
      );

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike?.direction).toBe(SignalDirection.LONG);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${ICONS.success} LONG signal detected`,
        expect.objectContaining({ ratio: expect.any(String) }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `${ICONS.chart} Momentum spike detected`,
        expect.objectContaining({
          direction: SignalDirection.LONG,
          tickCount: 55,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
