import type { RiskRewardValidation } from '../enhanced-exit.service';

export function blockedRiskRewardValidation(recommendation: string): RiskRewardValidation {
  return {
    valid: false,
    riskRewardRatio: 0,
    riskPercent: 0,
    rewardPercent: 0,
    recommendation,
  };
}
