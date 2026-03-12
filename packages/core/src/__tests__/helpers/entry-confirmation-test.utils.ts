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
} = {}) {
  const logger = options.logger ?? createEntryConfirmationLogger();
  const config = createEntryConfirmationConfig(options.configOverrides);
  const errorHandler = new ErrorHandler(logger);
  const manager = new EntryConfirmationManager(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    manager,
    logger,
    config,
    errorHandler,
  };
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
