import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';

export const linkBtcStores = (
  state: BotServicesState,
  config: Config,
): void => {
  if (!config.btcConfirmation?.enabled) {
    return;
  }

  state.tradingOrchestrator.setBtcCandlesStore(state);
  state.logger.info('[Orchestrator] BTC candles store linked to TradingOrchestrator');

  state.publicWebSocket.setBtcCandlesStore(state);
  state.logger.info('[PublicWebSocket] BTC candles store linked');
};
