import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { TradingOrchestrator } from '../../trading-orchestrator.service';
import { StrategyRegistryService } from '../../multi-strategy/strategy-registry.service';
import { PositionEventHandler, WebSocketEventHandler } from '../../handlers';
import { RiskManager } from '../../risk-manager.service';
export const initializeOrchestratorAndHandlers = (
  state: BotServicesState,
  riskManager: RiskManager,
  config: Config,
): void => {
  const orchestratorConfig = {
    contextConfig: {
      atrPeriod: config.indicators.atrPeriod,
      emaPeriod: config.indicators.slowEmaPeriod,
      zigzagDepth: config.indicators.zigzagDepth,
      minimumATR: config.atrFilter?.minimumATR || 0.01,
      maximumATR: config.atrFilter?.maximumATR || 100,
      maxEmaDistance: config.strategy?.emaDistanceThreshold || 0.5,
      filteringMode: (config.strategy?.contextFilteringMode) || 'HARD_BLOCK',
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
  };

  state.logger.info('🔬 OrchestratorConfig prepared', {
    hasBtcConfirmation: !!orchestratorConfig.btcConfirmation,
    btcEnabled: orchestratorConfig.btcConfirmation?.enabled,
  });

  state.tradingOrchestrator = new TradingOrchestrator(
    orchestratorConfig,
    state.candleProvider,
    state.timeframeProvider,
    state.bybitService,
    state.positionManager,
    state.telegram,
    state.logger,
    riskManager,
    state.positionExitingService,
  );

  state.tradingOrchestrator.setIndicatorPreCalculationService(state.indicatorPreCalc);
  state.logger.info('🔬 Pre-calculation service linked to TradingOrchestrator');

  if (config.btcConfirmation?.enabled) {
    state.tradingOrchestrator.setBtcCandlesStore(state);
    state.logger.info('🔬 BTC candles store linked to TradingOrchestrator');
  }

  const multiStrategyMode = config.multiStrategy?.enabled || false;
  if (multiStrategyMode) {
    try {
      const strategyRegistry = new StrategyRegistryService();
      state.logger.warn('⚠️ StrategyOrchestratorService not initialized: missing factory/state manager');
      state.strategyOrchestrator = undefined;
    } catch (error) {
      state.logger.warn('⚠️  Failed to initialize StrategyOrchestratorService', {
        error: error instanceof Error ? error.message : String(error),
        fallbackMode: 'single-strategy',
      });
    }
  }

  state.positionEventHandler = new PositionEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.telegram,
    state.logger,
  );

  state.webSocketEventHandler = new WebSocketEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.webSocketManager,
    state.journal,
    state.telegram,
    state.logger,
  );

  if (config.btcConfirmation?.enabled) {
    state.publicWebSocket.setBtcCandlesStore(state);
    state.logger.info('🔬 BTC candles store linked to PublicWebSocket');
  }
};
