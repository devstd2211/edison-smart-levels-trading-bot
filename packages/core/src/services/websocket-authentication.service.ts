/**
 * WebSocket Authentication Service
 * Handles HMAC-SHA256 signature generation for Bybit WebSocket V5 authentication
 *
 * Responsibilities:
 * - Generate secure authentication payloads
 * - Create HMAC-SHA256 signatures
 * - Format auth messages for WebSocket
 *
 * Phase 8.9.78: ErrorHandler Integration
 * - THROW: Input validation (null/empty apiKey or apiSecret)
 * - GRACEFUL_DEGRADE: Signature generation failures → return safe default auth payload
 * - SKIP: Logging failures via safeLog() wrapper
 */

import crypto from 'crypto';
import { TIMING_CONSTANTS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

const AUTH_EXPIRES_OFFSET_MS = TIMING_CONSTANTS.AUTH_EXPIRES_OFFSET_MS;

/**
 * Auth payload sent to Bybit WebSocket
 */
export interface WebSocketAuthPayload {
  op: 'auth';
  args: [string, string, string]; // [apiKey, expires, signature]
}

/**
 * WebSocket Authentication Service
 * Generates HMAC-SHA256 signatures for Bybit WebSocket authentication
 */
export class WebSocketAuthenticationService {
  private errorHandler: ErrorHandler | undefined;
  private logger: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>> | undefined;

  constructor(
    logger?: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string, context?: Record<string, unknown>) => void>>,
    errorHandler?: ErrorHandler,
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  private handleRecoveryError(error: unknown, strategy: RecoveryStrategy): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(normalizeError(error), { strategy }).catch(() => { /* Silent */ });
  }

  /**
   * Safely log messages, catching any logger errors
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    if (!this.logger) return;
    try {
      if (this.logger[level]) {
        this.logger[level](message, context);
      }
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.SKIP);
    }
  }

  /**
   * Generate authentication payload for Bybit WebSocket
   * @param apiKey - API key
   * @param apiSecret - API secret
   * @returns Auth payload ready to send to WebSocket
   * @throws Error if apiKey or apiSecret is null/undefined (THROW)
   */
  public generateAuthPayload(apiKey: string, apiSecret: string): WebSocketAuthPayload {
    // THROW: Validate inputs - only null/undefined is an error (this validation must be OUTSIDE try-catch to propagate)
    if (apiKey === null || apiKey === undefined) {
      throw new Error('apiKey must be a non-null value');
    }
    if (apiSecret === null || apiSecret === undefined) {
      throw new Error('apiSecret must be a non-null value');
    }

    try {
      // Calculate expiration (5 seconds in future)
      const expires = Date.now() + AUTH_EXPIRES_OFFSET_MS;

      // Generate HMAC-SHA256 signature
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(`GET/realtime${expires}`)
        .digest('hex');

      this.safeLog('debug', 'Generated WebSocket auth payload', {
        apiKeyLength: apiKey.length,
        expiresIn: AUTH_EXPIRES_OFFSET_MS,
      });

      return {
        op: 'auth',
        args: [apiKey, expires.toString(), signature],
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: On signature generation failure, return safe default payload
      this.safeLog('warn', 'Failed to generate WebSocket auth payload', {
        error: getErrorMessage(error),
      });
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);

      // Return a safe default with empty signature
      const expires = Date.now() + AUTH_EXPIRES_OFFSET_MS;
      return {
        op: 'auth',
        args: [apiKey || '', expires.toString(), ''],
      };
    }
  }

  /**
   * Validate API credentials format without generating signature
   * Useful for early validation during initialization
   *
   * @param apiKey - API key
   * @param apiSecret - API secret
   * @returns true if credentials are valid format, false otherwise
   */
  public validateCredentials(apiKey: string, apiSecret: string): boolean {
    try {
      // THROW validation - only null/undefined is a hard error
      if (apiKey === null || apiKey === undefined) {
        throw new Error('apiKey must be a non-null value');
      }
      if (apiSecret === null || apiSecret === undefined) {
        throw new Error('apiSecret must be a non-null value');
      }

      // Basic format checks - minimum length requirement
      if (typeof apiKey !== 'string' || apiKey.length < 10) {
        return false;
      }
      if (typeof apiSecret !== 'string' || apiSecret.length < 10) {
        return false;
      }

      return true;
    } catch (error) {
      // GRACEFUL_DEGRADE: Return false on validation failure
      this.safeLog('debug', 'Credential validation failed', {
        error: getErrorMessage(error),
      });
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);
      return false;
    }
  }
}
