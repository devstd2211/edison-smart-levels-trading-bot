import { ErrorHandler } from '../../errors/ErrorHandler';
import type { ErrorLogger } from '../../errors/ErrorHandler';
import { WebSocketAuthenticationService } from '../../services/websocket-authentication.service';

export type AuthLogger = Partial<
  Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>
>;

export type MockErrorLogger = jest.Mocked<ErrorLogger>;

export type WebSocketAuthenticationHarness = {
  service: WebSocketAuthenticationService;
  errorHandler: ErrorHandler;
  mockLogger: AuthLogger;
  errorLogger: MockErrorLogger;
};

export function createMockWebSocketAuthLogger(): AuthLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createMockWebSocketAuthErrorLogger(): MockErrorLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createWebSocketAuthenticationHarness(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): WebSocketAuthenticationHarness {
  const mockLogger = options.logger ?? createMockWebSocketAuthLogger();
  const errorLogger = createMockWebSocketAuthErrorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(errorLogger);
  const service = createWebSocketAuthenticationService({
    logger: mockLogger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    errorHandler: (errorHandler ?? new ErrorHandler(errorLogger)),
    mockLogger,
    errorLogger,
  };
}

export function createWebSocketAuthenticationService(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): WebSocketAuthenticationService {
  const logger = options.logger;
  const errorHandler = options.withErrorHandler === false ? undefined : options.errorHandler;

  return new WebSocketAuthenticationService(logger, errorHandler);
}

export function createWebSocketAuthenticationServiceWithHarness(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): WebSocketAuthenticationService {
  return createWebSocketAuthenticationService(options);
}

export function createWebSocketAuthCredentials(overrides: {
  apiKey?: string;
  apiSecret?: string;
} = {}): { apiKey: string; apiSecret: string } {
  return {
    apiKey: overrides.apiKey ?? 'test-key',
    apiSecret: overrides.apiSecret ?? 'test-secret',
  };
}
