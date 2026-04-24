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
  createStandardService: (options?: {
    logger?: AuthLogger;
    errorHandler?: ErrorHandler;
  }) => WebSocketAuthenticationService;
  createService: (options?: {
    logger?: AuthLogger;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  }) => WebSocketAuthenticationService;
  createLegacyService: (options?: {
    logger?: AuthLogger;
  }) => WebSocketAuthenticationService;
  createServiceWithoutLogger: (options?: {
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  }) => WebSocketAuthenticationService;
};

export type ManagedWebSocketAuthenticationContext = WebSocketAuthenticationHarness & {
  cleanup: () => void;
};

export type WebSocketAuthenticationManagedRuntime = Pick<
  ManagedWebSocketAuthenticationContext,
  'service' | 'cleanup' | 'createStandardService'
>;

export type WebSocketAuthenticationServiceRuntime = WebSocketAuthenticationManagedRuntime;

export type WebSocketAuthenticationSharedState = Pick<
  ManagedWebSocketAuthenticationContext,
  'service' | 'errorHandler' | 'mockLogger'
>;

export type WebSocketAuthenticationFactories = Pick<
  ManagedWebSocketAuthenticationContext,
  'cleanup' | 'createService' | 'createLegacyService' | 'createServiceWithoutLogger' | 'createStandardService'
>;

export type WebSocketAuthenticationManagedErrorRuntime = Pick<
  ManagedWebSocketAuthenticationContext,
  | 'service'
  | 'errorHandler'
  | 'mockLogger'
  | 'cleanup'
  | 'createService'
  | 'createLegacyService'
  | 'createServiceWithoutLogger'
>;

export type WebSocketAuthenticationErrorHandlingRuntime =
  WebSocketAuthenticationManagedErrorRuntime;

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
  const service =
    options.withErrorHandler === false
      ? createLegacyWebSocketAuthenticationService({
          logger: mockLogger,
        })
      : createStandardWebSocketAuthenticationService({
          logger: mockLogger,
          errorHandler,
        });

  return {
    service,
    errorHandler: (errorHandler ?? new ErrorHandler(errorLogger)),
    mockLogger,
    errorLogger,
    createStandardService: (serviceOptions = {}) =>
      createStandardWebSocketAuthenticationService({
        logger: serviceOptions.logger ?? mockLogger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createService: (serviceOptions = {}) =>
      serviceOptions.withErrorHandler === false
        ? createLegacyWebSocketAuthenticationService({
            logger: serviceOptions.logger ?? mockLogger,
          })
        : createStandardWebSocketAuthenticationService({
            logger: serviceOptions.logger ?? mockLogger,
            errorHandler: serviceOptions.errorHandler ?? errorHandler,
          }),
    createLegacyService: (serviceOptions = {}) =>
      createLegacyWebSocketAuthenticationService({
        logger: serviceOptions.logger ?? mockLogger,
      }),
    createServiceWithoutLogger: (serviceOptions = {}) =>
      serviceOptions.withErrorHandler === false
        ? createLegacyWebSocketAuthenticationService({
            logger: undefined,
          })
        : createStandardWebSocketAuthenticationService({
            logger: undefined,
            errorHandler: serviceOptions.errorHandler ?? errorHandler,
          }),
  };
}

export function createManagedWebSocketAuthenticationContext(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedWebSocketAuthenticationContext {
  const harness = createWebSocketAuthenticationHarness(options);
  const trackedServices = new Set<WebSocketAuthenticationService>([harness.service]);
  const trackService = (service: WebSocketAuthenticationService): WebSocketAuthenticationService => {
    trackedServices.add(service);
    return service;
  };

  return {
    ...harness,
    createStandardService: (serviceOptions = {}) =>
      trackService(harness.createStandardService(serviceOptions)),
    createService: (serviceOptions = {}) =>
      trackService(harness.createService(serviceOptions)),
    createLegacyService: (serviceOptions = {}) =>
      trackService(harness.createLegacyService(serviceOptions)),
    createServiceWithoutLogger: (serviceOptions = {}) =>
      trackService(harness.createServiceWithoutLogger(serviceOptions)),
    cleanup: () => {
      trackedServices.clear();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.restoreAllMocks();
    },
  };
}

export function createStandardWebSocketAuthenticationService(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
} = {}): WebSocketAuthenticationService {
  return new WebSocketAuthenticationService(options.logger, options.errorHandler);
}

export function createLegacyWebSocketAuthenticationService(options: {
  logger?: AuthLogger;
} = {}): WebSocketAuthenticationService {
  return new WebSocketAuthenticationService(options.logger);
}

export function createWebSocketAuthenticationService(options: {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): WebSocketAuthenticationService {
  return options.withErrorHandler === false
    ? createLegacyWebSocketAuthenticationService(options)
    : createStandardWebSocketAuthenticationService(options);
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
    apiKey: overrides.apiKey ?? 'test-key-1234567890',
    apiSecret: overrides.apiSecret ?? 'test-secret-1234567890',
  };
}

export function createShortWebSocketAuthCredentials(): {
  apiKey: string;
  apiSecret: string;
} {
  return createWebSocketAuthCredentials({
    apiKey: 'short',
    apiSecret: 'short',
  });
}

export function createLongWebSocketAuthCredentials(): {
  apiKey: string;
  apiSecret: string;
} {
  return createWebSocketAuthCredentials({
    apiKey: 'a'.repeat(1000),
    apiSecret: 'b'.repeat(1000),
  });
}

export function createSpecialWebSocketAuthCredentials(): {
  apiKey: string;
  apiSecret: string;
} {
  return createWebSocketAuthCredentials({
    apiKey: 'key-!@#$%^&*()_+-=[]{}|;:,.<>?',
    apiSecret: 'secret-!@#$%^&*()_+-=[]{}|;:,.<>?',
  });
}

export function createUnicodeWebSocketAuthCredentials(): {
  apiKey: string;
  apiSecret: string;
} {
  return createWebSocketAuthCredentials({
    apiKey: 'key-aeoeue-russkiy-arabic',
    apiSecret: 'secret-chinese-hindi-thai',
  });
}
