import express from 'express';
import { ApiError } from '../src/errors/api-error-response';
import { createErrorHandlerMiddleware } from '../src/middleware/error-handler.middleware';

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
});
