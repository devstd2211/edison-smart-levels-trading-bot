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
  errorHandler?: ErrorHandler;
}) {
  const logger =
    options?.logger ?? createAdvancedOrderStateMachineMockLogger();
  const loggerService = logger as unknown as LoggerService;
  const errorHandler =
    options?.withErrorHandler === false
      ? undefined
      : options?.errorHandler ?? createAdvancedOrderStateMachineErrorHandler(logger);
  const service = createAdvancedOrderStateMachineService({
    logger,
    withErrorHandler: options?.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createAdvancedOrderStateMachineErrorHandler(
  logger: AdvancedOrderStateMachineMockLogger = createAdvancedOrderStateMachineMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger as unknown as LoggerService);
}

export function createAdvancedOrderStateMachineService(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
}) {
  const logger =
    options?.logger ?? createAdvancedOrderStateMachineMockLogger();
  const loggerService = logger as unknown as LoggerService;
  return new AdvancedOrderStateMachineService(
    loggerService,
    options?.withErrorHandler === false ? undefined : options?.errorHandler,
  );
}
