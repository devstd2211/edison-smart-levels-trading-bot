import { PositionSide } from '../../types/legacy';
import {
  buildTimeBasedExitDecision,
  buildUnprotectedPositionDetails,
  isClosedPosition,
  isExchangePositionClosed,
  isStopLossHit,
  markProtectionVerified,
  toProtectionVerificationSide,
} from '../../services/position-monitor/position-monitor-state.utils';
import {
  createMockMonitoredPosition,
  createPositionMonitorRiskConfig,
} from '../helpers/position-monitor-test.utils';

describe('position-monitor-state utils', () => {
  it('maps internal position sides to exchange protection sides', () => {
    expect(toProtectionVerificationSide(PositionSide.LONG)).toBe('Buy');
    expect(toProtectionVerificationSide(PositionSide.SHORT)).toBe('Sell');
  });

  it('detects closed cached and exchange positions consistently', () => {
    const closedPosition = createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, [], Date.now(), {
      status: 'CLOSED',
    });

    expect(isClosedPosition(null)).toBe(true);
    expect(isClosedPosition(closedPosition)).toBe(true);
    expect(isExchangePositionClosed(null)).toBe(true);
    expect(isExchangePositionClosed({ ...closedPosition, quantity: 0 })).toBe(true);
  });

  it('detects stop loss hits for both directions', () => {
    const longPosition = createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, []);
    const shortPosition = createMockMonitoredPosition(PositionSide.SHORT, 50000, 50500, []);

    expect(isStopLossHit(longPosition, 49499)).toBe(true);
    expect(isStopLossHit(longPosition, 49501)).toBe(false);
    expect(isStopLossHit(shortPosition, 50501)).toBe(true);
    expect(isStopLossHit(shortPosition, 50499)).toBe(false);
  });

  it('marks protection verification in-place', () => {
    const position = createMockMonitoredPosition();
    expect(position.protectionVerifiedOnce).toBe(false);

    markProtectionVerified(position);

    expect(position.protectionVerifiedOnce).toBe(true);
  });

  it('builds time-based exit decisions and emergency details from the same state', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-30T12:00:00.000Z'));

    const position = createMockMonitoredPosition(
      PositionSide.LONG,
      50000,
      49500,
      [],
      Date.now() - 35 * 60 * 1000,
    );

    const decision = buildTimeBasedExitDecision(
      position,
      50010,
      createPositionMonitorRiskConfig({
        timeBasedExitEnabled: true,
        timeBasedExitMinutes: 30,
        timeBasedExitMinPnl: 0.2,
      }),
      (price) => ((price - position.entryPrice) / position.entryPrice) * 100,
    );

    const details = buildUnprotectedPositionDetails(position, {
      verified: false,
      hasStopLoss: false,
      hasTakeProfit: false,
      hasTrailingStop: false,
      activeOrders: 0,
    });

    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toContain('Position open for');
    expect(details).toEqual(
      expect.objectContaining({
        positionId: position.id,
        side: position.side,
        activeOrders: 0,
      }),
    );

    jest.useRealTimers();
  });
});
