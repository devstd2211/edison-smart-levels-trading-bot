import {
  ExitType,
  SignalDirection,
  SignalType,
} from '../../types/legacy';
import {
  createManagedSessionStatsContext,
  createSessionStatsConfig,
  createSessionStatsExitUpdate,
  createSessionStatsLogger,
  createSessionStatsTrade,
  type ManagedSessionStatsContext,
} from '../helpers/session-stats-test.utils';

const createConfig = createSessionStatsConfig;
const createTrade = createSessionStatsTrade;

describe('SessionStatsService', () => {
  let statsContext: ManagedSessionStatsContext;

  beforeEach(() => {
    statsContext = createManagedSessionStatsContext({
      logger: createSessionStatsLogger(),
    });
  });

  afterEach(() => {
    statsContext.cleanup();
  });

  it('starts a session with persisted metadata', () => {
    const sessionId = statsContext.stats.startSession(createConfig(), 'BTCUSDT');

    const currentSession = statsContext.stats.getCurrentSession();
    expect(currentSession?.sessionId).toBe(sessionId);
    expect(currentSession?.symbol).toBe('BTCUSDT');
    expect(currentSession?.summary.totalTrades).toBe(0);

    const savedSession = statsContext.stats.getSession(sessionId);
    expect(savedSession?.symbol).toBe('BTCUSDT');
  });

  it('closes the previous active session before starting a new one', () => {
    statsContext.stats.startSession(createConfig(), 'BTCUSDT');
    statsContext.stats.recordTradeEntry(createTrade('trade-1'));

    const secondSessionId = statsContext.stats.startSession(createConfig(), 'ETHUSDT');

    const allSessions = statsContext.stats.getAllSessions();
    const firstSession = allSessions.find((session) => session.symbol === 'BTCUSDT');
    const secondSession = allSessions.find((session) => session.symbol === 'ETHUSDT');

    expect(allSessions).toHaveLength(2);
    expect(firstSession?.endTime).not.toBeNull();
    expect(firstSession?.summary.totalTrades).toBe(1);
    expect(secondSession?.endTime).toBeNull();
    expect(statsContext.stats.getCurrentSession()?.sessionId).toBe(secondSessionId);
  });

  it('records entries and exits and recalculates aggregate summary', () => {
    statsContext.stats.startSession(createConfig(), 'BTCUSDT');

    const longWin = createTrade('trade-long-win');
    statsContext.stats.recordTradeEntry(longWin);
    statsContext.stats.updateTradeExit(
      longWin.tradeId,
      createSessionStatsExitUpdate({
        pnl: 150,
        pnlPercent: 1.5,
        holdingTimeMs: 60_000,
        exitType: ExitType.TAKE_PROFIT_1,
      }),
    );

    const shortLoss = createTrade('trade-short-loss');
    shortLoss.direction = SignalDirection.SHORT;
    shortLoss.entryCondition = {
      ...shortLoss.entryCondition,
      signal: {
        ...shortLoss.entryCondition.signal,
        type: SignalType.TREND_FOLLOWING,
        direction: SignalDirection.SHORT,
      },
    };
    statsContext.stats.recordTradeEntry(shortLoss);
    statsContext.stats.updateTradeExit(
      shortLoss.tradeId,
      createSessionStatsExitUpdate({
        pnl: -50,
        pnlPercent: -0.5,
        holdingTimeMs: 120_000,
        exitType: ExitType.STOP_LOSS,
      }),
    );

    const summary = statsContext.stats.getCurrentSession()?.summary;
    expect(summary).not.toBeNull();
    expect(summary?.totalTrades).toBe(2);
    expect(summary?.wins).toBe(1);
    expect(summary?.losses).toBe(1);
    expect(summary?.totalPnl).toBe(100);
    expect(summary?.avgHoldingTimeMs).toBe(90_000);
    expect(summary?.stopOutRate).toBe(100);
    expect(summary?.byStrategy[SignalType.LEVEL_BASED]?.count).toBe(1);
    expect(summary?.byStrategy[SignalType.TREND_FOLLOWING]?.losses).toBe(1);
    expect(summary?.byDirection[SignalDirection.LONG]?.wins).toBe(1);
    expect(summary?.byDirection[SignalDirection.SHORT]?.totalPnl).toBe(-50);
  });

  it('finalizes the active session and returns persisted summaries', () => {
    const sessionId = statsContext.stats.startSession(createConfig(), 'BTCUSDT');
    const trade = createTrade('trade-1');

    statsContext.stats.recordTradeEntry(trade);
    statsContext.stats.updateTradeExit(
      trade.tradeId,
      createSessionStatsExitUpdate({
        pnl: 75,
        pnlPercent: 0.75,
        holdingTimeMs: 45_000,
      }),
    );
    statsContext.stats.endSession();

    expect(statsContext.stats.getCurrentSession()).toBeNull();
    expect(statsContext.stats.getSessionSummary(sessionId)?.totalPnl).toBe(75);
    expect(statsContext.stats.getSession(sessionId)?.endTime).not.toBeNull();
  });

  it('resumes an interrupted session from persisted storage', () => {
    const sessionId = statsContext.stats.startSession(createConfig(), 'BTCUSDT');
    statsContext.stats.recordTradeEntry(createTrade('trade-1'));

    const resumedService = statsContext.createService({ autoStart: true });
    const resumedSession = resumedService.getCurrentSession();

    expect(resumedSession?.sessionId).toBe(sessionId);

    resumedService.recordTradeEntry(createTrade('trade-2'));

    expect(resumedService.getCurrentSession()?.trades).toHaveLength(2);
  });
});
