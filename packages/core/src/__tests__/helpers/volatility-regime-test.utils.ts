import { ErrorHandler } from '../../errors/ErrorHandler';
import { VolatilityRegimeService } from '../../services/volatility-regime.service';
import {
  LoggerService,
  LogLevel,
  VolatilityRegimeConfig,
} from '../../types/legacy';

export function createVolatilityRegimeLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createVolatilityRegimeMockLogger(methodToFail?: string): LoggerService {
  return {
    minLevel: 'debug',
    logDir: '/tmp',
    logToFile: false,
    logs: [],
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') {
        throw new Error('Logger.info failed');
      }
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') {
        throw new Error('Logger.warn failed');
      }
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') {
        throw new Error('Logger.debug failed');
      }
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') {
        throw new Error('Logger.error failed');
      }
    }),
  } as unknown as LoggerService;
}

export function createVolatilityRegimeHarness(options: {
  logger?: LoggerService;
  config?: Partial<VolatilityRegimeConfig>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createVolatilityRegimeLogger();
  const errorHandler = new ErrorHandler(logger);
  const service = new VolatilityRegimeService(
    logger,
    options.config,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    errorHandler,
  };
}
