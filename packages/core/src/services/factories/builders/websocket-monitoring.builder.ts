import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { initializePublicMarketDataServices } from './public-market-data.builder';
import { initializeWebSocketManager } from './websocket-manager-service.builder';
import { createPositionMonitorDependencies } from './position-monitoring-support.builder';
import { initializePositionMonitor } from './position-monitor-service.builder';

type WebSocketMonitoringBuilderState = Pick<
  BotServiceState,
  | 'logger'
  | 'errorHandler'
  | 'webSocketManager'
  | 'timeframeProvider'
  | 'wallTrackerService'
  | 'publicWebSocket'
  | 'orderbookManager'
  | 'bybitService'
  | 'positionManager'
  | 'telegram'
  | 'positionExitingService'
  | 'positionMonitor'
>;

export type WebSocketMonitoringConfig = Pick<
  Config,
  'exchange' | 'btcConfirmation' | 'riskManagement'
>;

export const createWebSocketMonitoringConfig = (
  config: Pick<Config, 'exchange' | 'btcConfirmation' | 'riskManagement'>,
): WebSocketMonitoringConfig => ({
  exchange: config.exchange,
  btcConfirmation: config.btcConfirmation,
  riskManagement: config.riskManagement,
});

export const initializeWebSocketAndMonitoring = (
  state: WebSocketMonitoringBuilderState,
  config: Pick<Config, 'exchange' | 'btcConfirmation' | 'riskManagement'>,
): void => {
  const webSocketMonitoringConfig = createWebSocketMonitoringConfig(config);

  initializeWebSocketManager(state, webSocketMonitoringConfig);
  initializePublicMarketDataServices(state, webSocketMonitoringConfig);
  initializePositionMonitor(
    state,
    webSocketMonitoringConfig,
    createPositionMonitorDependencies(state),
  );
};
