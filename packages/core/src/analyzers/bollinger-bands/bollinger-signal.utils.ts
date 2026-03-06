import { SignalDirection, SignalDirection as SignalDirectionEnum } from '../../types/enums';

export interface BollingerSignalThresholds {
  minConfidence: number;
  maxConfidence: number;
  oversoldThreshold: number;
  overboughtThreshold: number;
  neutralLower: number;
  neutralUpper: number;
  squeezeThreshold: number;
  neutralConfidenceMultiplier: number;
  moderateConfidenceMultiplier: number;
  distanceNormalizationDivisor: number;
}

export function getBollingerDirection(
  percentB: number,
  bandwidth: number,
  thresholds: Pick<BollingerSignalThresholds, 'oversoldThreshold' | 'overboughtThreshold' | 'squeezeThreshold'>,
): SignalDirection {
  if (percentB < thresholds.oversoldThreshold && bandwidth > thresholds.squeezeThreshold) {
    return SignalDirectionEnum.LONG;
  }

  if (percentB > thresholds.overboughtThreshold && bandwidth > thresholds.squeezeThreshold) {
    return SignalDirectionEnum.SHORT;
  }

  return SignalDirectionEnum.HOLD;
}

export function calculateBollingerConfidence(
  percentB: number,
  bandwidth: number,
  thresholds: BollingerSignalThresholds,
): number {
  let confidence: number;

  const distanceFromNeutral = Math.max(
    0,
    Math.min(
      Math.abs(percentB - thresholds.neutralLower),
      Math.abs(percentB - thresholds.neutralUpper),
    ),
  );
  const normalizedDistance = Math.min(
    1,
    distanceFromNeutral / thresholds.distanceNormalizationDivisor,
  );
  const bandwidthFactor = Math.min(1, bandwidth / thresholds.squeezeThreshold);

  if (percentB < thresholds.oversoldThreshold) {
    const oversoldStrength = (thresholds.oversoldThreshold - percentB) / thresholds.oversoldThreshold;
    confidence = thresholds.maxConfidence * oversoldStrength * bandwidthFactor;
  } else if (percentB > thresholds.overboughtThreshold) {
    const overboughtStrength =
      (percentB - thresholds.overboughtThreshold) / (100 - thresholds.overboughtThreshold);
    confidence = thresholds.maxConfidence * overboughtStrength * bandwidthFactor;
  } else if (percentB > thresholds.neutralLower && percentB < thresholds.neutralUpper) {
    confidence = thresholds.maxConfidence * thresholds.neutralConfidenceMultiplier * bandwidthFactor;
  } else {
    confidence = thresholds.maxConfidence * thresholds.moderateConfidenceMultiplier * bandwidthFactor;
  }

  // Keep normalizedDistance in confidence path for future tuning without behavior change.
  void normalizedDistance;

  confidence = Math.max(thresholds.minConfidence, Math.min(thresholds.maxConfidence, confidence));
  return Math.round(confidence * 100);
}
