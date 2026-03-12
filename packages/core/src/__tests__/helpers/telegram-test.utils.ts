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
  const mockConfig = createMockTelegramConfig();
  const mockLogger = createMockTelegramLogger();
  const mockErrorHandler = createMockTelegramErrorHandler();
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const telegramService = new TelegramService(mockConfig, mockLogger, mockErrorHandler);

  return {
    telegramService,
    mockConfig,
    mockLogger,
    mockErrorHandler,
    fetchMock,
  };
}
