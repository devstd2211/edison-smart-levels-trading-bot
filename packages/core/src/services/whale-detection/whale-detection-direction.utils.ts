import { DECIMAL_PLACES, INTEGER_MULTIPLIERS, MULTIPLIERS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS } from '../../constants';
import { SignalDirection } from '../../types/legacy';

export type WallDisappearanceDirectionResult = {
  direction: SignalDirection | null;
  reason: string;
  trendInverted: boolean;
  blockedByTrend: boolean;
};

type DirectionParams = {
  strategy: 'BREAKOUT' | 'FOLLOW';
  wallSide: 'BID' | 'ASK';
  wallPrice: number;
  wallLifetime: number;
  btcMomentum?: number;
  btcDirection?: string;
};

function formatSeconds(wallLifetime: number): string {
  return (wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0);
}

export function determineWallDisappearanceDirectionByTrend(
  params: DirectionParams,
): WallDisappearanceDirectionResult {
  const { strategy, wallSide, wallPrice, wallLifetime, btcMomentum, btcDirection } = params;
  const useFollowLogic = strategy === 'FOLLOW';
  const defaultDirection = useFollowLogic
    ? (wallSide === 'BID' ? SignalDirection.LONG : SignalDirection.SHORT)
    : (wallSide === 'BID' ? SignalDirection.SHORT : SignalDirection.LONG);
  const invertedDirection = wallSide === 'BID' ? SignalDirection.LONG : SignalDirection.SHORT;

  if (btcMomentum === undefined || btcDirection === undefined) {
    return {
      direction: defaultDirection,
      reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - ${
        wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
      }`,
      trendInverted: false,
      blockedByTrend: false,
    };
  }

  const isStrongTrend = btcMomentum >= MULTIPLIERS.HALF;
  const isNeutralMarket = btcMomentum < (PERCENTAGE_THRESHOLDS.MODERATE / PERCENT_MULTIPLIER);

  if (isNeutralMarket) {
    return {
      direction: defaultDirection,
      reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - ${
        wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
      } [NEUTRAL market]`,
      trendInverted: false,
      blockedByTrend: false,
    };
  }

  if (isStrongTrend) {
    const isBearishTrend = btcDirection === 'DOWN';
    const isBullishTrend = btcDirection === 'UP';

    if (wallSide === 'BID' && isBearishTrend) {
      return {
        direction: invertedDirection,
        reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - BEARISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales not buying = potential SHORT-TERM BOUNCE â†’ LONG [INVERTED]`,
        trendInverted: true,
        blockedByTrend: false,
      };
    }

    if (wallSide === 'ASK' && isBullishTrend) {
      return {
        direction: invertedDirection,
        reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - BULLISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales not selling = potential SHORT-TERM PULLBACK â†’ SHORT [INVERTED]`,
        trendInverted: true,
        blockedByTrend: false,
      };
    }

    if (wallSide === 'BID' && isBullishTrend) {
      return {
        direction: null,
        reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - BULLISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales done accumulating â†’ continue UP (skip SHORT)`,
        trendInverted: false,
        blockedByTrend: true,
      };
    }

    if (wallSide === 'ASK' && isBearishTrend) {
      return {
        direction: null,
        reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - BEARISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales done distributing â†’ continue DOWN (skip LONG)`,
        trendInverted: false,
        blockedByTrend: true,
      };
    }
  }

  return {
    direction: defaultDirection,
    reason: `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${formatSeconds(wallLifetime)}s) - ${
      wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
    } [MODERATE trend, BTC ${btcDirection}]`,
    trendInverted: false,
    blockedByTrend: false,
  };
}
