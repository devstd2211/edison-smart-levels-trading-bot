import {
  analyzeDeltaTicks,
  createNeutralDeltaAnalysis,
  filterDeltaTicksByWindow,
  validateDeltaConfig,
  validateDeltaSignalDirection,
  validateDeltaTick,
} from '../../services/delta-analyzer/delta-analyzer-state.utils';
import {
  createDeltaAnalyzerConfig,
  createDeltaAnalyzerTick,
  createDeltaAnalyzerVolumePair,
} from '../helpers/delta-analyzer-test.utils';

describe('delta-analyzer state utils', () => {
  it('validates config, tick input, and signal direction', () => {
    expect(() => validateDeltaConfig(createDeltaAnalyzerConfig())).not.toThrow();
    expect(() => validateDeltaTick(createDeltaAnalyzerTick())).not.toThrow();
    expect(() => validateDeltaSignalDirection('LONG')).not.toThrow();
    expect(() => validateDeltaSignalDirection('SIDEWAYS')).toThrow('Signal direction must be LONG or SHORT');
  });

  it('filters ticks by window and produces neutral defaults', () => {
    const now = 10_000;
    const ticks = [
      createDeltaAnalyzerTick({ timestamp: now - 61_000 }),
      createDeltaAnalyzerTick({ timestamp: now - 1_000, side: 'SELL' }),
    ];

    expect(filterDeltaTicksByWindow(ticks, 60_000, now)).toHaveLength(1);
    expect(createNeutralDeltaAnalysis(now)).toEqual({
      timestamp: now,
      buyVolume: 0,
      sellVolume: 0,
      delta: 0,
      deltaPercent: 0,
      trend: 'NEUTRAL',
      strength: 0,
    });
  });

  it('aggregates recent tick volume into trend and strength', () => {
    const analysis = analyzeDeltaTicks(createDeltaAnalyzerVolumePair(1500, 500, 1000), 1000, 2000);
    expect(analysis.delta).toBe(1000);
    expect(analysis.trend).toBe('BULLISH');
    expect(analysis.strength).toBeCloseTo(50, 1);
  });
});
