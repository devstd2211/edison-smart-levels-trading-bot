import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { AdvancedOrderStateMachineService } from '../../advanced-order-state-machine.service';
import { createOrderStateMachineConfig } from './order-state-machine-config.builder';

export const initializeOrderStateMachineService = (
  state: BotServiceState,
  config: Config,
): void => {
  const orderStateMachine = createOrderStateMachineConfig(config);
  if (!orderStateMachine?.enabled) {
    return;
  }

  state.orderStateMachine = new AdvancedOrderStateMachineService(
    state.logger,
    state.errorHandler,
  );
  state.logger.info('\u2705 Order State Machine initialized (Phase 13.2)', {
    hasErrorHandler: !!state.errorHandler,
  });
};
