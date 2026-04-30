import {
  createManagedRetestEntryContext,
  createRetestEntryCandles,
  createRetestEntrySignal,
} from '../helpers/retest-entry-test.utils';

describe('RetestEntryService functional behavior', () => {
  it('moves from impulse detection to zone creation, entry confirmation, and cleanup', () => {
    const { service, cleanup } = createManagedRetestEntryContext();
    const candles = createRetestEntryCandles();

    const impulse = service.detectImpulse('BTCUSDT', 1.1575, candles);
    expect(impulse.hasImpulse).toBe(true);

    const zone = service.createRetestZone(
      'BTCUSDT',
      createRetestEntrySignal(),
      impulse.impulseStart,
      impulse.impulseEnd,
    );
    expect(service.hasRetestZone('BTCUSDT')).toBe(true);

    const retest = service.checkRetest('BTCUSDT', 1.1533, 800, 1000, 1.152, 'UP');
    expect(retest).toEqual({
      inZone: true,
      shouldEnter: true,
      reason: 'Calm retest with structure intact',
    });

    service.clearZone(zone.symbol);
    expect(service.hasRetestZone('BTCUSDT')).toBe(false);

    cleanup();
  });
});
