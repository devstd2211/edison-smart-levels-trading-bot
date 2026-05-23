import express from 'express';
import request from 'supertest';
import { createStatusErrorResponse } from '../src/errors/api-error-response';
import { createRequestLoggingMiddleware } from '../src/middleware/request-logging.middleware';

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
});
