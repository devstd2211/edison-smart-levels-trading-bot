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
    let responseBody: any = null;

    res.send = function (data: any) {
      responseBody = data;
      return originalSend.call(this, data);
    };

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const [seconds, nanoseconds] = process.hrtime(startHrTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;

      const logData: Record<string, any> = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        statusCode: res.statusCode,
        duration: `${durationMs.toFixed(2)}ms`,
        responseSize: res.get('content-length') || 'unknown',
      };

      // Add request body if configured
      if (finalConfig.logBody && req.body && Object.keys(req.body).length > 0) {
        const bodyStr = JSON.stringify(req.body);
        logData.requestBody = bodyStr.length > (finalConfig.maxBodyLength || 500)
          ? bodyStr.substring(0, finalConfig.maxBodyLength) + '...'
          : req.body;
      }

      // Add request headers if configured
      if (finalConfig.logHeaders) {
        logData.headers = {
          'content-type': req.get('content-type'),
          'user-agent': req.get('user-agent'),
        };
      }

      // Log response
      if (res.statusCode >= 400) {
        console.error(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
      } else {
        console.log(`[HTTP] ${res.statusCode} ${req.method} ${req.path}`, logData);
      }
    });

    // Log on error
    res.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error(`[HTTP_ERROR] ${req.method} ${req.path}`, {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        error: error.message,
        statusCode: res.statusCode,
      });
    });

    next();
  };
}
