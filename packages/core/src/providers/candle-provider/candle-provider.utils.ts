import { TimeframeRole } from '../../types/enums';
import {
  ExchangeAPIError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
} from '../../errors/DomainErrors';

export interface CandleProviderTimeframeConfig {
  interval: string;
  candleLimit: number;
}

export interface CandleProviderCacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface CandleProviderLoadRequest {
  symbol: string;
  role: TimeframeRole;
  interval: string;
  limit: number;
}

export const CANDLE_PROVIDER_RETRY_ATTEMPTS = 3;
export const CANDLE_PROVIDER_RETRY_BASE_DELAY_MS = 1000;

export function toCandleProviderErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getCandleProviderRetryDelayMs(attempt: number): number {
  return CANDLE_PROVIDER_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
}

export function classifyCandleProviderError(
  error: unknown,
  operation: string,
  timeframeRole?: TimeframeRole,
): Error {
  const errorMessage = toCandleProviderErrorMessage(error);
  const originalError = error instanceof Error ? error : undefined;

  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('EHOSTUNREACH')
  ) {
    return new ExchangeConnectionError(
      `Failed to load candles during ${operation}`,
      { exchangeName: 'bybit', timeframeRole },
      originalError,
    );
  }

  if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
    return new ExchangeRateLimitError(
      'Rate limit while loading candles',
      { exchangeName: 'bybit', retryAfterMs: 5000, timeframeRole },
      originalError,
    );
  }

  return new ExchangeAPIError(
    `Failed during ${operation}`,
    { exchangeName: 'bybit', timeframeRole },
    originalError,
  );
}
