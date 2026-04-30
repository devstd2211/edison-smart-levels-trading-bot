import { SignalDirection } from '../../types/legacy';
import {
  buildRetestZone,
  calculateRetestImpulse,
  createNeutralRetestImpulse,
  evaluateRetestZone,
} from '../../services/retest-entry/retest-entry-state.utils';
import {
  createRetestEntryCandles,
  createRetestEntryConfig,
  createRetestEntrySignal,
} from '../helpers/retest-entry-test.utils';

describe('retest-entry state utils', () => {
  it('detects impulse state from recent candles', () => {
    const candles = createRetestEntryCandles();
    expect(calculateRetestImpulse(candles, 1.1575, 0.5)).toEqual({
      hasImpulse: true,
      impulseStart: candles[0].open,
      impulseEnd: 1.1575,
    });
    expect(createNeutralRetestImpulse()).toEqual({
      hasImpulse: false,
      impulseStart: 0,
      impulseEnd: 0,
    });
  });

  it('builds zones for long and short retests', () => {
    const config = createRetestEntryConfig();
    const longZone = buildRetestZone('BTCUSDT', createRetestEntrySignal(), 1.15, 1.16, config, 1000);
    const shortZone = buildRetestZone(
      'ETHUSDT',
      createRetestEntrySignal({ direction: SignalDirection.SHORT }),
      1.2,
      1.19,
      config,
      1000,
    );

    expect(longZone.zoneLow).toBeCloseTo(1.15382, 5);
    expect(longZone.zoneHigh).toBeCloseTo(1.155, 5);
    expect(shortZone.zoneLow).toBeCloseTo(1.195, 5);
    expect(shortZone.zoneHigh).toBeCloseTo(1.19618, 5);
  });

  it('evaluates retest entry conditions consistently', () => {
    const config = createRetestEntryConfig();
    const zone = buildRetestZone('BTCUSDT', createRetestEntrySignal(), 1.15, 1.16, config, 1000);

    expect(evaluateRetestZone(zone, 1.1545, 800, 1000, 1.152, 'UP', config, 2000)).toEqual({
      inZone: true,
      shouldEnter: true,
      reason: 'Calm retest with structure intact',
    });
    expect(evaluateRetestZone(zone, 1.165, 800, 1000, 1.152, 'UP', config, 2000).inZone).toBe(false);
  });
});
