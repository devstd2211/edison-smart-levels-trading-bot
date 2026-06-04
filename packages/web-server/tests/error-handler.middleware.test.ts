import express from 'express';
import { ApiError } from '../src/errors/api-error-response';
import { createErrorHandlerLogPayload as createSharedErrorHandlerLogPayload } from '../src/logging/request-scoped-error-log';
import {
  createErrorHandlerLogPayload,
  createErrorHandlerResult,
  createErrorHandlerMiddleware,
} from '../src/middleware/error-handler.middleware';

describe('error handler middleware', () => {
  test('logs the same structured detail and request id that it returns to clients', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const middleware = createErrorHandlerMiddleware();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json } as unknown as express.Response;
    const req = {
      headers: {
        'x-request-id': ['req-a', 'req-b'],
      },
    } as unknown as express.Request;

    middleware(
      new ApiError(
        409,
        'CONFIG_CONFLICT',
        'Config conflict',
        'risk.maxLeverage overlaps with strategy override',
        'Remove the conflicting override and retry',
      ),
      req,
      res,
      jest.fn(),
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFIG_CONFLICT',
        message: 'Config conflict',
        details: 'risk.maxLeverage overlaps with strategy override',
        suggestion: 'Remove the conflicting override and retry',
      },
      timestamp: expect.any(Number),
      requestId: 'req-a',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', expect.objectContaining({
      requestId: 'req-a',
      statusCode: 409,
      code: 'CONFIG_CONFLICT',
      message: 'Config conflict',
      details: 'risk.maxLeverage overlaps with strategy override',
      suggestion: 'Remove the conflicting override and retry',
    }));

    consoleErrorSpy.mockRestore();
  });

  test('creates a shared request-scoped error log payload for middleware logging', () => {
    expect(createErrorHandlerLogPayload(new ApiError(
      409,
      'CONFIG_CONFLICT',
      'Config conflict',
      'risk.maxLeverage overlaps with strategy override',
      'Remove the conflicting override and retry',
    ), ['req-a', 'req-b'])).toEqual({
      requestId: 'req-a',
      statusCode: 409,
      code: 'CONFIG_CONFLICT',
      message: 'Config conflict',
      details: 'risk.maxLeverage overlaps with strategy override',
      suggestion: 'Remove the conflicting override and retry',
    });
  });

  test('creates one shared middleware result with status, response body, and log payload parity', () => {
    expect(createErrorHandlerResult(new ApiError(
      409,
      'CONFIG_CONFLICT',
      'Config conflict',
      'risk.maxLeverage overlaps with strategy override',
      'Remove the conflicting override and retry',
    ), ['req-a', 'req-b'])).toEqual({
      statusCode: 409,
      responseBody: {
        success: false,
        error: {
          code: 'CONFIG_CONFLICT',
          message: 'Config conflict',
          details: 'risk.maxLeverage overlaps with strategy override',
          suggestion: 'Remove the conflicting override and retry',
        },
        timestamp: expect.any(Number),
        requestId: 'req-a',
      },
      logPayload: {
        requestId: 'req-a',
        statusCode: 409,
        code: 'CONFIG_CONFLICT',
        message: 'Config conflict',
        details: 'risk.maxLeverage overlaps with strategy override',
        suggestion: 'Remove the conflicting override and retry',
      },
    });
  });

  test('re-exports the shared error-handler log payload helper without changing semantics', () => {
    const error = new ApiError(
      422,
      'INVALID_CONFIG',
      'Config invalid',
      'risk.maxLeverage must be numeric',
      'Provide a numeric maxLeverage value',
    );

    expect(createErrorHandlerLogPayload(error, ['req-a', 'req-b'])).toEqual(
      createSharedErrorHandlerLogPayload(error, {
        requestId: ['req-a', 'req-b'],
        fallbackStatusCode: 422,
      }),
    );
  });

  test('delegates to the next error handler when headers were already sent', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const middleware = createErrorHandlerMiddleware();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn();
    const error = new Error('late failure');
    const res = {
      headersSent: true,
      status,
      json,
    } as unknown as express.Response;
    const req = {
      headers: {
        'x-request-id': 'req-late',
      },
    } as unknown as express.Request;

    middleware(error, req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
