import {
  ConfigurationError,
  ExchangeAPIError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
  PositionMonitoringError,
  WebSocketConnectionError,
} from '../../errors/DomainErrors';
import { getErrorMessage } from '../../utils/error.utils';

type BotInitializerErrorContext = Record<string, unknown>;

const DEFAULT_EXCHANGE_NAME = 'bybit';

function normalizeBotInitializerErrorValue(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function resolveExchangeName(context: BotInitializerErrorContext): string {
  return typeof context.exchangeName === 'string' && context.exchangeName.length > 0
    ? context.exchangeName
    : DEFAULT_EXCHANGE_NAME;
}

function isConnectionFailure(errorMessage: string): boolean {
  return errorMessage.includes('econnrefused')
    || errorMessage.includes('timeout')
    || errorMessage.includes('network');
}

function isRateLimitFailure(errorMessage: string): boolean {
  return errorMessage.includes('429') || errorMessage.includes('rate limit');
}

function isMonitoringOperation(operation: string): boolean {
  return operation.includes('monitor') || operation.includes('position');
}

function isWebSocketFailure(
  operation: string,
  errorMessage: string,
  context: BotInitializerErrorContext,
): boolean {
  const url = normalizeBotInitializerErrorValue(context.url);
  return operation.includes('websocket')
    || errorMessage.includes('ws://')
    || errorMessage.includes('wss://')
    || url.includes('ws://')
    || url.includes('wss://');
}

function isConfigurationOperation(operation: string): boolean {
  return operation.includes('session') || operation.includes('stats');
}

export function classifyBotInitializerError(
  error: unknown,
  operation: string,
  context: BotInitializerErrorContext = {},
): Error {
  const errorMessage = normalizeBotInitializerErrorValue(getErrorMessage(error));
  const normalizedOperation = normalizeBotInitializerErrorValue(operation);
  const originalError = error instanceof Error ? error : undefined;
  const exchangeName = resolveExchangeName(context);

  if (isConnectionFailure(errorMessage)) {
    return new ExchangeConnectionError(
      `Failed during ${operation}`,
      {
        exchangeName,
        ...context,
      },
      originalError,
    );
  }

  if (isRateLimitFailure(errorMessage)) {
    return new ExchangeRateLimitError(
      `Rate limit during ${operation}`,
      { exchangeName, retryAfterMs: 5000, ...context },
      originalError,
    );
  }

  if (isMonitoringOperation(normalizedOperation)) {
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

  if (isWebSocketFailure(normalizedOperation, errorMessage, context)) {
    return new WebSocketConnectionError(
      `WS failed during ${operation}`,
      {
        url: typeof context.url === 'string' ? context.url : undefined,
        ...context,
      },
      originalError,
    );
  }

  if (isConfigurationOperation(normalizedOperation)) {
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
      exchangeName,
      ...context,
    },
    originalError,
  );
}
