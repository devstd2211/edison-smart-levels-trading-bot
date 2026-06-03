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

export const DEFAULT_LOGGING_CONFIG: Required<LoggingConfig> = {
  logBody: false,
  logHeaders: false,
  excludePaths: ['/health'],
  maxBodyLength: 500,
};

export function resolveLoggingConfig(config: LoggingConfig = {}): Required<LoggingConfig> {
  return {
    ...DEFAULT_LOGGING_CONFIG,
    ...config,
    excludePaths: config.excludePaths ?? DEFAULT_LOGGING_CONFIG.excludePaths,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRequestBodyLogData(req: Request, config: Required<LoggingConfig>): unknown {
  if (!config.logBody || !isRecord(req.body) || Object.keys(req.body).length === 0) {
    return undefined;
  }

  const bodyStr = JSON.stringify(req.body);
  return bodyStr.length > config.maxBodyLength
    ? bodyStr.substring(0, config.maxBodyLength) + '...'
    : req.body;
}

function getHeaderLogData(req: Request, config: Required<LoggingConfig>): Record<string, unknown> | undefined {
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
  const resolvedConfig = resolveLoggingConfig(config);
  return createHttpLogPayload({
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    statusCode: res.statusCode,
    durationMs,
    responseSize: res.get('content-length') || 'unknown',
    requestBody: getRequestBodyLogData(req, resolvedConfig),
    headers: getHeaderLogData(req, resolvedConfig),
    requestId: resolveRequestId(req.headers['x-request-id']),
    responseBody,
  });
}

function shouldSkipRequestLogging(req: Request, config: Required<LoggingConfig>): boolean {
  return config.excludePaths.some((path) => req.path === path);
}

function createResponseFinishLogger(
  req: Request,
  res: Response,
  config: Required<LoggingConfig>,
  startHrTime: [number, number],
  getResponseBody: () => unknown,
): () => void {
  return () => {
    const [seconds, nanoseconds] = process.hrtime(startHrTime);
    const durationMs = seconds * 1000 + nanoseconds / 1000000;
    const logData = createRequestLogEntry(req, res, durationMs, config, getResponseBody());

    if (res.statusCode >= 400) {
      console.error(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
      return;
    }

    console.log(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
  };
}

function createResponseErrorLogger(
  req: Request,
  res: Response,
  startTime: number,
  getResponseBody: () => unknown,
): (error: unknown) => void {
  return (error: unknown) => {
    const duration = Date.now() - startTime;
    const logData = createHttpResponseErrorLogPayload({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId: resolveRequestId(req.headers['x-request-id']),
      error,
      responseBody: getResponseBody(),
    });
    console.error(`[HTTP_ERROR] ${req.method} ${req.path}`, logData);
  };
}

/**
 * Create request/response logging middleware
 */
export function createRequestLoggingMiddleware(config: LoggingConfig = {}) {
  const finalConfig = resolveLoggingConfig(config);

  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkipRequestLogging(req, finalConfig)) {
      return next();
    }

    const startTime = Date.now();
    const startHrTime = process.hrtime();

    const originalSend = res.send;
    let responseBody: unknown = null;
    const getResponseBody = () => responseBody;

    res.send = function (data: unknown) {
      responseBody = data;
      return originalSend.call(this, data);
    };

    res.on('finish', createResponseFinishLogger(req, res, finalConfig, startHrTime, getResponseBody));
    res.on('error', createResponseErrorLogger(req, res, startTime, getResponseBody));

    next();
  };
}
