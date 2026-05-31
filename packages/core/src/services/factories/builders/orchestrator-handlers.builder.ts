import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { TradingOrchestrator } from '../../trading-orchestrator.service';
import { StrategyRegistryService } from '../../multi-strategy/strategy-registry.service';
import { getErrorMessage } from '../../../utils/error.utils';
import { createTradingOrchestratorConfig } from './orchestrator-config.builder';
import { initializeOrchestratorEventHandlers } from './orchestrator-event-handlers.builder';
import { linkBtcStores } from './orchestrator-btc.builder';

type OrchestratorHandlersBuilderState = Pick<
  BotServiceState,
  | 'logger'
  | 'candleProvider'
  | 'timeframeProvider'
  | 'bybitService'
  | 'positionManager'
  | 'telegram'
  | 'riskManager'
  | 'positionExitingService'
  | 'indicatorPreCalc'
  | 'publicWebSocket'
  | 'webSocketManager'
  | 'journal'
  | 'btcCandles1m'
  | 'tradingOrchestrator'
  | 'positionEventHandler'
  | 'webSocketEventHandler'
  | 'strategyOrchestrator'
>;

export type OrchestratorHandlersConfig = {
  orchestratorConfig: ReturnType<typeof createTradingOrchestratorConfig>;
  btcConfirmationEnabled: boolean;
  multiStrategyEnabled: boolean;
};

export const createOrchestratorHandlersConfig = (
  config: Config,
): OrchestratorHandlersConfig => ({
  orchestratorConfig: createTradingOrchestratorConfig(config),
  btcConfirmationEnabled: config.btcConfirmation?.enabled === true,
  multiStrategyEnabled: config.multiStrategy?.enabled === true,
});

export const initializeOrchestratorAndHandlers = (
  state: OrchestratorHandlersBuilderState,
  config: Config,
): void => {
  const orchestratorHandlersConfig = createOrchestratorHandlersConfig(config);

  state.logger.info('[Orchestrator] Config prepared', {
    hasBtcConfirmation: !!orchestratorHandlersConfig.orchestratorConfig.btcConfirmation,
    btcEnabled: orchestratorHandlersConfig.orchestratorConfig.btcConfirmation?.enabled,
  });

  state.tradingOrchestrator = new TradingOrchestrator(
    orchestratorHandlersConfig.orchestratorConfig,
    state.candleProvider,
    state.timeframeProvider,
    state.bybitService,
    state.positionManager,
    state.telegram,
    state.logger,
    state.riskManager,
    state.positionExitingService,
  );

  state.tradingOrchestrator.setIndicatorPreCalculationService(state.indicatorPreCalc);
  state.logger.info('[Orchestrator] Pre-calculation service linked to TradingOrchestrator');

  if (orchestratorHandlersConfig.multiStrategyEnabled) {
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
  linkBtcStores(state, orchestratorHandlersConfig.btcConfirmationEnabled);
};
