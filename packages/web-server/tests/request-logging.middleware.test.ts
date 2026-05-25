import express from 'express';
import request from 'supertest';
import { createRateLimitErrorResponse, createStatusErrorResponse } from '../src/errors/api-error-response';
import { createHttpLogPayload, createHttpResponseErrorLogPayload } from '../src/logging/request-scoped-error-log';
import {
  createRequestLogEntry,
  createRequestLoggingMiddleware,
} from '../src/middleware/request-logging.middleware';

describe('request logging middleware', () => {
  test('logs structured error metadata from the response body with request id parity', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();

    app.use(createRequestLoggingMiddleware());
    app.get('/missing', (_req, res) => {
      res.status(404).json(createStatusErrorResponse(404, 'Not found'));
    });

    await request(app)
      .get('/missing')
      .set('x-request-id', 'req-404')
      .expect(404);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[HTTP] 404 GET /missing', expect.objectContaining({
      statusCode: 404,
      requestId: 'req-404',
      errorCode: 'NOT_FOUND',
      errorMessage: 'Not found',
      errorSuggestion: 'Check that the requested resource or route exists',
    }));

    consoleErrorSpy.mockRestore();
  });

  test('reads request ids from serialized structured error bodies when the header is absent', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();

    app.use(createRequestLoggingMiddleware());
    app.get('/serialized-missing', (_req, res) => {
      res
        .status(404)
        .type('application/json')
        .send(JSON.stringify(createStatusErrorResponse(404, 'Not found', {
          requestId: 'req-body',
          details: 'route missing',
        })));
    });

    await request(app)
      .get('/serialized-missing')
      .expect(404);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[HTTP] 404 GET /serialized-missing', expect.objectContaining({
      requestId: 'req-body',
      errorCode: 'NOT_FOUND',
      errorMessage: 'Not found',
      errorDetails: 'route missing',
      errorSuggestion: 'Check that the requested resource or route exists',
    }));

    consoleErrorSpy.mockRestore();
  });

  test('logs normalized request ids from serialized success envelopes when the header is absent', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const app = express();

    app.use(createRequestLoggingMiddleware());
    app.get('/serialized-success', (_req, res) => {
      res
        .status(200)
        .type('application/json')
        .send(JSON.stringify({
          success: true,
          data: { currentPrice: 67890 },
          timestamp: 123,
          requestId: 'req-success-body',
        }));
    });

    await request(app)
      .get('/serialized-success')
      .expect(200);

    expect(consoleLogSpy).toHaveBeenCalledWith('[HTTP] 200 GET /serialized-success', expect.objectContaining({
      statusCode: 200,
      requestId: 'req-success-body',
    }));

    consoleLogSpy.mockRestore();
  });

  test('builds a shared request log entry with structured error detail parity', () => {
    const req = {
      method: 'POST',
      path: '/api/config',
      query: { preview: 'true' },
      body: { config: { exchange: { symbol: 'BTCUSDT' } } },
      headers: {
        'x-request-id': ['req-a', 'req-b'],
      },
      get: jest.fn((header: string) => {
        if (header === 'content-type') {
          return 'application/json';
        }

        if (header === 'user-agent') {
          return 'jest';
        }

        return undefined;
      }),
    } as unknown as express.Request;
    const res = {
      statusCode: 409,
      get: jest.fn(() => '321'),
    } as unknown as express.Response;

    expect(createRequestLogEntry(req, res, 12.345, {
      logBody: true,
      logHeaders: true,
      maxBodyLength: 500,
    }, createStatusErrorResponse(409, 'Config conflict', {
      details: 'strategy override overlaps with runtime config',
      suggestion: 'Remove the conflicting override and retry',
    }))).toEqual({
      timestamp: expect.any(String),
      method: 'POST',
      path: '/api/config',
      query: { preview: 'true' },
      statusCode: 409,
      duration: '12.35ms',
      responseSize: '321',
      requestBody: { config: { exchange: { symbol: 'BTCUSDT' } } },
      headers: {
        'content-type': 'application/json',
        'user-agent': 'jest',
      },
      requestId: 'req-a',
      errorCode: 'CONFLICT',
      errorMessage: 'Config conflict',
      errorDetails: 'strategy override overlaps with runtime config',
      errorSuggestion: 'Remove the conflicting override and retry',
    });
  });

  test('builds shared HTTP request and response-error payload helpers', () => {
    expect(createHttpLogPayload({
      method: 'POST',
      path: '/api/config',
      query: { preview: 'true' },
      statusCode: 409,
      durationMs: 12.345,
      responseSize: '321',
      requestBody: { config: { exchange: { symbol: 'BTCUSDT' } } },
      headers: {
        'content-type': 'application/json',
        'user-agent': 'jest',
      },
      requestId: ['req-a', 'req-b'],
      responseBody: createStatusErrorResponse(409, 'Config conflict', {
        details: 'strategy override overlaps with runtime config',
        suggestion: 'Remove the conflicting override and retry',
      }),
    })).toEqual({
      timestamp: expect.any(String),
      method: 'POST',
      path: '/api/config',
      query: { preview: 'true' },
      statusCode: 409,
      duration: '12.35ms',
      responseSize: '321',
      requestBody: { config: { exchange: { symbol: 'BTCUSDT' } } },
      headers: {
        'content-type': 'application/json',
        'user-agent': 'jest',
      },
      requestId: 'req-a',
      errorCode: 'CONFLICT',
      errorMessage: 'Config conflict',
      errorDetails: 'strategy override overlaps with runtime config',
      errorSuggestion: 'Remove the conflicting override and retry',
    });

    expect(createHttpResponseErrorLogPayload({
      method: 'GET',
      path: '/missing',
      statusCode: 404,
      durationMs: 7,
      requestId: undefined,
      error: new Error('socket hang up'),
      responseBody: createStatusErrorResponse(404, 'Not found', {
        requestId: 'req-body',
      }),
    })).toEqual({
      timestamp: expect.any(String),
      method: 'GET',
      path: '/missing',
      statusCode: 404,
      duration: '7.00ms',
      error: 'socket hang up',
      requestId: 'req-body',
      errorCode: 'NOT_FOUND',
      errorMessage: 'Not found',
      errorDetails: undefined,
      errorSuggestion: 'Check that the requested resource or route exists',
    });
  });

  test('preserves request ids from successful HTTP responses without inventing error metadata', () => {
    expect(createHttpLogPayload({
      method: 'GET',
      path: '/market',
      query: undefined,
      statusCode: 200,
      durationMs: 1.25,
      responseSize: '98',
      responseBody: {
        success: true,
        data: { currentPrice: 67890 },
        requestId: 'req-market-body',
      },
    })).toEqual({
      timestamp: expect.any(String),
      method: 'GET',
      path: '/market',
      query: undefined,
      statusCode: 200,
      duration: '1.25ms',
      responseSize: '98',
      requestId: 'req-market-body',
    });
  });

  test('reads shared rate-limit responses into the same structured HTTP log payload shape', () => {
    expect(createHttpLogPayload({
      method: 'GET',
      path: '/limited',
      query: undefined,
      statusCode: 429,
      durationMs: 4,
      responseSize: '256',
      requestId: undefined,
      responseBody: createRateLimitErrorResponse({
        message: 'Slow down',
        maxRequests: 0,
        windowMs: 1000,
        requestId: 'req-rate-limit',
      }),
    })).toEqual({
      timestamp: expect.any(String),
      method: 'GET',
      path: '/limited',
      query: undefined,
      statusCode: 429,
      duration: '4.00ms',
      responseSize: '256',
      requestId: 'req-rate-limit',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: 'Slow down',
      errorDetails: 'Exceeded 0 requests in 1000ms',
      errorSuggestion: 'Wait for the rate limit window to reset and retry',
    });
  });
});
