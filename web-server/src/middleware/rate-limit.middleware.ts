/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse with:
 * - Per-endpoint rate limits
 * - Per-IP rate limits
 * - Sliding window algorithm
 * - Whitelist support
 */

import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs?: number; // Time window in ms (default: 60 seconds)
  maxRequests?: number; // Max requests per window (default: 100)
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  whitelist?: string[]; // IP addresses to skip
}

interface ClientStore {
  [clientIp: string]: {
    timestamps: number[];
  };
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later',
  statusCode: 429,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  whitelist: ['::1', '127.0.0.1'], // Localhost by default
};

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const store: ClientStore = {};

  /**
   * Get client IP address
   */
  const getClientIp = (req: Request): string => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
           (req.headers['x-client-ip'] as string) ||
           req.socket?.remoteAddress ||
           'unknown';
  };

  /**
   * Check if IP is whitelisted
   */
  const isWhitelisted = (ip: string): boolean => {
    return finalConfig.whitelist?.includes(ip) || false;
  };

  /**
   * Increment request count for client
   */
  const incrementRequestCount = (clientIp: string): number => {
    const now = Date.now();
    const windowStart = now - (finalConfig.windowMs || 60000);

    if (!store[clientIp]) {
      store[clientIp] = { timestamps: [] };
    }

    // Remove timestamps outside the current window
    store[clientIp].timestamps = store[clientIp].timestamps.filter(
      (timestamp) => timestamp > windowStart
    );

    // Add current request timestamp
    store[clientIp].timestamps.push(now);

    return store[clientIp].timestamps.length;
  };

  /**
   * Cleanup old entries periodically
   */
  setInterval(() => {
    const now = Date.now();
    const windowStart = now - (finalConfig.windowMs || 60000);

    for (const clientIp in store) {
      store[clientIp].timestamps = store[clientIp].timestamps.filter(
        (timestamp) => timestamp > windowStart
      );

      // Remove client if no timestamps left
      if (store[clientIp].timestamps.length === 0) {
        delete store[clientIp];
      }
    }
  }, (finalConfig.windowMs || 60000) * 2); // Cleanup every 2 windows

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);

    // Skip if whitelisted
    if (isWhitelisted(clientIp)) {
      return next();
    }

    // Increment request count
    const requestCount = incrementRequestCount(clientIp);

    // Check if limit exceeded
    if (requestCount > (finalConfig.maxRequests || 100)) {
      // Skip if configured to skip failed requests
      if (finalConfig.skipFailedRequests) {
        return next();
      }

      return res.status(finalConfig.statusCode || 429).json({
        success: false,
        error: finalConfig.message || 'Too many requests',
        retryAfter: finalConfig.windowMs || 60000,
      });
    }

    // Add rate limit info to response headers
    const resetTime = new Date(
      Date.now() + (finalConfig.windowMs || 60000)
    ).toISOString();

    res.set('X-RateLimit-Limit', String(finalConfig.maxRequests || 100));
    res.set('X-RateLimit-Remaining', String((finalConfig.maxRequests || 100) - requestCount));
    res.set('X-RateLimit-Reset', resetTime);

    // Track response status for skipFailedRequests
    if (finalConfig.skipSuccessfulRequests || finalConfig.skipFailedRequests) {
      const originalSend = res.send;

      res.send = function (data: any) {
        // If configured to skip successful requests, remove from counter
        if (finalConfig.skipSuccessfulRequests && res.statusCode < 400) {
          store[clientIp].timestamps.pop();
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
}
