import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { initializePublicMarketDataServices } from './public-market-data.builder';
import { initializeWebSocketManager } from './websocket-manager-service.builder';
import { createPositionMonitorDependencies } from './position-monitoring-support.builder';
import { initializePositionMonitor } from './position-monitor-service.builder';

export const initializeWebSocketAndMonitoring = (
  state: BotServiceState,
  config: Config,
): void => {
  initializeWebSocketManager(state, config);
  initializePublicMarketDataServices(state, config);
  initializePositionMonitor(state, config, createPositionMonitorDependencies(state));
};
