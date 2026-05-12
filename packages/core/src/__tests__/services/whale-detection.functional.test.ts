import { SignalDirection } from '../../types/legacy';
import { WhaleDetectionMode } from '../../services/whale-detection.service';
import {
  createManagedWhaleDetectionContext,
  createWhaleDetectionAnalysis,
  createWhaleDetectionWall,
} from '../helpers/whale-detection-test.utils';

describe('WhaleDetectionService functional behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps neutral disappearance wording readable without mojibake', () => {
    const { detector, cleanup } = createManagedWhaleDetectionContext({
      strategy: 'BREAKOUT',
      withErrorHandler: false,
    });

    const bidWall = createWhaleDetectionWall('BID', 1000, 25, 0.5);
    detector.detectWhale(createWhaleDetectionAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
    jest.advanceTimersByTime(65_000);
    detector.detectWhale(createWhaleDetectionAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
    jest.advanceTimersByTime(20_000);

    const signal = detector.detectWhale(createWhaleDetectionAnalysis([], 1.0, 'NEUTRAL'), 1005, 0.2, 'NEUTRAL');

    expect(signal.mode).toBe(WhaleDetectionMode.WALL_DISAPPEARANCE);
    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.reason).toContain('NEUTRAL market');
    expect(signal.reason).not.toMatch(/[âÃð]/);

    cleanup();
  });

  it('reports inverted strong-trend disappearance reasons with ASCII arrows', () => {
    const { detector, cleanup } = createManagedWhaleDetectionContext({
      strategy: 'BREAKOUT',
      withErrorHandler: false,
    });

    const askWall = createWhaleDetectionWall('ASK', 1000, 25, 0.5);
    detector.detectWhale(createWhaleDetectionAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
    jest.advanceTimersByTime(65_000);
    detector.detectWhale(createWhaleDetectionAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
    jest.advanceTimersByTime(20_000);

    const signal = detector.detectWhale(createWhaleDetectionAnalysis([], 1.0, 'NEUTRAL'), 995, 0.6, 'UP');

    expect(signal.mode).toBe(WhaleDetectionMode.WALL_DISAPPEARANCE);
    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.reason).toContain('signal SHORT [INVERTED]');

    cleanup();
  });
});
