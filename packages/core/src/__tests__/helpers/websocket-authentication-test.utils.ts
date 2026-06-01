import { ErrorHandler } from '../../errors/ErrorHandler';
import type { ErrorLogger } from '../../errors/ErrorHandler';
import {
  WebSocketAuthenticationService,
  createWebSocketAuthenticationCollaborators as createWebSocketAuthenticationCollaboratorsInternal,
  type WebSocketAuthenticationCollaborators,
} from '../../services/websocket-authentication.service';
import { cleanupManagedHarnesses } from './managed-test-context.utils';

export type AuthLogger = Partial<
  Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>
>;

export type MockErrorLogger = jest.Mocked<ErrorLogger>;

export type WebSocketAuthenticationServiceFactoryOptions = {
  logger?: AuthLogger;
  errorHandler?: ErrorHandler;
  collaborators?: WebSocketAuthenticationCollaborators;
  withErrorHandler?: boolean;
};

export type WebSocketAuthenticationLegacyFactoryOptions = {
  logger?: AuthLogger;
};

export type WebSocketAuthenticationLoggerlessFactoryOptions = {
  errorHandler?: ErrorHandler;
  collaborators?: WebSocketAuthenticationCollaborators;
  withErrorHandler?: boolean;
};

type ResolvedWebSocketAuthenticationHarnessState = {
  collaborators?: WebSocketAuthenticationCollaborators;
  defaultWithErrorHandler: boolean;
  errorHandler: ErrorHandler;
  errorLogger: MockErrorLogger;
  mockLogger: AuthLogger;
};

export type WebSocketAuthenticationHarness = {
  service: WebSocketAuthenticationService;
  errorHandler: ErrorHandler;
  mockLogger: AuthLogger;
  errorLogger: MockErrorLogger;
  createStandardService: (options?: WebSocketAuthenticationServiceFactoryOptions) => WebSocketAuthenticationService;
  createService: (options?: WebSocketAuthenticationServiceFactoryOptions) => WebSocketAuthenticationService;
  createLegacyService: (options?: WebSocketAuthenticationLegacyFactoryOptions) => WebSocketAuthenticationService;
  createServiceWithoutLogger: (options?: WebSocketAuthenticationLoggerlessFactoryOptions) => WebSocketAuthenticationService;
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

export function createWebSocketAuthenticationCollaborators(
  overrides: Partial<WebSocketAuthenticationCollaborators> = {},
): WebSocketAuthenticationCollaborators {
  return createWebSocketAuthenticationCollaboratorsInternal(overrides);
}

function resolveWebSocketAuthenticationHarnessState(
  options: WebSocketAuthenticationServiceFactoryOptions,
): ResolvedWebSocketAuthenticationHarnessState {
  const mockLogger = options.logger ?? createMockWebSocketAuthLogger();
  const errorLogger = createMockWebSocketAuthErrorLogger();

  return {
    collaborators: options.collaborators,
    defaultWithErrorHandler: options.withErrorHandler !== false,
    errorHandler: options.errorHandler ?? new ErrorHandler(errorLogger),
    errorLogger,
    mockLogger,
  };
}

function createResolvedWebSocketAuthenticationService(
  state: ResolvedWebSocketAuthenticationHarnessState,
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): WebSocketAuthenticationService {
  if (options.withErrorHandler === false) {
    return createLegacyWebSocketAuthenticationService({
      logger: options.logger,
    });
  }

  const logger = Object.prototype.hasOwnProperty.call(options, 'logger')
    ? options.logger
    : state.mockLogger;

  return createStandardWebSocketAuthenticationService({
    logger,
    errorHandler: options.errorHandler ?? state.errorHandler,
    collaborators: options.collaborators ?? state.collaborators,
  });
}

function createResolvedLoggerlessWebSocketAuthenticationService(
  state: ResolvedWebSocketAuthenticationHarnessState,
  options: WebSocketAuthenticationLoggerlessFactoryOptions = {},
): WebSocketAuthenticationService {
  if (options.withErrorHandler === false) {
    return createLegacyWebSocketAuthenticationService({
      logger: undefined,
    });
  }

  return createStandardWebSocketAuthenticationService({
    logger: undefined,
    errorHandler: options.errorHandler ?? state.errorHandler,
    collaborators: options.collaborators ?? state.collaborators,
  });
}

export function createWebSocketAuthenticationHarness(
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): WebSocketAuthenticationHarness {
  const state = resolveWebSocketAuthenticationHarnessState(options);
  const service = createResolvedWebSocketAuthenticationService(state, {
    logger: state.mockLogger,
    withErrorHandler: state.defaultWithErrorHandler,
  });

  return {
    service,
    errorHandler: state.errorHandler,
    mockLogger: state.mockLogger,
    errorLogger: state.errorLogger,
    createStandardService: (serviceOptions = {}) =>
      createResolvedWebSocketAuthenticationService(state, {
        ...serviceOptions,
        logger: Object.prototype.hasOwnProperty.call(serviceOptions, 'logger')
          ? serviceOptions.logger
          : state.mockLogger,
        withErrorHandler: true,
      }),
    createService: (serviceOptions = {}) =>
      createResolvedWebSocketAuthenticationService(state, {
        ...serviceOptions,
        logger: Object.prototype.hasOwnProperty.call(serviceOptions, 'logger')
          ? serviceOptions.logger
          : state.mockLogger,
        withErrorHandler: serviceOptions.withErrorHandler ?? state.defaultWithErrorHandler,
      }),
    createLegacyService: (serviceOptions = {}) =>
      createLegacyWebSocketAuthenticationService({
        logger: Object.prototype.hasOwnProperty.call(serviceOptions, 'logger')
          ? serviceOptions.logger
          : state.mockLogger,
      }),
    createServiceWithoutLogger: (serviceOptions = {}) =>
      createResolvedLoggerlessWebSocketAuthenticationService(state, {
        ...serviceOptions,
        withErrorHandler: serviceOptions.withErrorHandler ?? state.defaultWithErrorHandler,
      }),
  };
}

export function createManagedWebSocketAuthenticationContext(
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): ManagedWebSocketAuthenticationContext {
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
      cleanupManagedHarnesses({
        trackedHarnesses: [...trackedServices],
        clearTimers: true,
        afterCleanup: () => {
          trackedServices.clear();
          jest.restoreAllMocks();
        },
      });
    },
  };
}

export function createStandardWebSocketAuthenticationService(
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): WebSocketAuthenticationService {
  return new WebSocketAuthenticationService(
    options.logger,
    options.errorHandler,
    options.collaborators,
  );
}

export function createLegacyWebSocketAuthenticationService(
  options: WebSocketAuthenticationLegacyFactoryOptions = {},
): WebSocketAuthenticationService {
  return new WebSocketAuthenticationService(options.logger);
}

export function createWebSocketAuthenticationService(
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): WebSocketAuthenticationService {
  return options.withErrorHandler === false
    ? createLegacyWebSocketAuthenticationService(options)
    : createStandardWebSocketAuthenticationService(options);
}

export function createWebSocketAuthenticationServiceWithHarness(
  options: WebSocketAuthenticationServiceFactoryOptions = {},
): WebSocketAuthenticationService {
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
