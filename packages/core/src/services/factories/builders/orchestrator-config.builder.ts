import type { Config, OrchestratorConfig } from '../../../types/legacy';

type TradingOrchestratorRuntimeConfig = OrchestratorConfig & {
  analyzerDefaults?: Config['analyzerDefaults'];
};

export const createTradingOrchestratorConfig = (
  config: Config,
): TradingOrchestratorRuntimeConfig => ({
  contextConfig: {
    atrPeriod: config.indicators.atrPeriod,
    emaPeriod: config.indicators.slowEmaPeriod,
    zigzagDepth: config.indicators.zigzagDepth,
    minimumATR: config.atrFilter?.minimumATR || 0.01,
    maximumATR: config.atrFilter?.maximumATR || 100,
    maxEmaDistance: config.strategy?.emaDistanceThreshold || 0.5,
    filteringMode: config.strategy?.contextFilteringMode || 'HARD_BLOCK',
    atrFilterEnabled: config.atrFilter?.enabled === true,
  },
  entryConfig: {
    rsiPeriod: config.indicators.rsiPeriod,
    fastEmaPeriod: config.indicators.fastEmaPeriod,
    slowEmaPeriod: config.indicators.slowEmaPeriod,
    zigzagDepth: config.indicators.zigzagDepth,
    rsiOversold: config.indicators.rsiOversold,
    rsiOverbought: config.indicators.rsiOverbought,
    stopLossPercent: config.riskManagement.stopLossPercent,
    takeProfits: config.riskManagement.takeProfits,
    priceAction: config?.strategy?.priceAction,
    divergenceDetector: config.entryConfig.divergenceDetector,
  },
  strategiesConfig: config.strategies,
  positionSizeUsdt: config.riskManagement.positionSizeUsdt,
  leverage: config.trading.leverage,
  btcConfirmation: config?.btcConfirmation,
  system: config.system,
  strategicWeights: config.strategicWeights,
  trendConfirmation: config.trendConfirmation,
  analysisConfig: config.analysisConfig,
  volatilityRegime: config.volatilityRegime,
  riskManagement: config.riskManagement,
  indicators: config.indicators,
  analyzers: config.analyzers,
  analyzerDefaults: config.analyzerDefaults,
});
