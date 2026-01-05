/**
 * Entry Confirmation Manager Tests
 */

import { EntryConfirmationManager } from '../../services/entry-confirmation.service';
import { LoggerService, LogLevel, SignalDirection, EntryConfirmationConfig } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

const defaultConfig: EntryConfirmationConfig = {
  long: {
    enabled: true,
    expirySeconds: 120,
  },
  short: {
    enabled: true,
    expirySeconds: 120,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('EntryConfirmationManager', () => {
  let manager: EntryConfirmationManager;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    manager = new EntryConfirmationManager(defaultConfig, logger);
  });

  // TEST 1-2: Basic operations
  describe('basic operations', () => {
    it('should add pending LONG entry and generate unique ID', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED', confidence: 75 },
      });

      expect(id).toContain('APEXUSDT_LONG_');
      expect(manager.getPendingCount()).toBe(1);
    });

    it('should retrieve pending entry by ID', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      const pending = manager.getPending(id);

      expect(pending).toBeDefined();
      expect(pending!.symbol).toBe('APEXUSDT');
      expect(pending!.direction).toBe(SignalDirection.LONG);
      expect(pending!.keyLevel).toBe(1.5000);
    });
  });

  // TEST 3-5: LONG confirmation logic
  describe('LONG confirmation logic', () => {
    it('should CONFIRM when candle closes ABOVE support', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed at 1.5010 (above 1.5000 support)
      const result = manager.checkConfirmation(id, 1.5010);

      expect(result.confirmed).toBe(true);
      expect(result.reason).toContain('above support');
      expect(result.closePrice).toBe(1.5010);
      expect(result.keyLevel).toBe(1.5000);

      // Should be removed from pending after confirmation
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should REJECT when candle closes BELOW support (falling knife)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed at 1.4990 (below 1.5000 support)
      const result = manager.checkConfirmation(id, 1.4990);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('below support');
      expect(result.closePrice).toBe(1.4990);
      expect(result.keyLevel).toBe(1.5000);

      // Should be removed from pending after rejection
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should CONFIRM when candle closes exactly AT support (within tolerance)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed exactly at 1.5000 - within tolerance (0.05% default)
      const result = manager.checkConfirmation(id, 1.5000);

      expect(result.confirmed).toBe(true);
      expect(result.reason).toContain('bounce confirmed');
    });

    it('should REJECT when candle closes clearly BELOW support (beyond tolerance)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed 0.2% below level (beyond 0.05% tolerance)
      const result = manager.checkConfirmation(id, 1.4970);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('below support');
    });
  });

  // TEST 6-8: SHORT confirmation logic
  describe('SHORT confirmation logic', () => {
    it('should CONFIRM when candle closes BELOW resistance', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 2.0000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed at 1.9990 (below 2.0000 resistance)
      const result = manager.checkConfirmation(id, 1.9990);

      expect(result.confirmed).toBe(true);
      expect(result.reason).toContain('below resistance');
      expect(result.closePrice).toBe(1.9990);
      expect(result.keyLevel).toBe(2.0000);

      // Should be removed from pending after confirmation
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should REJECT when candle closes ABOVE resistance (pump continues)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 2.0000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed at 2.0050 (0.25% above 2.0000 resistance - beyond tolerance)
      const result = manager.checkConfirmation(id, 2.0050);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('above resistance');
      expect(result.closePrice).toBe(2.0050);
      expect(result.keyLevel).toBe(2.0000);

      // Should be removed from pending after rejection
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should CONFIRM when candle closes exactly AT resistance (within tolerance)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 2.0000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed exactly at 2.0000 - within tolerance (0.05% default)
      const result = manager.checkConfirmation(id, 2.0000);

      expect(result.confirmed).toBe(true);
      expect(result.reason).toContain('rejection confirmed');
    });

    it('should REJECT when candle closes clearly ABOVE resistance (beyond tolerance)', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 2.0000,
        detectedAt: Date.now(),
        signalData: { type: 'LEVEL_BASED' },
      });

      // Candle closed 0.2% above level (beyond 0.05% tolerance)
      const result = manager.checkConfirmation(id, 2.0040);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('above resistance');
    });
  });

  // TEST 9-10: Expiry handling
  describe('expiry handling', () => {
    it('should reject expired pending entries (after 2 minutes)', () => {
      // Mock Date.now() to control time
      const originalNow = Date.now;
      const startTime = 1000000;
      Date.now = jest.fn(() => startTime);

      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: startTime,
        signalData: { type: 'LEVEL_BASED' },
      });

      // Move time forward 121 seconds (past 2 minute expiry)
      Date.now = jest.fn(() => startTime + 121000);

      const result = manager.checkConfirmation(id, 1.5010);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('timeout');
      expect(manager.getPendingCount()).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should cleanup expired entries', () => {
      const originalNow = Date.now;
      const startTime = 1000000;
      Date.now = jest.fn(() => startTime);

      // Add 3 pending entries
      manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: startTime,
        signalData: {},
      });

      manager.addPending({
        symbol: 'BTCUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 50000,
        detectedAt: startTime,
        signalData: {},
      });

      manager.addPending({
        symbol: 'ETHUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 3000,
        detectedAt: startTime,
        signalData: {},
      });

      expect(manager.getPendingCount()).toBe(3);

      // Move time forward 121 seconds (all expired)
      Date.now = jest.fn(() => startTime + 121000);

      const removed = manager.cleanupExpired();

      expect(removed).toBe(3);
      expect(manager.getPendingCount()).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  // TEST 11-13: Cancel and clear
  describe('cancel and clear', () => {
    it('should cancel pending entry by ID', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      expect(manager.getPendingCount()).toBe(1);

      const cancelled = manager.cancel(id);

      expect(cancelled).toBe(true);
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should return false when cancelling non-existent entry', () => {
      const cancelled = manager.cancel('FAKE_ID_12345');
      expect(cancelled).toBe(false);
    });

    it('should clear all pending entries', () => {
      manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      manager.addPending({
        symbol: 'BTCUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 50000,
        detectedAt: Date.now(),
        signalData: {},
      });

      expect(manager.getPendingCount()).toBe(2);

      manager.clear();

      expect(manager.getPendingCount()).toBe(0);
    });
  });

  // TEST 14-15: Multiple pending entries
  describe('multiple pending entries', () => {
    it('should handle multiple pending entries independently', () => {
      const id1 = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      const id2 = manager.addPending({
        symbol: 'BTCUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 50000,
        detectedAt: Date.now(),
        signalData: {},
      });

      expect(manager.getPendingCount()).toBe(2);

      // Confirm first entry (LONG)
      const result1 = manager.checkConfirmation(id1, 1.5010);
      expect(result1.confirmed).toBe(true);
      expect(manager.getPendingCount()).toBe(1);

      // Reject second entry (SHORT) - price 0.2% above resistance (beyond tolerance)
      const result2 = manager.checkConfirmation(id2, 50100);
      expect(result2.confirmed).toBe(false);
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should return all pending entries', () => {
      manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      manager.addPending({
        symbol: 'BTCUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 50000,
        detectedAt: Date.now(),
        signalData: {},
      });

      const allPending = manager.getAllPending();

      expect(allPending).toHaveLength(2);
      expect(allPending[0].symbol).toBe('APEXUSDT');
      expect(allPending[1].symbol).toBe('BTCUSDT');
    });

    it('should filter by direction', () => {
      manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      manager.addPending({
        symbol: 'BTCUSDT',
        direction: SignalDirection.SHORT,
        keyLevel: 50000,
        detectedAt: Date.now(),
        signalData: {},
      });

      const longPending = manager.getAllPending(SignalDirection.LONG);
      const shortPending = manager.getAllPending(SignalDirection.SHORT);

      expect(longPending).toHaveLength(1);
      expect(longPending[0].direction).toBe(SignalDirection.LONG);

      expect(shortPending).toHaveLength(1);
      expect(shortPending[0].direction).toBe(SignalDirection.SHORT);
    });
  });

  // TEST 16-18: Edge cases
  describe('edge cases', () => {
    it('should return not found for non-existent ID', () => {
      const result = manager.checkConfirmation('FAKE_ID_12345', 1.5010);

      expect(result.confirmed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should handle very small price differences', () => {
      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.500000,
        detectedAt: Date.now(),
        signalData: {},
      });

      // Candle closed 0.0001% above support
      const result = manager.checkConfirmation(id, 1.500001);

      expect(result.confirmed).toBe(true);
    });

    it('should return undefined for non-existent getPending', () => {
      const pending = manager.getPending('FAKE_ID_12345');
      expect(pending).toBeUndefined();
    });
  });

  // TEST 19: Signal data preservation
  describe('signal data preservation', () => {
    it('should preserve original signal data', () => {
      const signalData = {
        type: 'LEVEL_BASED',
        confidence: 75,
        reason: 'Strong support at 1.5000 (3 touches)',
        atr: 0.015,
        rsi: 35,
      };

      const id = manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData,
      });

      const pending = manager.getPending(id);

      expect(pending!.signalData).toEqual(signalData);
      expect(pending!.signalData.type).toBe('LEVEL_BASED');
      expect(pending!.signalData.confidence).toBe(75);
    });
  });

  // TEST 20-21: Configuration
  describe('configuration', () => {
    it('should check if confirmation is enabled for LONG', () => {
      expect(manager.isEnabled(SignalDirection.LONG)).toBe(true);
    });

    it('should check if confirmation is enabled for SHORT', () => {
      expect(manager.isEnabled(SignalDirection.SHORT)).toBe(true);
    });

    it('should respect disabled configuration', () => {
      const disabledConfig: EntryConfirmationConfig = {
        long: {
          enabled: false,
          expirySeconds: 120,
        },
        short: {
          enabled: true,
          expirySeconds: 120,
        },
      };

      const disabledManager = new EntryConfirmationManager(disabledConfig, logger);

      expect(disabledManager.isEnabled(SignalDirection.LONG)).toBe(false);
      expect(disabledManager.isEnabled(SignalDirection.SHORT)).toBe(true);
    });
  });
});
