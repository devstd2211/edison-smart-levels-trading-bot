import type { Response } from 'express';
import {
  createRouteResponseContext,
  parseLimitQuery,
  parsePageQuery,
  requireNonEmptyParam,
  sendAsyncRouteMutation,
  sendAsyncRouteRead,
  sendSuccess,
} from '../src/routes/route-response';

function createResponseDouble(headers: Record<string, unknown> = {}): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn();
  const res = {
    req: { headers },
    status,
    json,
  } as unknown as Response;

  status.mockReturnValue(res);

  return { res, status, json };
}

describe('route-response runtime boundary', () => {
  test('creates a route response context from request headers and normalizes success envelopes through it', () => {
    const { res, status, json } = createResponseDouble({ 'x-request-id': ['req-a', 'req-b'] });

    expect(createRouteResponseContext(res)).toEqual({
      requestId: 'req-a',
      res,
    });

    sendSuccess(res, { ok: true });

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { ok: true },
      timestamp: expect.any(Number),
      requestId: 'req-a',
    });
  });

  test('drops invalid request ids before shared route error envelopes are created', async () => {
    const { res, status, json } = createResponseDouble({ 'x-request-id': [42, 'req-ignored'] });

    await sendAsyncRouteRead(res, async () => {
      throw { status: 503 };
    }, {
      fallbackMessage: 'Failed to fetch strategy performance',
    });

    expect(createRouteResponseContext(res)).toEqual({
      requestId: undefined,
      res,
    });
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Failed to fetch strategy performance',
        details: undefined,
        suggestion: 'Please try again or contact support',
      },
      timestamp: expect.any(Number),
    });
  });

  test('preserves route mutation success statuses through the shared response runner', async () => {
    const { res, status, json } = createResponseDouble({ 'x-request-id': 'req-created' });

    await sendAsyncRouteMutation(res, async () => ({ message: 'created' }), {
      successStatus: 202,
    });

    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'created' },
      timestamp: expect.any(Number),
      requestId: 'req-created',
    });
  });

  test('preserves fallback route errors with normalized request ids through the shared response runner', async () => {
    const { res, status, json } = createResponseDouble({ 'x-request-id': ['req-route', 'req-ignored'] });

    await sendAsyncRouteRead(res, async () => {
      throw { status: '503' };
    }, {
      fallbackMessage: 'Failed to fetch strategy performance',
    });

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Failed to fetch strategy performance',
        details: undefined,
        suggestion: 'Please try again or contact support',
      },
      timestamp: expect.any(Number),
      requestId: 'req-route',
    });
  });

  test('clamps pagination helpers and rejects blank params through the same route error envelope', () => {
    const { res, status, json } = createResponseDouble({ 'x-request-id': 'req-param' });

    expect(parsePageQuery('0')).toBe(1);
    expect(parseLimitQuery('999', 50, 500)).toBe(500);
    expect(requireNonEmptyParam(res, '  ', 'id2')).toBe(false);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'id2 is required',
        details: undefined,
        suggestion: 'Provide a non-empty id2 value',
      },
      timestamp: expect.any(Number),
      requestId: 'req-param',
    });
  });
});
