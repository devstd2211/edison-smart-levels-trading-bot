/**
 * WebSocket Authentication Service
 * Handles HMAC-SHA256 signature generation for Bybit WebSocket V5 authentication
 *
 * Responsibilities:
 * - Generate secure authentication payloads
 * - Create HMAC-SHA256 signatures
 * - Format auth messages for WebSocket
 */

import crypto from 'crypto';
import { TIMING_CONSTANTS } from '../constants/technical.constants';

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
  constructor() {}

  /**
   * Generate authentication payload for Bybit WebSocket
   * @param apiKey - API key
   * @param apiSecret - API secret
   * @returns Auth payload ready to send to WebSocket
   */
  public generateAuthPayload(apiKey: string, apiSecret: string): WebSocketAuthPayload {
    // Calculate expiration (5 seconds in future)
    const expires = Date.now() + AUTH_EXPIRES_OFFSET_MS;

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(`GET/realtime${expires}`)
      .digest('hex');

    return {
      op: 'auth',
      args: [apiKey, expires.toString(), signature],
    };
  }
}
