import { ErrorHandler } from '../../errors';
import { EntryConfirmationManager } from '../../services/entry-confirmation.service';
import {
  EntryConfirmationConfig,
  LoggerService,
  LogLevel,
  SignalDirection,
} from '../../types/legacy';

export function createEntryConfirmationLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createEntryConfirmationConfig(
  overrides: Partial<EntryConfirmationConfig> = {},
): EntryConfirmationConfig {
  return {
    long: {
      enabled: true,
      expirySeconds: 120,
      ...overrides.long,
    },
    short: {
      enabled: true,
      expirySeconds: 120,
      ...overrides.short,
    },
  };
}

export function createEntryConfirmationHarness(options: {
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createEntryConfirmationLogger();
  const config = createEntryConfirmationConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const manager =
    options.withErrorHandler === false
      ? createLegacyEntryConfirmationManager({
          config,
          logger,
        })
      : createStandardEntryConfirmationManager({
          config,
          logger,
          errorHandler,
        });

  return {
    manager,
    logger,
    config,
    errorHandler,
  };
}

export interface ManagedEntryConfirmationContext {
  manager: EntryConfirmationManager;
  logger: LoggerService;
  config: EntryConfirmationConfig;
  errorHandler: ErrorHandler | undefined;
  createManager: (overrides?: {
    config?: EntryConfirmationConfig;
    configOverrides?: Partial<EntryConfirmationConfig>;
    withErrorHandler?: boolean;
    errorHandler?: ErrorHandler;
  }) => EntryConfirmationManager;
  cleanup: () => void;
}

export type EntryConfirmationManagedRuntime = Pick<
  ManagedEntryConfirmationContext,
  'manager' | 'logger' | 'errorHandler'
>;

export type EntryConfirmationManagedFactories = Pick<
  ManagedEntryConfirmationContext,
  'cleanup'
>;

export function createEntryConfirmationManager(options: {
  config?: EntryConfirmationConfig;
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): EntryConfirmationManager {
  const logger = options.logger ?? createEntryConfirmationLogger();
  const config = options.config ?? createEntryConfirmationConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new EntryConfirmationManager(
    config,
    logger,
    errorHandler,
  );
}

export function createStandardEntryConfirmationManager(options: {
  config?: EntryConfirmationConfig;
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): EntryConfirmationManager {
  return createEntryConfirmationManager({
    config: options.config,
    configOverrides: options.configOverrides,
    logger: options.logger,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyEntryConfirmationManager(options: {
  config?: EntryConfirmationConfig;
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
} = {}): EntryConfirmationManager {
  return createEntryConfirmationManager({
    config: options.config,
    configOverrides: options.configOverrides,
    logger: options.logger,
    withErrorHandler: false,
  });
}

export function createPendingEntryInput(
  overrides: Partial<{
    symbol: string;
    direction: SignalDirection;
    keyLevel: number;
    detectedAt: number;
    signalData: Record<string, unknown>;
  }> = {},
) {
  return {
    symbol: 'APEXUSDT',
    direction: SignalDirection.LONG,
    keyLevel: 1.5,
    detectedAt: Date.now(),
    signalData: {},
    ...overrides,
  };
}

export function createLongPendingEntryInput(
  overrides: Partial<{
    symbol: string;
    keyLevel: number;
    detectedAt: number;
    signalData: Record<string, unknown>;
  }> = {},
) {
  return createPendingEntryInput({
    direction: SignalDirection.LONG,
    ...overrides,
  });
}

export function createShortPendingEntryInput(
  overrides: Partial<{
    symbol: string;
    keyLevel: number;
    detectedAt: number;
    signalData: Record<string, unknown>;
  }> = {},
) {
  return createPendingEntryInput({
    symbol: 'BTCUSDT',
    direction: SignalDirection.SHORT,
    keyLevel: 50000,
    ...overrides,
  });
}

export function createEntryConfirmationManagerWithHarness(options: {
  config?: EntryConfirmationConfig;
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): EntryConfirmationManager {
  return options.withErrorHandler === false
    ? createLegacyEntryConfirmationManager(options)
    : createStandardEntryConfirmationManager(options);
}

export function createEntryConfirmationFactory(options: {
  config?: EntryConfirmationConfig;
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createEntryConfirmationLogger();
  const config = options.config ?? createEntryConfirmationConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    config,
    errorHandler,
    createManager: (overrides: {
      config?: EntryConfirmationConfig;
      configOverrides?: Partial<EntryConfirmationConfig>;
      withErrorHandler?: boolean;
      errorHandler?: ErrorHandler;
    } = {}) =>
      (overrides.withErrorHandler ?? options.withErrorHandler) === false
        ? createLegacyEntryConfirmationManager({
            config: overrides.config,
            configOverrides: overrides.configOverrides,
            logger,
          })
        : createStandardEntryConfirmationManager({
            config: overrides.config,
            configOverrides: overrides.configOverrides,
            logger,
            errorHandler: overrides.errorHandler ?? errorHandler,
          }),
  };
}

export function createManagedEntryConfirmationContext(options: {
  configOverrides?: Partial<EntryConfirmationConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): ManagedEntryConfirmationContext {
  const harness = createEntryConfirmationHarness(options);
  const factory = createEntryConfirmationFactory({
    config: harness.config,
    logger: harness.logger,
    withErrorHandler: options.withErrorHandler,
    errorHandler: options.withErrorHandler === false ? undefined : options.errorHandler ?? harness.errorHandler,
  });

  return {
    ...harness,
    createManager: factory.createManager,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}
