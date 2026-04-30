import { DECIMAL_PLACES } from '../../constants';
import { INTEGER_MULTIPLIERS, TIME_MULTIPLIERS } from '../../constants/technical.constants';
import { Position, PositionSide, ProtectionVerification, RiskManagementConfig } from '../../types/legacy';

export interface TimeBasedExitDecision {
  readonly shouldExit: boolean;
  readonly reason?: string;
  readonly openedMinutes?: number;
  readonly pnlPercent?: number;
}

export function isClosedPosition(position: Position | null | undefined): boolean {
  return position == null || position.status === 'CLOSED';
}

export function isExchangePositionClosed(position: Position | null | undefined): boolean {
  return position == null || position.quantity === INTEGER_MULTIPLIERS.ZERO;
}

export function toProtectionVerificationSide(side: PositionSide): 'Buy' | 'Sell' {
  return side === PositionSide.LONG ? 'Buy' : 'Sell';
}

export function isStopLossHit(position: Pick<Position, 'side' | 'stopLoss'>, currentPrice: number): boolean {
  return position.side === PositionSide.LONG
    ? currentPrice <= position.stopLoss.price
    : currentPrice >= position.stopLoss.price;
}

export function markProtectionVerified(position: Position): void {
  position.protectionVerifiedOnce = true;
}

export function buildUnprotectedPositionDetails(
  position: Pick<Position, 'id' | 'side' | 'entryPrice' | 'quantity'>,
  protection: ProtectionVerification,
) {
  return {
    positionId: position.id,
    side: position.side,
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    hasStopLoss: protection.hasStopLoss,
    hasTakeProfit: protection.hasTakeProfit,
    hasTrailingStop: protection.hasTrailingStop,
    activeOrders: protection.activeOrders,
  };
}

export function buildTimeBasedExitDecision(
  position: Pick<Position, 'openedAt'>,
  currentPrice: number,
  riskConfig: Pick<RiskManagementConfig, 'timeBasedExitEnabled' | 'timeBasedExitMinutes' | 'timeBasedExitMinPnl'>,
  calculatePnL: (currentPrice: number) => number,
): TimeBasedExitDecision {
  const enabled = riskConfig.timeBasedExitEnabled ?? false;
  if (!enabled) {
    return { shouldExit: false };
  }

  const maxMinutes = riskConfig.timeBasedExitMinutes ?? 30;
  const minPnlPercent = riskConfig.timeBasedExitMinPnl ?? 0.2;
  const openedMs = Date.now() - position.openedAt;
  const openedMinutes = openedMs / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND / INTEGER_MULTIPLIERS.SIXTY;
  const pnlPercent = calculatePnL(currentPrice);

  if (openedMinutes > maxMinutes && pnlPercent < minPnlPercent) {
    return {
      shouldExit: true,
      reason: `Position open for ${openedMinutes.toFixed(0)} min with low PnL (${pnlPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)`,
      openedMinutes,
      pnlPercent,
    };
  }

  return { shouldExit: false };
}
