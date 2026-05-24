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
  createErrorLogPayload,
  getStructuredErrorDetail,
  resolveRequestId,
} from '../errors/api-error-response.js';

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

function createBaseLogData(req: Request, res: Response, durationMs: number): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    statusCode: res.statusCode,
    duration: `${durationMs.toFixed(2)}ms`,
    responseSize: res.get('content-length') || 'unknown',
  };
}

function addRequestBodyLogData(logData: Record<string, unknown>, req: Request, config: LoggingConfig): void {
  if (!config.logBody || !isRecord(req.body) || Object.keys(req.body).length === 0) {
    return;
  }

  const bodyStr = JSON.stringify(req.body);
  logData.requestBody = bodyStr.length > (config.maxBodyLength || 500)
    ? bodyStr.substring(0, config.maxBodyLength) + '...'
    : req.body;
}

function addHeaderLogData(logData: Record<string, unknown>, req: Request, config: LoggingConfig): void {
  if (!config.logHeaders) {
    return;
  }

  logData.headers = {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent'),
  };
}

function addStructuredErrorLogData(logData: Record<string, unknown>, req: Request, responseBody: unknown): void {
  if (!getStructuredErrorDetail(responseBody)) {
    return;
  }

  const errorLogPayload = createErrorLogPayload(responseBody, {
    requestId: resolveRequestId(req.headers['x-request-id']),
    fallbackStatusCode: typeof logData.statusCode === 'number' ? logData.statusCode : undefined,
  });

  if (!errorLogPayload.code || !errorLogPayload.message) {
    return;
  }

  logData.requestId = errorLogPayload.requestId;
  logData.errorCode = errorLogPayload.code;
  logData.errorMessage = errorLogPayload.message;
  logData.errorDetails = errorLogPayload.details;
  logData.errorSuggestion = errorLogPayload.suggestion;
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
      const logData = createBaseLogData(req, res, durationMs);
      addRequestBodyLogData(logData, req, finalConfig);
      addHeaderLogData(logData, req, finalConfig);
      addStructuredErrorLogData(logData, req, responseBody);

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
      const logData: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: res.statusCode,
      };
      addStructuredErrorLogData(logData, req, responseBody);
      console.error(`[HTTP_ERROR] ${req.method} ${req.path}`, logData);
    });

    next();
  };
}
