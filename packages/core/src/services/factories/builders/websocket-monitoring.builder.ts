import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { initializePublicMarketDataServices } from './public-market-data.builder';
import { initializeWebSocketManager } from './websocket-manager-service.builder';
import { createPositionMonitorDependencies } from './position-monitoring-support.builder';
import { initializePositionMonitor } from './position-monitor-service.builder';

export const initializeWebSocketAndMonitoring = (
  state: BotServicesState,
  config: Config,
): void => {
  initializeWebSocketManager(state, config);
  initializePublicMarketDataServices(state, config);
  initializePositionMonitor(state, config, createPositionMonitorDependencies(state));
};
