import {
  ApiError,
  createErrorResponse,
  createStatusErrorResponse,
  createWebSocketErrorPayload,
  createWebSocketStatusErrorPayloadFromError,
  getErrorStatus,
  resolveRequestId,
} from '../src/errors/api-error-response';

describe('api-error-response structured normalization', () => {
  test('preserves structured details and suggestion from non-ApiError objects', () => {
    const response = createErrorResponse({
      statusCode: 409,
      code: 'CONFIG_CONFLICT',
      message: 'Config conflict',
      details: 'risk.maxLeverage overlaps with strategy override',
      suggestion: 'Remove the conflicting override and retry',
    });

    expect(response).toEqual({
      success: false,
      error: {
        code: 'CONFIG_CONFLICT',
        message: 'Config conflict',
        details: 'risk.maxLeverage overlaps with strategy override',
        suggestion: 'Remove the conflicting override and retry',
      },
      timestamp: expect.any(Number),
      requestId: undefined,
    });
  });

  test('reads numeric status from both statusCode and status fields', () => {
    expect(getErrorStatus({ statusCode: 422 })).toBe(422);
    expect(getErrorStatus({ status: 503 })).toBe(503);
    expect(getErrorStatus(new ApiError(404, 'NOT_FOUND', 'missing'))).toBe(404);
  });

  test('coerces numeric status fields expressed as strings', () => {
    expect(getErrorStatus({ statusCode: '422' })).toBe(422);
    expect(getErrorStatus({ status: '503' })).toBe(503);
  });

  test('normalizes websocket payloads from structured non-ApiError objects', () => {
    expect(createWebSocketErrorPayload({
      code: 'POSITION_READ_FAILED',
      message: 'Failed to get position',
      details: 'bridge snapshot unavailable',
    })).toEqual({
      error: 'Failed to get position',
      code: 'POSITION_READ_FAILED',
      details: 'bridge snapshot unavailable',
    });
  });

  test('applies the shared default suggestion when a status response omits one', () => {
    expect(createStatusErrorResponse(404, 'Not found')).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        details: undefined,
        suggestion: 'Check that the requested resource or route exists',
      },
      timestamp: expect.any(Number),
      requestId: undefined,
    });
  });

  test('builds websocket status errors from thrown causes through the shared helper', () => {
    expect(createWebSocketStatusErrorPayloadFromError(
      new Error('status unavailable'),
      500,
      'Failed to get bot status',
      { code: 'STATUS_READ_FAILED', requestType: 'GET_STATUS' },
    )).toEqual({
      error: 'Failed to get bot status',
      code: 'STATUS_READ_FAILED',
      details: 'status unavailable',
      requestType: 'GET_STATUS',
    });
  });

  test('uses the first request id value when multiple headers are present', () => {
    expect(resolveRequestId(['req-a', 'req-b'])).toBe('req-a');
    expect(resolveRequestId('req-single')).toBe('req-single');
  });
});
