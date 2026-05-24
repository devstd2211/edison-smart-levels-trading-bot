/**
 * Request/Response Logging Middleware
 *
 * Logs all HTTP requests and responses with:
 * - Method, path, status code, response time
 * - Request headers and body (configurable)
 * - Response size
 * - Error details
 */

import { Request, Response, NextFunction } from 'express';
import {
  resolveRequestId,
} from '../errors/api-error-response.js';
import {
  createHttpLogPayload,
  createHttpResponseErrorLogPayload,
} from '../logging/request-scoped-error-log.js';

export interface LoggingConfig {
  logBody?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
  maxBodyLength?: number;
}

const defaultConfig: LoggingConfig = {
  logBody: false,
  logHeaders: false,
  excludePaths: ['/health'],
  maxBodyLength: 500,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRequestBodyLogData(req: Request, config: LoggingConfig): unknown {
  if (!config.logBody || !isRecord(req.body) || Object.keys(req.body).length === 0) {
    return undefined;
  }

  const bodyStr = JSON.stringify(req.body);
  return bodyStr.length > (config.maxBodyLength || 500)
    ? bodyStr.substring(0, config.maxBodyLength) + '...'
    : req.body;
}

function getHeaderLogData(req: Request, config: LoggingConfig): Record<string, unknown> | undefined {
  if (!config.logHeaders) {
    return undefined;
  }

  return {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent'),
  };
}

export function createRequestLogEntry(
  req: Request,
  res: Response,
  durationMs: number,
  config: LoggingConfig,
  responseBody: unknown,
): Record<string, unknown> {
  return createHttpLogPayload({
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    statusCode: res.statusCode,
    durationMs,
    responseSize: res.get('content-length') || 'unknown',
    requestBody: getRequestBodyLogData(req, config),
    headers: getHeaderLogData(req, config),
    requestId: resolveRequestId(req.headers['x-request-id']),
    error: responseBody,
  });
}

/**
 * Create request/response logging middleware
 */
export function createRequestLoggingMiddleware(config: LoggingConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (finalConfig.excludePaths?.some((path) => req.path === path)) {
      return next();
    }

    // Start timer
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Capture response
    const originalSend = res.send;
    let responseBody: unknown = null;

    res.send = function (data: unknown) {
      responseBody = data;
      return originalSend.call(this, data);
    };

    // Log on response finish
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startHrTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;
      const logData = createRequestLogEntry(req, res, durationMs, finalConfig, responseBody);

      // Log response
      if (res.statusCode >= 400) {
        console.error(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
      } else {
        console.log(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
      }
    });

    // Log on error
    res.on('error', (error: unknown) => {
      const duration = Date.now() - startTime;
      const logData = createHttpResponseErrorLogPayload({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        requestId: resolveRequestId(req.headers['x-request-id']),
        error,
        responseBody,
      });
      console.error(`[HTTP_ERROR] ${req.method} ${req.path}`, logData);
    });

    next();
  };
}
