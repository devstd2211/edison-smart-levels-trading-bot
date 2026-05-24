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
});
