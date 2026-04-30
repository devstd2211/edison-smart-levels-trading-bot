import {
  createDeltaAnalyzerSignal,
  createManagedDeltaAnalyzerContext,
  createDeltaAnalyzerVolumePair,
  seedDeltaAnalyzerTicks,
} from '../helpers/delta-analyzer-test.utils';

describe('DeltaAnalyzerService functional behavior', () => {
  it('processes ticks, exposes rolling analysis, and confirms matching signals', () => {
    const { service, cleanup } = createManagedDeltaAnalyzerContext();
    const now = Date.now();

    seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1800, 400, now));

    const analysis = service.analyze();
    expect(analysis.trend).toBe('BULLISH');
    expect(service.confirmSignal(createDeltaAnalyzerSignal())).toBe(true);
    expect(service.getTickCount()).toBe(2);

    service.reset();
    expect(service.getTickCount()).toBe(0);

    cleanup();
  });
});
