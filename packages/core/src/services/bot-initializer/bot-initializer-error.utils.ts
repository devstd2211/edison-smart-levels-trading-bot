import {
  ConfigurationError,
  ExchangeAPIError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
  PositionMonitoringError,
  WebSocketConnectionError,
} from '../../errors/DomainErrors';
import { getErrorMessage } from '../../utils/error.utils';

export function classifyBotInitializerError(
  error: unknown,
  operation: string,
  context: Record<string, unknown> = {},
): Error {
  const errorMessage = getErrorMessage(error);
  const originalError = error instanceof Error ? error : undefined;

  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network')
  ) {
    return new ExchangeConnectionError(
      `Failed during ${operation}`,
      {
        exchangeName: 'bybit',
        ...context,
      },
      originalError,
    );
  }

  if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
    return new ExchangeRateLimitError(
      `Rate limit during ${operation}`,
      { exchangeName: 'bybit', retryAfterMs: 5000, ...context },
      originalError,
    );
  }

  if (
    operation.toLowerCase().includes('monitor') ||
    operation.toLowerCase().includes('position')
  ) {
    return new PositionMonitoringError(
      `Monitor failed during ${operation}`,
      {
        operation,
        reason: errorMessage,
        ...context,
      },
      originalError,
    );
  }

  if (operation.includes('WebSocket') || errorMessage.includes('ws://')) {
    return new WebSocketConnectionError(
      `WS failed during ${operation}`,
      {
        url: typeof context.url === 'string' ? context.url : undefined,
        ...context,
      },
      originalError,
    );
  }

  if (operation.includes('session') || operation.includes('stats')) {
    return new ConfigurationError(
      `Config error during ${operation}`,
      {
        configKey: operation,
        issue: errorMessage,
        ...context,
      },
      originalError,
    );
  }

  return new ExchangeAPIError(
    `Failed during ${operation}`,
    {
      exchangeName: 'bybit',
      ...context,
    },
    originalError,
  );
}
