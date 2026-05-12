import { EntryOrchestrator } from '../../orchestrators/entry.orchestrator';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { RiskManager } from '../../services/risk-manager.service';
import {
  EntryDecision,
  LogLevel,
  Position,
  PositionSide,
  RiskManagerConfig,
  Signal,
  SignalDirection,
  SignalType,
  TrendAnalysis,
  TrendBias,
} from '../../types/legacy';

class TestLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

function createRiskManager(logger: LoggerService): RiskManager {
  const config: RiskManagerConfig = {
    dailyLimits: {
      maxDailyLossPercent: 5.0,
      maxDailyProfitPercent: 10.0,
      emergencyStopOnLimit: true,
    },
    lossStreak: {
      reductions: {
        after2Losses: 0.75,
        after3Losses: 0.5,
        after4Losses: 0.25,
      },
      stopAfterLosses: 5,
    },
    concurrentRisk: {
      enabled: true,
      maxPositions: 3,
      maxRiskPerPosition: 2.0,
      maxTotalExposurePercent: 100.0,
    },
    positionSizing: {
      riskPerTradePercent: 1.0,
      minPositionSizeUsdt: 5.0,
      maxPositionSizeUsdt: 100.0,
      maxLeverageMultiplier: 2.0,
    },
  };

  return new RiskManager(config, logger, new ErrorHandler(logger));
}

function createNeutralTrend(): TrendAnalysis {
  return {
    bias: 'NEUTRAL' as TrendBias,
    strength: 0,
    timeframe: '1h',
    pattern: 'MIXED',
    reasoning: ['No clear direction'],
    restrictedDirections: [],
  };
}

function createSignal(
  direction: SignalDirection,
  confidence: number,
  type: SignalType = SignalType.LEVEL_BASED,
): Signal {
  return {
    direction,
    type,
    confidence,
    price: 100,
    stopLoss: 98,
    takeProfits: [{ level: 1, percent: 1, sizePercent: 100, price: 101, hit: false }],
    reason: `${direction} signal`,
    timestamp: Date.now(),
  };
}

describe('EntryOrchestrator functional behavior', () => {
  let orchestrator: EntryOrchestrator;

  beforeEach(() => {
    const logger = new TestLogger();
    orchestrator = new EntryOrchestrator(createRiskManager(logger), logger);
  });

  it('returns the strongest signal from the majority direction in a tradable consensus', async () => {
    const signals: Signal[] = [
      createSignal(SignalDirection.LONG, 74, SignalType.TREND_FOLLOWING),
      createSignal(SignalDirection.LONG, 88, SignalType.LEVEL_BASED),
      createSignal(SignalDirection.SHORT, 91, SignalType.COUNTER_TREND),
    ];

    const result = await orchestrator.evaluateEntry(
      signals,
      1_000,
      [] as Position[],
      createNeutralTrend(),
    );

    expect(result.decision).toBe(EntryDecision.ENTER);
    expect(result.signal?.direction).toBe(PositionSide.LONG);
    expect(result.signal?.confidence).toBe(88);
    expect(result.reason).toContain('LEVEL_BASED');
    expect(result.reason).toContain('LONG consensus');
  });

  it('returns WAIT when conflict reaches an equal-vote deadlock', async () => {
    const signals: Signal[] = [
      createSignal(SignalDirection.LONG, 80),
      createSignal(SignalDirection.LONG, 78),
      createSignal(SignalDirection.SHORT, 82),
      createSignal(SignalDirection.SHORT, 77),
    ];

    const result = await orchestrator.evaluateEntry(
      signals,
      1_000,
      [] as Position[],
      createNeutralTrend(),
    );

    expect(result.decision).toBe(EntryDecision.WAIT);
    expect(result.reason).toContain('conflict');
  });
});
