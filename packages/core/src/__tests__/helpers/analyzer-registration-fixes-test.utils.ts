export function createAnalyzerRegistrationFixesConfig() {
  return {
    analyzerStrategic: {
      rsiAnalyzer: {
        dynamicShortThresholdMode: 'enabled',
        dynamicShortThreshold: 50,
        dynamicMultiplier: 2,
        atrBasedAdaptation: true,
        minConfidenceAfterFallingKnife: 30,
        risingKnifePenalty: 0.6,
        bounceBonus: 1.1,
        maxConfidence: 70,
        enabled: true,
      },
      chochBosDetector: {
        minSwingPoints: 3,
        baseConfidence: 75,
        bosDetectionStrength: 0.8,
        chochDetectionStrength: 0.85,
        enabled: true,
        logAllDetections: true,
      },
      footprintAnalyzer: {
        resistanceRejectionMode: 'enabled',
        resistanceRejectionConfidence: 70,
        requireRejectWickPercent: 95,
        minClosePositionPercent: 70,
        minBodyToRangeRatio: 0.6,
        baseConfidence: 45,
        logRejectionSignals: true,
      },
      divergenceAnalyzer: {
        hiddenDivergenceMode: 'enabled',
        hiddenBearishDivergenceConfidence: 65,
        hiddenBullishDivergenceConfidence: 65,
        maxConfidence: 80,
        logHiddenDivergences: true,
      },
      wickAnalyzer: {
        adaptiveAging: 'enabled',
        currentCandleConfidencePercent: 100,
        previousCandleConfidencePercent: 70,
        twoThreeCandlesAgoConfidencePercent: 30,
        candleInterval: 60000,
        baseConfidence: 50,
        maxConfidence: 80,
        logWickAge: true,
      },
      trendConflictDetector: {
        enabled: true,
        minConflictingSignals: 2,
        minOppositeSignals: 1,
        conflictConfidence: 60,
        weight: 0.1,
        priority: 8,
        logConflicts: true,
      },
      postTpConsolidation: {
        enabled: true,
        consolidationWaitMinutes: 10,
        firstHalfMinutes: 5,
        firstHalfRequiredConfidence: 0.75,
        secondHalfMinutes: 3,
        secondHalfRequiredConfidence: 0.70,
        logConsolidationWaits: true,
      },
      shortEntryEnhancement: {
        enabled: true,
        minConfidenceShort: 0.75,
        minConfidenceLong: 0.70,
        requireMomentumConfirmation: true,
        requireTrendConfirmation: true,
        logValidations: true,
      },
      entryCostRequirements: {
        enabled: true,
        requireMultipleAnalyzers: true,
        minAnalyzersForShort: 2,
        minAnalyzersForLong: 2,
        allowedBlockedPercentageShort: 40,
        allowedBlockedPercentageLong: 50,
        logAnalyzerCosts: true,
      },
    },
  };
}

export function createAnalyzerRegistrationFixesHarness() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const config = createAnalyzerRegistrationFixesConfig();

  return {
    logger,
    config,
    analyzerStrategic: config.analyzerStrategic,
  };
}
