import {
  createRequestScopedErrorEventPayload,
  createRequestScopedErrorLogPayload,
} from '../src/logging/request-scoped-error-log';

describe('request-scoped error log helpers', () => {
  test('builds event-scoped error payloads through the shared request-scoped boundary', () => {
    expect(createRequestScopedErrorEventPayload({
      event: 'watcher-error',
      error: {
        message: 'watch stream failed',
        details: 'fs watcher disconnected',
      },
      eventData: {
        target: 'trade-journal.json',
      },
    })).toEqual({
      event: 'watcher-error',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'watch stream failed',
      details: 'fs watcher disconnected',
      suggestion: 'Please try again or contact support',
      target: 'trade-journal.json',
    });
  });

  test('keeps plain request-scoped payloads free of event metadata', () => {
    expect(createRequestScopedErrorLogPayload({
      message: 'route missing',
      details: 'GET /missing',
    }, {
      requestId: 'req-404',
      fallbackStatusCode: 404,
    })).toEqual({
      requestId: 'req-404',
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'route missing',
      details: 'GET /missing',
      suggestion: 'Check that the requested resource or route exists',
    });
  });

  test('normalizes websocket-scoped request ids before event payloads reuse the shared boundary', () => {
    expect(createRequestScopedErrorEventPayload({
      event: 'message-handler-error',
      error: {
        message: 'status unavailable',
        details: 'bridge status snapshot unavailable',
      },
      requestId: ['req-status', 'req-shadow'],
      requestType: 'GET_STATUS',
      context: 'status request',
    })).toEqual({
      event: 'message-handler-error',
      context: 'status request',
      requestId: 'req-status',
      requestType: 'GET_STATUS',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'status unavailable',
      details: 'bridge status snapshot unavailable',
      suggestion: 'Please try again or contact support',
    });
  });
});
