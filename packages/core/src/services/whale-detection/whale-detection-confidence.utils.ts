export const WHALE_CONFIDENCE_THRESHOLDS = {
  BREAK_SIZE_SCORE_DIVISOR: 15,
  BREAK_SIZE_SCORE_MULTIPLIER: 60,
  BREAK_SIZE_SCORE_MAX: 60,
  BREAK_DISTANCE_BASE: 30,
  BREAK_DISTANCE_MULTIPLIER: 5,
  BREAK_DISTANCE_MIN: 10,
  DISAPPEARANCE_SIZE_DIVISOR: 20,
  DISAPPEARANCE_SIZE_MULTIPLIER: 50,
  DISAPPEARANCE_SIZE_MAX: 50,
  DISAPPEARANCE_LIFETIME_DIVISOR: 120000,
  DISAPPEARANCE_LIFETIME_MULTIPLIER: 30,
  DISAPPEARANCE_LIFETIME_MAX: 30,
  SPIKE_CONFIDENCE_MULTIPLIER: 50,
} as const;

export function calculateWallBreakConfidence(
  wallPercentOfTotal: number,
  wallDistance: number,
  maxConfidence: number,
): number {
  const sizeScore = Math.min(
    (wallPercentOfTotal / WHALE_CONFIDENCE_THRESHOLDS.BREAK_SIZE_SCORE_DIVISOR) *
      WHALE_CONFIDENCE_THRESHOLDS.BREAK_SIZE_SCORE_MULTIPLIER,
    WHALE_CONFIDENCE_THRESHOLDS.BREAK_SIZE_SCORE_MAX,
  );

  const distanceScore = Math.max(
    WHALE_CONFIDENCE_THRESHOLDS.BREAK_DISTANCE_BASE -
      wallDistance * WHALE_CONFIDENCE_THRESHOLDS.BREAK_DISTANCE_MULTIPLIER,
    WHALE_CONFIDENCE_THRESHOLDS.BREAK_DISTANCE_MIN,
  );

  return Math.min(sizeScore + distanceScore, maxConfidence);
}

export function calculateWallDisappearanceConfidence(
  wallPercentOfTotal: number,
  wallLifetime: number,
  maxConfidence: number,
): number {
  const sizeScore = Math.min(
    (wallPercentOfTotal / WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_SIZE_DIVISOR) *
      WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_SIZE_MULTIPLIER,
    WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_SIZE_MAX,
  );

  const lifetimeScore = Math.min(
    (wallLifetime / WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_LIFETIME_DIVISOR) *
      WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_LIFETIME_MULTIPLIER,
    WHALE_CONFIDENCE_THRESHOLDS.DISAPPEARANCE_LIFETIME_MAX,
  );

  return Math.min(sizeScore + lifetimeScore, maxConfidence);
}

export function calculateImbalanceSpikeConfidence(ratioChange: number, maxConfidence: number): number {
  return Math.min(
    (ratioChange - 1) * WHALE_CONFIDENCE_THRESHOLDS.SPIKE_CONFIDENCE_MULTIPLIER,
    maxConfidence,
  );
}
