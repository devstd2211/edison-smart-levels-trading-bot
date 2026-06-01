import {
  ConfigurationError,
  ExchangeAPIError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
  PositionMonitoringError,
  WebSocketConnectionError,
} from '../../errors/DomainErrors';
import { classifyBotInitializerError } from '../../services/bot-initializer/bot-initializer-error.utils';

describe('bot-initializer error utils', () => {
  test('classifies network failures as exchange connection errors', () => {
    const error = classifyBotInitializerError(
      new Error('ECONNREFUSED: Connection refused'),
      'initializeBybit',
      { exchangeName: 'bybit' },
    );

    expect(error).toBeInstanceOf(ExchangeConnectionError);
  });

  test('classifies rate limits as exchange rate limit errors', () => {
    const error = classifyBotInitializerError(
      new Error('Rate limit exceeded: 429'),
      'syncTimeWithExchange',
    );

    expect(error).toBeInstanceOf(ExchangeRateLimitError);
  });

  test('classifies monitoring operations before websocket heuristics', () => {
    const error = classifyBotInitializerError(
      new Error('ws:// feed failed'),
      'startPositionMonitor',
    );

    expect(error).toBeInstanceOf(PositionMonitoringError);
  });

  test('classifies websocket failures from operation names', () => {
    const error = classifyBotInitializerError(
      new Error('startup failed'),
      'connectWebSocket(Public WebSocket)',
    );

    expect(error).toBeInstanceOf(WebSocketConnectionError);
  });

  test('classifies secure websocket endpoint failures from runtime context', () => {
    const error = classifyBotInitializerError(
      new Error('startup failed'),
      'connectFeed',
      { url: 'wss://stream.bybit.com/v5/public/linear' },
    );

    expect(error).toBeInstanceOf(WebSocketConnectionError);
  });

  test('classifies uppercase timeout failures as exchange connection errors', () => {
    const originalError = new Error('NETWORK TIMEOUT DURING BOOTSTRAP');
    const error = classifyBotInitializerError(
      originalError,
      'initializeBybit',
      { exchangeName: 'paper-trading' },
    );

    expect(error).toBeInstanceOf(ExchangeConnectionError);
    expect((error as ExchangeConnectionError).originalError).toBe(originalError);
  });

  test('classifies session/stat failures as configuration errors', () => {
    const error = classifyBotInitializerError(
      new Error('stats unavailable'),
      'sessionStats.startSession',
    );

    expect(error).toBeInstanceOf(ConfigurationError);
  });

  test('falls back to exchange api errors for uncategorized failures', () => {
    const error = classifyBotInitializerError(
      new Error('unexpected failure'),
      'initializeCandleProvider',
    );

    expect(error).toBeInstanceOf(ExchangeAPIError);
  });
});
