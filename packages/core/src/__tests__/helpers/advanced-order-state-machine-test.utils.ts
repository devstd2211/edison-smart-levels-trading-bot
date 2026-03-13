import { ErrorHandler } from '../../errors/ErrorHandler';
import { AdvancedOrderStateMachineService } from '../../services/advanced-order-state-machine.service';
import type { LoggerService } from '../../types/legacy';

export type AdvancedOrderStateMachineMockLogger = jest.Mocked<
  Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>
>;

export function createAdvancedOrderStateMachineMockLogger():
  AdvancedOrderStateMachineMockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as AdvancedOrderStateMachineMockLogger;
}

export function createAdvancedOrderStateMachineHarness(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
  withErrorHandler?: boolean;
}) {
  const logger =
    options?.logger ?? createAdvancedOrderStateMachineMockLogger();
  const loggerService = logger as unknown as LoggerService;
  const errorHandler = new ErrorHandler(loggerService);
  const service = new AdvancedOrderStateMachineService(
    loggerService,
    options?.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    errorHandler,
  };
}
