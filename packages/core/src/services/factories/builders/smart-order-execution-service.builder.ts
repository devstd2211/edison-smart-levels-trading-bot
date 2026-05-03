import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { SmartOrderExecutionService } from '../../smart-order-execution.service';
import { createSmartOrderExecutionConfig } from './smart-order-execution-config.builder';

export const initializeSmartOrderExecutionService = (
  state: BotServicesState,
  config: Config,
): void => {
  const smartOrderExecution = createSmartOrderExecutionConfig(config);
  if (!smartOrderExecution?.enabled) {
    return;
  }

  state.smartOrderExecution = new SmartOrderExecutionService(
    smartOrderExecution,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('\u2705 Smart Order Execution initialized (Phase 13.1)', {
    maxSlippagePercent: smartOrderExecution.maxSlippagePercent,
    executionStrategy: smartOrderExecution.executionStrategy,
    adaptiveExecution: smartOrderExecution.adaptiveExecution,
  });
};
