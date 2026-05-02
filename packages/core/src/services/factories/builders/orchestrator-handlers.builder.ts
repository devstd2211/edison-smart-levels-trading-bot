import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { TradingOrchestrator } from '../../trading-orchestrator.service';
import { StrategyRegistryService } from '../../multi-strategy/strategy-registry.service';
import { RiskManager } from '../../risk-manager.service';
import { getErrorMessage } from '../../../utils/error.utils';
import { createTradingOrchestratorConfig } from './orchestrator-config.builder';
import { initializeOrchestratorEventHandlers } from './orchestrator-event-handlers.builder';
import { linkBtcStores } from './orchestrator-btc.builder';

export const initializeOrchestratorAndHandlers = (
  state: BotServicesState,
  riskManager: RiskManager,
  config: Config,
): void => {
  const orchestratorConfig = createTradingOrchestratorConfig(config);

  state.logger.info('[Orchestrator] Config prepared', {
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
  state.logger.info('[Orchestrator] Pre-calculation service linked to TradingOrchestrator');

  if (config.btcConfirmation?.enabled) {
    state.tradingOrchestrator.setBtcCandlesStore(state);
    state.logger.info('[Orchestrator] BTC candles store linked to TradingOrchestrator');
  }

  const multiStrategyMode = config.multiStrategy?.enabled || false;
  if (multiStrategyMode) {
    try {
      const strategyRegistry = new StrategyRegistryService();
      state.logger.warn('[StrategyOrchestrator] Not initialized: missing factory/state manager');
      state.strategyOrchestrator = undefined;
    } catch (error) {
      state.logger.warn('[StrategyOrchestrator] Failed to initialize', {
        error: getErrorMessage(error),
        fallbackMode: 'single-strategy',
      });
    }
  }

  initializeOrchestratorEventHandlers(state);
  linkBtcStores(state, config);
};
