import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { OrderExecutionDetectorService } from '../../order-execution-detector.service';
import { WebSocketAuthenticationService } from '../../websocket-authentication.service';
import { EventDeduplicationService } from '../../event-deduplication.service';
import { WebSocketKeepAliveService } from '../../websocket-keep-alive.service';
import { WebSocketManagerService } from '../../websocket-manager.service';
import { PublicWebSocketService } from '../../public-websocket.service';
import { OrderbookManagerService } from '../../orderbook-manager.service';
import { ExitTypeDetectorService } from '../../exit-type-detector.service';
import { PositionPnLCalculatorService } from '../../position-pnl-calculator.service';
import { PositionSyncService } from '../../position-sync.service';
import { PositionMonitorService } from '../../position-monitor.service';

export const initializeWebSocketAndMonitoring = (
  state: BotServicesState,
  config: Config,
): void => {
  const orderExecutionDetector = new OrderExecutionDetectorService(state.logger);
  const authService = new WebSocketAuthenticationService();
  const deduplicationService = new EventDeduplicationService(
    100,
    60000,
    state.logger,
    state.errorHandler,
  );
  const keepAliveService = new WebSocketKeepAliveService(20000, state.logger);
  state.webSocketManager = new WebSocketManagerService(
    config.exchange,
    config.exchange.symbol,
    state.errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  );

  state.publicWebSocket = new PublicWebSocketService(
    config.exchange,
    config.exchange.symbol,
    state.timeframeProvider,
    state.logger,
    state.errorHandler,
    config.btcConfirmation,
  );

  state.orderbookManager = new OrderbookManagerService(
    config.exchange.symbol,
    state.logger,
    state.wallTrackerService,
  );

  const exitTypeDetectorService = new ExitTypeDetectorService(state.logger);
  const pnlCalculatorService = new PositionPnLCalculatorService();
  const positionSyncService = new PositionSyncService(
    state.bybitService,
    state.positionManager,
    exitTypeDetectorService,
    state.telegram,
    state.logger,
    state.positionExitingService,
  );

  state.positionMonitor = new PositionMonitorService(
    state.bybitService,
    state.positionManager,
    config.riskManagement,
    state.telegram,
    state.logger,
    exitTypeDetectorService,
    pnlCalculatorService,
    positionSyncService,
    state.positionExitingService,
  );
};
