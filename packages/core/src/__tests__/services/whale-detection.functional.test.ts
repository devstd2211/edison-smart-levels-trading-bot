import { SignalDirection } from '../../types/legacy';
import { WhaleDetectionMode } from '../../services/whale-detection.service';
import { determineWallDisappearanceDirectionByTrend } from '../../services/whale-detection/whale-detection-direction.utils';
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

  it('keeps blocked strong-trend continuation reasons ASCII-safe in direction logic', () => {
    const bullishBlock = determineWallDisappearanceDirectionByTrend({
      strategy: 'BREAKOUT',
      wallSide: 'BID',
      wallPrice: 1000,
      wallLifetime: 90_000,
      btcMomentum: 0.6,
      btcDirection: 'UP',
    });
    const bearishBlock = determineWallDisappearanceDirectionByTrend({
      strategy: 'BREAKOUT',
      wallSide: 'ASK',
      wallPrice: 1000,
      wallLifetime: 90_000,
      btcMomentum: 0.6,
      btcDirection: 'DOWN',
    });

    expect(bullishBlock.direction).toBeNull();
    expect(bullishBlock.blockedByTrend).toBe(true);
    expect(bullishBlock.reason).toContain('continue UP and skip SHORT');
    expect(bullishBlock.reason).not.toContain('->');

    expect(bearishBlock.direction).toBeNull();
    expect(bearishBlock.blockedByTrend).toBe(true);
    expect(bearishBlock.reason).toContain('continue DOWN and skip LONG');
    expect(bearishBlock.reason).not.toContain('->');
  });
});
