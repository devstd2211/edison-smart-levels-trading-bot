export type ImbalanceSpikeParams = {
  currentRatio: number;
  historicalRatio: number;
  minRatioChange: number;
};

export type ImbalanceSpikeEvaluation = {
  detected: boolean;
  direction: 'LONG' | 'SHORT' | null;
  ratioChange: number;
};

export function evaluateImbalanceSpike(params: ImbalanceSpikeParams): ImbalanceSpikeEvaluation {
  const { currentRatio, historicalRatio, minRatioChange } = params;
  const ratioChange = currentRatio / historicalRatio;

  if (ratioChange >= 1 + minRatioChange) {
    return { detected: true, direction: 'LONG', ratioChange };
  }

  if (ratioChange <= 1 / (1 + minRatioChange)) {
    return { detected: true, direction: 'SHORT', ratioChange };
  }

  return { detected: false, direction: null, ratioChange };
}
