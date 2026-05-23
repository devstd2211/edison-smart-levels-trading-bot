import { ApiError, createErrorResponse, getErrorStatus } from '../src/errors/api-error-response';

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
});
