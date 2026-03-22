import { ErrorHandler, ErrorHandlingResult, RecoveryStrategy } from '../../errors/ErrorHandler';
import { TradingError, UnknownTradingError } from '../../errors/BaseError';
import { TelegramService, TelegramConfig } from '../../services/telegram.service';
import type { LoggerService } from '../../types/legacy';

export function createMockTelegramConfig(): TelegramConfig {
  return {
    botToken: 'test-bot-token',
    chatId: 'test-chat-id',
    enabled: true,
  };
}

export function createMockTelegramLogger(): jest.Mocked<LoggerService> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

export function createMockTelegramErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn(async (error, options): Promise<ErrorHandlingResult> => {
      const tradingError =
        error instanceof TradingError
          ? error
          : new UnknownTradingError(String(error), error instanceof Error ? error : undefined);

      return {
        success: true,
        recovered: options.strategy !== RecoveryStrategy.SKIP,
        attempts: 1,
        message: 'Handled successfully',
        strategy: options.strategy,
        error: tradingError,
      };
    }),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createTelegramHarness() {
  const originalFetch = global.fetch;
  const mockConfig = createMockTelegramConfig();
  const mockLogger = createMockTelegramLogger();
  const mockErrorHandler = createMockTelegramErrorHandler();
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const telegramService = createTelegramService({
    config: mockConfig,
    logger: mockLogger,
    errorHandler: mockErrorHandler,
  });

  return {
    telegramService,
    mockConfig,
    mockLogger,
    mockErrorHandler,
    fetchMock,
    originalFetch,
  };
}

export interface ManagedTelegramContext {
  telegramService: TelegramService;
  mockConfig: TelegramConfig;
  mockLogger: jest.Mocked<LoggerService>;
  mockErrorHandler: jest.Mocked<ErrorHandler>;
  fetchMock: jest.Mock;
  cleanup: () => void;
}

export function createStandardTelegramService(options: {
  config?: TelegramConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): TelegramService {
  return createTelegramService({
    ...options,
    withErrorHandler: true,
  });
}

export function createLegacyTelegramService(options: {
  config?: TelegramConfig;
  logger?: LoggerService;
} = {}): TelegramService {
  return createTelegramService({
    ...options,
    withErrorHandler: false,
  });
}

export function createTelegramService(options: {
  config?: TelegramConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): TelegramService {
  return new TelegramService(
    options.config ?? createMockTelegramConfig(),
    options.logger ?? createMockTelegramLogger(),
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? createMockTelegramErrorHandler(),
  );
}

export function createManagedTelegramContext(): ManagedTelegramContext {
  jest.clearAllMocks();
  const harness = createTelegramHarness();

  return {
    telegramService: harness.telegramService,
    mockConfig: harness.mockConfig,
    mockLogger: harness.mockLogger,
    mockErrorHandler: harness.mockErrorHandler,
    fetchMock: harness.fetchMock,
    cleanup: () => {
      global.fetch = harness.originalFetch;
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
