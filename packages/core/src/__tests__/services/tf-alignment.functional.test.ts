import {
  createManagedTFAlignmentContext,
  createTFAlignmentIndicators,
} from '../helpers/tf-alignment-test.utils';

describe('TFAlignmentService functional behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a readable detail summary for a fully aligned LONG setup', () => {
    const { service, cleanup } = createManagedTFAlignmentContext({
      withErrorHandler: false,
    });

    const result = service.calculateAlignment('LONG', 100, createTFAlignmentIndicators(100));

    expect(result.aligned).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details).toBe('Entry: 20, Primary: 50, Trend1: 30');

    cleanup();
  });

  it('falls back to the disabled-style result when invalid math is encountered', () => {
    const { service, config, cleanup } = createManagedTFAlignmentContext({
      withErrorHandler: false,
    });

    expect(config).toBeDefined();
    config!.timeframes.primary.weight = Number.POSITIVE_INFINITY;

    const result = service.calculateAlignment('LONG', 100, createTFAlignmentIndicators(100));

    expect(result.aligned).toBe(false);
    expect(result.score).toBe(0);
    expect(result.details).toBe('TF Alignment disabled');

    cleanup();
  });
});
