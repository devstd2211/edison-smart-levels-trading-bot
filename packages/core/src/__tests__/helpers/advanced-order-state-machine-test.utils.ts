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
  const service =
    options?.withErrorHandler === false
      ? createLegacyAdvancedOrderStateMachineService({
          logger,
        })
      : createStandardAdvancedOrderStateMachineService({
          logger,
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

export function createStandardAdvancedOrderStateMachineService(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
  errorHandler?: ErrorHandler;
}) {
  const logger =
    options?.logger ?? createAdvancedOrderStateMachineMockLogger();
  const loggerService = logger as unknown as LoggerService;
  return new AdvancedOrderStateMachineService(
    loggerService,
    options?.errorHandler,
  );
}

export function createLegacyAdvancedOrderStateMachineService(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
}) {
  const logger =
    options?.logger ?? createAdvancedOrderStateMachineMockLogger();
  const loggerService = logger as unknown as LoggerService;
  return new AdvancedOrderStateMachineService(loggerService);
}

export function createAdvancedOrderStateMachineService(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
}) {
  return options?.withErrorHandler === false
    ? createLegacyAdvancedOrderStateMachineService(options)
    : createStandardAdvancedOrderStateMachineService(options);
}

export interface ManagedAdvancedOrderStateMachineContext {
  service: AdvancedOrderStateMachineService;
  logger: AdvancedOrderStateMachineMockLogger;
  errorHandler?: ErrorHandler;
  cleanup: () => void;
}

export function createManagedAdvancedOrderStateMachineContext(options?: {
  logger?: AdvancedOrderStateMachineMockLogger;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
}): ManagedAdvancedOrderStateMachineContext {
  jest.clearAllMocks();

  const harness = createAdvancedOrderStateMachineHarness(options);

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    cleanup: () => {
      harness.service.cleanup();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
