import {
  ApiError,
  createErrorDetail,
  createErrorLogPayload,
  createErrorResponseFromDetail,
  createErrorResponse,
  DEFAULT_API_ERROR_DETAIL_EXAMPLE,
  DEFAULT_STRUCTURED_API_ERROR_RESPONSE_EXAMPLE,
  createStatusErrorDetail,
  createStatusErrorResponse,
  createWebSocketErrorPayload,
  createWebSocketStatusErrorPayloadFromError,
  getStructuredErrorDetail,
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

  test('applies the shared default suggestion when an ApiError omits one', () => {
    expect(createErrorResponse(new ApiError(400, 'BAD_REQUEST', 'Bot is already running'))).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Bot is already running',
        details: undefined,
        suggestion: 'Check your request parameters and try again',
      },
      timestamp: expect.any(Number),
      requestId: undefined,
    });
  });

  test('uses the provided fallback message when an unknown route error has no message fields', () => {
    expect(createErrorDetail({ status: '503' }, 500, {
      fallbackMessage: 'Failed to fetch strategy performance',
    })).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Failed to fetch strategy performance',
      details: undefined,
      suggestion: 'Please try again or contact support',
    });
  });

  test('builds fixed structured examples from shared status detail helpers', () => {
    expect(createErrorResponseFromDetail(
      createStatusErrorDetail(500, 'Internal server error', {
        details: 'Additional context when available',
      }),
      { timestamp: 1700000000000, requestId: 'req-example' },
    )).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: 'Additional context when available',
        suggestion: 'Please try again or contact support',
      },
      timestamp: 1700000000000,
      requestId: 'req-example',
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

  test('uses the fallback websocket message when a thrown cause exposes only status metadata', () => {
    expect(createWebSocketStatusErrorPayloadFromError(
      { status: '503' },
      500,
      'Failed to get position',
      { code: 'POSITION_READ_FAILED', requestType: 'GET_POSITION' },
    )).toEqual({
      error: 'Failed to get position',
      code: 'POSITION_READ_FAILED',
      requestType: 'GET_POSITION',
    });
  });

  test('extracts nested structured error detail from api responses', () => {
    expect(getStructuredErrorDetail({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        details: 'route missing',
        suggestion: 'Check the path',
      },
    })).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found',
      details: 'route missing',
      suggestion: 'Check the path',
    });
  });

  test('reuses nested structured error details when building new details from an error envelope', () => {
    expect(createErrorDetail(createStatusErrorResponse(404, 'Not found', {
      details: 'route missing',
      suggestion: 'Check the path',
      requestId: 'req-404',
    }), 404)).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found',
      details: 'route missing',
      suggestion: 'Check the path',
    });
  });

  test('reuses structured details and request ids from serialized error envelopes when building log payloads', () => {
    expect(createErrorLogPayload(JSON.stringify(createStatusErrorResponse(404, 'Not found', {
      details: 'route missing',
      requestId: 'req-404',
    })), { fallbackStatusCode: 404 })).toEqual(expect.objectContaining({
      requestId: 'req-404',
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Not found',
      details: 'route missing',
      suggestion: 'Check that the requested resource or route exists',
    }));
  });

  test('exports shared structured error examples for documentation consumers', () => {
    expect(DEFAULT_API_ERROR_DETAIL_EXAMPLE).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: 'Additional context when available',
      suggestion: 'Please try again or contact support',
    });
    expect(DEFAULT_STRUCTURED_API_ERROR_RESPONSE_EXAMPLE).toEqual({
      success: false,
      error: DEFAULT_API_ERROR_DETAIL_EXAMPLE,
      timestamp: 1700000000000,
      requestId: 'req-example',
    });
  });

  test('uses the first request id value when multiple headers are present', () => {
    expect(resolveRequestId(['req-a', 'req-b'])).toBe('req-a');
    expect(resolveRequestId('req-single')).toBe('req-single');
  });
});
