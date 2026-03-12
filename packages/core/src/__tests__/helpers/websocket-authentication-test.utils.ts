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
} = {}): WebSocketAuthenticationHarness {
  const mockLogger = options.logger ?? createMockWebSocketAuthLogger();
  const errorLogger = createMockWebSocketAuthErrorLogger();
  const errorHandler = options.errorHandler ?? new ErrorHandler(errorLogger);
  const service = new WebSocketAuthenticationService(mockLogger, errorHandler);

  return {
    service,
    errorHandler,
    mockLogger,
    errorLogger,
  };
}
