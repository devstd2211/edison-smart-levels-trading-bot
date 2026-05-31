import type { BotServiceState } from '../../bot-services.builder';

type OrchestratorBtcLinkState = Pick<
  BotServiceState,
  'logger' | 'tradingOrchestrator' | 'publicWebSocket' | 'btcCandles1m'
>;

export const linkBtcStores = (
  state: OrchestratorBtcLinkState,
  btcConfirmationEnabled: boolean,
): void => {
  if (!btcConfirmationEnabled) {
    return;
  }

  state.tradingOrchestrator.setBtcCandlesStore(state);
  state.logger.info('[Orchestrator] BTC candles store linked to TradingOrchestrator');

  state.publicWebSocket.setBtcCandlesStore(state);
  state.logger.info('[PublicWebSocket] BTC candles store linked');
};
