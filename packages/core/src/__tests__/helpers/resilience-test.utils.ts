import { ErrorHandler } from '../../errors/ErrorHandler';
import type { ILifecycle } from '../../interfaces/ILifecycle';
import { LoggerService } from '../../services/logger.service';

type MockLogger = Partial<LoggerService>;

export interface ResilienceTestHarness {
  logger: MockLogger;
  errorHandler: ErrorHandler;
  trackLifecycle: <T extends ILifecycle>(service: T, options?: { start?: boolean }) => T;
  stopTrackedServices: () => void;
}

export function createMockResilienceLogger(): MockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function createResilienceTestHarness(): ResilienceTestHarness {
  const logger = createMockResilienceLogger();
  const errorHandler = new ErrorHandler(logger as LoggerService);
  const trackedServices: ILifecycle[] = [];

  return {
    logger,
    errorHandler,
    trackLifecycle<T extends ILifecycle>(service: T, options: { start?: boolean } = {}): T {
      trackedServices.push(service);

      if (options.start !== false) {
        service.start();
      }

      return service;
    },
    stopTrackedServices(): void {
      while (trackedServices.length > 0) {
        trackedServices.pop()?.stop();
      }
    },
  };
}
