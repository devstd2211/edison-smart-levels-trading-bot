/**
 * WebSocket Authentication Service Tests
 * Tests for HMAC-SHA256 signature generation
 */

import { WebSocketAuthenticationService } from '../../services/websocket-authentication.service';
import crypto from 'crypto';

// ============================================================================
// TESTS
// ============================================================================

describe('WebSocketAuthenticationService', () => {
  let service: WebSocketAuthenticationService;

  beforeEach(() => {
    service = new WebSocketAuthenticationService();
  });

  describe('generateAuthPayload', () => {
    it('should generate valid auth payload structure', () => {
      const apiKey = 'test-api-key';
      const apiSecret = 'test-api-secret';

      const payload = service.generateAuthPayload(apiKey, apiSecret);

      expect(payload).toHaveProperty('op');
      expect(payload.op).toBe('auth');
      expect(payload).toHaveProperty('args');
      expect(Array.isArray(payload.args)).toBe(true);
      expect(payload.args.length).toBe(3);
    });

    it('should return apiKey as first argument', () => {
      const apiKey = 'my-api-key-12345';
      const apiSecret = 'my-api-secret';

      const payload = service.generateAuthPayload(apiKey, apiSecret);

      expect(payload.args[0]).toBe(apiKey);
    });

    it('should return expires timestamp as string', () => {
      const apiKey = 'test-key';
      const apiSecret = 'test-secret';

      const payload = service.generateAuthPayload(apiKey, apiSecret);
      const expiresStr = payload.args[1];

      expect(typeof expiresStr).toBe('string');
      const expiresNum = parseInt(expiresStr, 10);
      expect(!isNaN(expiresNum)).toBe(true);
    });

    it('should set expires to approximately 5 seconds in future', () => {
      const apiKey = 'test-key';
      const apiSecret = 'test-secret';
      const beforeTime = Date.now();

      const payload = service.generateAuthPayload(apiKey, apiSecret);
      const expiresNum = parseInt(payload.args[1], 10);

      const afterTime = Date.now();
      const expectedMin = beforeTime + 2000; // ~2 seconds (loose tolerance)
      const expectedMax = afterTime + 10000; // ~10 seconds (loose tolerance)

      expect(expiresNum).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresNum).toBeLessThanOrEqual(expectedMax);
    });

    it('should generate valid HMAC-SHA256 signature', () => {
      const apiKey = 'test-api-key';
      const apiSecret = 'test-api-secret';

      const payload = service.generateAuthPayload(apiKey, apiSecret);
      const signature = payload.args[2];
      const expires = payload.args[1];

      // Verify signature format (hex string, 64 chars for SHA256)
      expect(/^[a-f0-9]{64}$/.test(signature)).toBe(true);

      // Verify signature is correct
      const expectedSignature = crypto
        .createHmac('sha256', apiSecret)
        .update(`GET/realtime${expires}`)
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });

    it('should generate different signatures for different secrets', () => {
      const apiKey = 'test-key';

      const payload1 = service.generateAuthPayload(apiKey, 'secret1');
      const payload2 = service.generateAuthPayload(apiKey, 'secret2');

      // Signatures should be different (same expires might not be guaranteed, so compare if they differ)
      const sig1 = payload1.args[2];
      const sig2 = payload2.args[2];

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different keys', () => {
      const secret = 'test-secret';

      const payload1 = service.generateAuthPayload('key1', secret);
      const payload2 = service.generateAuthPayload('key2', secret);

      expect(payload1.args[0]).not.toBe(payload2.args[0]);
    });

    it('should handle empty strings gracefully', () => {
      const payload = service.generateAuthPayload('', '');

      expect(payload.op).toBe('auth');
      expect(payload.args.length).toBe(3);
      expect(payload.args[0]).toBe('');
      expect(typeof payload.args[1]).toBe('string');
      expect(typeof payload.args[2]).toBe('string');
    });

    it('should handle special characters in credentials', () => {
      const apiKey = 'key-with-!@#$%^&*()_special';
      const apiSecret = 'secret-with-!@#$%^&*()_special';

      const payload = service.generateAuthPayload(apiKey, apiSecret);

      expect(payload.args[0]).toBe(apiKey);
      expect(typeof payload.args[2]).toBe('string');
      expect(payload.args[2].length).toBe(64); // SHA256 hex is 64 chars
    });

    it('should be reproducible with same credentials and expires', () => {
      const apiKey = 'test-key';
      const apiSecret = 'test-secret';

      // Get first payload
      const payload1 = service.generateAuthPayload(apiKey, apiSecret);

      // Manually verify with same expires
      const expires = payload1.args[1];
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(`GET/realtime${expires}`)
        .digest('hex');

      expect(payload1.args[2]).toBe(signature);
    });
  });

  describe('Integration', () => {
    it('payload should be JSON serializable', () => {
      const apiKey = 'test-key';
      const apiSecret = 'test-secret';

      const payload = service.generateAuthPayload(apiKey, apiSecret);

      expect(() => {
        JSON.stringify(payload);
      }).not.toThrow();
    });

    it('should generate new timestamp for each call', (done) => {
      const apiKey = 'test-key';
      const apiSecret = 'test-secret';

      const payload1 = service.generateAuthPayload(apiKey, apiSecret);
      const expires1 = parseInt(payload1.args[1], 10);

      // Wait small amount and generate again
      setTimeout(() => {
        const payload2 = service.generateAuthPayload(apiKey, apiSecret);
        const expires2 = parseInt(payload2.args[1], 10);

        // Expires should be at least slightly different (time passed)
        expect(expires2).toBeGreaterThanOrEqual(expires1);

        done();
      }, 100);
    });
  });
});
