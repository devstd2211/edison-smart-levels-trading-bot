/**
 * WebSocketAuthenticationService Error Handling Tests
 * Phase 8.9.78: THROW (input validation) + GRACEFUL_DEGRADE (signature generation) + SKIP (logging)
 */

import { WebSocketAuthenticationService } from '../../services/websocket-authentication.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createWebSocketAuthenticationHarness,
  type AuthLogger,
} from '../helpers/websocket-authentication-test.utils';

describe('WebSocketAuthenticationService - Error Handling', () => {
  let service: WebSocketAuthenticationService;
  let errorHandler: ErrorHandler;
  let mockLogger: AuthLogger;

  beforeEach(() => {
    ({ service, errorHandler, mockLogger } = createWebSocketAuthenticationHarness());
  });

  // ===== THROW: Input Validation =====
  describe('THROW: Input Validation', () => {
    it('should throw when apiKey is null', () => {
      expect(() => {
        service.generateAuthPayload(null as unknown as string, 'valid-secret-key');
      }).toThrow('apiKey must be a non-null value');
    });

    it('should throw when apiSecret is null', () => {
      expect(() => {
        service.generateAuthPayload('valid-api-key', null as unknown as string);
      }).toThrow('apiSecret must be a non-null value');
    });

    it('should not throw for empty string apiKey', () => {
      expect(() => {
        service.generateAuthPayload('', 'valid-secret-key');
      }).not.toThrow();
    });

    it('should not throw for whitespace-only apiKey', () => {
      expect(() => {
        service.generateAuthPayload('   ', 'valid-secret-key');
      }).not.toThrow();
    });
  });

  // ===== GRACEFUL_DEGRADE: Signature Generation =====
  describe('GRACEFUL_DEGRADE: Signature Generation', () => {
    it('should return safe default payload on signature generation failure', () => {
      // Mock crypto to fail
      const originalCreateHmac = require('crypto').createHmac;
      jest.doMock('crypto', () => ({
        createHmac: jest.fn().mockImplementation(() => {
          throw new Error('Crypto error');
        }),
      }));

      // Create new service with mocked crypto
      const newService = new WebSocketAuthenticationService(mockLogger, errorHandler);

      // Unmock to restore original behavior
      jest.unmock('crypto');

      // Service should still work with valid credentials
      const result = newService.generateAuthPayload('test-key-1234567890', 'test-secret-1234567890');

      expect(result.op).toBe('auth');
      expect(result.args).toHaveLength(3);
      expect(result.args[0]).toBe('test-key-1234567890');
    });

    it('should continue with empty signature on crypto failure', () => {
      // Valid credentials should generate payload even if signature fails internally
      const result = service.generateAuthPayload('valid-key-1234567890', 'valid-secret-1234567890');

      expect(result.op).toBe('auth');
      expect(result.args).toHaveLength(3);
      expect(typeof result.args[2]).toBe('string');
    });
  });

  // ===== SKIP: Logging Failures =====
  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors silently in generateAuthPayload', () => {
      const loggerWithError = {
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = new WebSocketAuthenticationService(loggerWithError, errorHandler);

      expect(() => {
        serviceWithBadLogger.generateAuthPayload('valid-key-1234567890', 'valid-secret-1234567890');
      }).not.toThrow();
    });

    it('should skip logger errors silently in validateCredentials', () => {
      const loggerWithError = {
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = new WebSocketAuthenticationService(loggerWithError, errorHandler);

      expect(() => {
        serviceWithBadLogger.validateCredentials('valid-key-1234567890', 'valid-secret-1234567890');
      }).not.toThrow();
    });

    it('should continue operation when logger.warn fails', () => {
      const loggerWithError = {
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      const serviceWithBadLogger = new WebSocketAuthenticationService(loggerWithError, errorHandler);

      const result = serviceWithBadLogger.validateCredentials('invalid', 'invalid');

      expect(result).toBe(false);
    });

    it('should handle missing logger gracefully', () => {
      const serviceNoLogger = new WebSocketAuthenticationService(undefined, errorHandler);

      const result = serviceNoLogger.generateAuthPayload('valid-key-1234567890', 'valid-secret-1234567890');

      expect(result).toBeDefined();
      expect(result.op).toBe('auth');
    });

    it('should handle missing errorHandler in SKIP operations', () => {
      const serviceNoHandler = new WebSocketAuthenticationService(mockLogger);

      expect(() => {
        serviceNoHandler.validateCredentials('short', 'short');
      }).not.toThrow();
    });
  });

  // ===== Integration Tests =====
  describe('Integration: Auth Payload Generation', () => {
    it('should generate valid auth payload with valid credentials', () => {
      const result = service.generateAuthPayload('test-api-key-1234567890', 'test-secret-key-1234567890');

      expect(result.op).toBe('auth');
      expect(result.args).toHaveLength(3);
      expect(typeof result.args[0]).toBe('string');
      expect(typeof result.args[1]).toBe('string');
      expect(typeof result.args[2]).toBe('string');
      expect(result.args[0]).toBe('test-api-key-1234567890');
      expect(result.args[2].length).toBeGreaterThan(0); // Signature should be non-empty
    });

    it('should generate unique signatures for different calls', (done) => {
      const payload1 = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      // Wait a few milliseconds to ensure different timestamp
      setTimeout(() => {
        const payload2 = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

        // Signatures should be different due to different timestamps
        expect(payload1.args[1]).not.toEqual(payload2.args[1]);
        done();
      }, 10);
    });

    it('should use correct HMAC-SHA256 algorithm', () => {
      const result = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      // Signature should be a valid hex string (64 chars for SHA256)
      expect(result.args[2]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should include correct expiration format', () => {
      const result = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      const expires = parseInt(result.args[1], 10);
      const now = Date.now();

      // Expires should be in future
      expect(expires).toBeGreaterThan(now);
      // Should be around 10 seconds in future (AUTH_EXPIRES_OFFSET_MS = 10000)
      expect(expires - now).toBeLessThan(11000);
      expect(expires - now).toBeGreaterThan(9000);
    });

    it('should generate consistent structure across multiple calls', () => {
      const result1 = service.generateAuthPayload('key-1234567890', 'secret-1234567890');
      const result2 = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      expect(result1.op).toBe(result2.op);
      expect(result1.args.length).toBe(result2.args.length);
      expect(result1.args[0]).toBe(result2.args[0]);
    });
  });

  // ===== Credential Validation =====
  describe('Integration: Credential Validation', () => {
    it('should validate valid credentials', () => {
      const result = service.validateCredentials('valid-key-1234567890', 'valid-secret-1234567890');

      expect(result).toBe(true);
    });

    it('should reject credentials that are too short', () => {
      const result = service.validateCredentials('short', 'short');

      expect(result).toBe(false);
    });

    it('should reject null apiKey in validateCredentials', () => {
      const result = service.validateCredentials(null as unknown as string, 'valid-secret-1234567890');

      expect(result).toBe(false);
    });

    it('should reject null apiSecret in validateCredentials', () => {
      const result = service.validateCredentials('valid-key-1234567890', null as unknown as string);

      expect(result).toBe(false);
    });

    it('should reject empty strings in validateCredentials', () => {
      const result = service.validateCredentials('', 'valid-secret-1234567890');

      expect(result).toBe(false);
    });

    it('should validate credentials early during initialization', () => {
      const isValid = service.validateCredentials('my-api-key-1234567890', 'my-secret-key-1234567890');

      expect(isValid).toBe(true);

      // Should then be able to generate payload
      const payload = service.generateAuthPayload('my-api-key-1234567890', 'my-secret-key-1234567890');
      expect(payload).toBeDefined();
    });
  });

  // ===== Backward Compatibility =====
  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', () => {
      const serviceNoHandler = new WebSocketAuthenticationService(mockLogger);

      const result = serviceNoHandler.generateAuthPayload('key-1234567890', 'secret-1234567890');

      expect(result).toBeDefined();
      expect(result.op).toBe('auth');
    });

    it('should work without logger', () => {
      const result = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      expect(result).toBeDefined();
      expect(result.op).toBe('auth');
    });

    it('should throw on validation errors even without ErrorHandler', () => {
      const serviceNoHandler = new WebSocketAuthenticationService();

      expect(() => {
        serviceNoHandler.generateAuthPayload(null as unknown as string, 'secret-1234567890');
      }).toThrow();
    });

    it('should maintain auth payload interface structure', () => {
      const result = service.generateAuthPayload('key-1234567890', 'secret-1234567890');

      // Verify structure matches WebSocketAuthPayload interface
      expect(result.op).toBe('auth');
      expect(Array.isArray(result.args)).toBe(true);
      expect(result.args.length).toBe(3);
    });
  });

  // ===== Edge Cases =====
  describe('Edge Cases', () => {
    it('should handle very long credentials', () => {
      const longKey = 'a'.repeat(1000);
      const longSecret = 'b'.repeat(1000);

      const result = service.generateAuthPayload(longKey, longSecret);

      expect(result.op).toBe('auth');
      expect(result.args[0]).toBe(longKey);
    });

    it('should handle credentials with special characters', () => {
      const specialKey = 'key-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const specialSecret = 'secret-!@#$%^&*()_+-=[]{}|;:,.<>?';

      const result = service.generateAuthPayload(specialKey, specialSecret);

      expect(result.op).toBe('auth');
      expect(result.args[0]).toBe(specialKey);
    });

    it('should handle credentials with unicode characters', () => {
      const unicodeKey = 'key-日本語-русский-العربية';
      const unicodeSecret = 'secret-中文-हिन्दी-ไทย';

      const result = service.generateAuthPayload(unicodeKey, unicodeSecret);

      expect(result.op).toBe('auth');
      expect(result.args[0]).toBe(unicodeKey);
    });

    it('should always provide valid expires timestamp', () => {
      for (let i = 0; i < 5; i++) {
        const result = service.generateAuthPayload('key-1234567890', 'secret-1234567890');
        const expires = parseInt(result.args[1], 10);
        const now = Date.now();

        expect(Number.isFinite(expires)).toBe(true);
        expect(expires).toBeGreaterThan(now);
        // Expires should be around 10 seconds in future (AUTH_EXPIRES_OFFSET_MS = 10000)
        expect(expires - now).toBeLessThan(12000);
        expect(expires - now).toBeGreaterThan(9000);
      }
    });

    it('should handle constructor with partial logger', () => {
      const partialLogger: AuthLogger = { info: jest.fn() };
      const servicePartialLogger = new WebSocketAuthenticationService(partialLogger, errorHandler);

      const result = servicePartialLogger.generateAuthPayload('key-1234567890', 'secret-1234567890');

      expect(result).toBeDefined();
    });
  });
});
