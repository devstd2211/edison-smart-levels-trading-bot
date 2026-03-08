import {
  PositionLifecycleState,
  TimeoutAlert,
  TrackedPosition,
} from '../../types/legacy';

export interface TimeoutEvaluation {
  newState: PositionLifecycleState;
  isWarning: boolean;
  isCritical: boolean;
  alert: TimeoutAlert | null;
}

interface EvaluateTimeoutParams {
  position: TrackedPosition;
  holdingTimeMinutes: number;
  maxHoldingMinutes: number;
  warningThresholdMinutes: number;
}

export function evaluatePositionTimeout({
  position,
  holdingTimeMinutes,
  maxHoldingMinutes,
  warningThresholdMinutes,
}: EvaluateTimeoutParams): TimeoutEvaluation {
  if (holdingTimeMinutes >= maxHoldingMinutes) {
    return {
      newState: PositionLifecycleState.CRITICAL,
      isWarning: false,
      isCritical: true,
      alert: {
        positionId: position.positionId,
        symbol: position.symbol,
        holdingTimeMinutes: Math.round(holdingTimeMinutes),
        state: PositionLifecycleState.CRITICAL,
        minutesUntilTimeout: Math.round(holdingTimeMinutes - maxHoldingMinutes) * -1,
      },
    };
  }

  if (holdingTimeMinutes >= warningThresholdMinutes) {
    return {
      newState: PositionLifecycleState.WARNING,
      isWarning: true,
      isCritical: false,
      alert: {
        positionId: position.positionId,
        symbol: position.symbol,
        holdingTimeMinutes: Math.round(holdingTimeMinutes),
        state: PositionLifecycleState.WARNING,
        minutesUntilTimeout: Math.round(maxHoldingMinutes - holdingTimeMinutes),
      },
    };
  }

  return {
    newState: PositionLifecycleState.OPEN,
    isWarning: false,
    isCritical: false,
    alert: null,
  };
}
