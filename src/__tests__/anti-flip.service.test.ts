/**
 * AntiFlipService Unit Tests
 *
 * Tests for the anti-flip protection mechanism.
 */

import { AntiFlipService } from '../services/anti-flip.service';
import { SignalDirection, Candle } from '../types';

// Mock Logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('AntiFlipService', () => {
  let service: AntiFlipService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new AntiFlipService(mockLogger as any, {
      enabled: true,
      cooldownCandles: 3,
      cooldownMs: 300000, // 5 minutes
      requiredConfirmationCandles: 2,
      overrideConfidenceThreshold: 85,
      strongReversalRsiThreshold: 25,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createBullishCandle = (price: number): Candle => ({
    timestamp: Date.now(),
    open: price - 1,
    high: price + 0.5,
    low: price - 1.5,
    close: price,
    volume: 100,
  });

  const createBearishCandle = (price: number): Candle => ({
    timestamp: Date.now(),
    open: price + 1,
    high: price + 1.5,
    low: price - 0.5,
    close: price,
    volume: 100,
  });

  describe('shouldBlockSignal', () => {
    it('should not block when no previous signal', () => {
      const result = service.shouldBlockSignal(
        SignalDirection.LONG,
        70,
        100,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('No previous signal');
    });

    it('should not block same direction signal', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.LONG,
        70,
        101,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Same direction as last signal');
    });

    it('should block opposite direction within cooldown', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        70,
        100,
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('wait');
    });

    it('should not block HOLD signals', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.HOLD,
        70,
        100,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('HOLD signal - no flip');
    });

    it('should allow flip after cooldown candles passed', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      // Simulate 3 candles passing
      service.onNewCandle();
      service.onNewCandle();
      service.onNewCandle();

      // Advance time past cooldown
      jest.advanceTimersByTime(300001);

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        70,
        100,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Cooldown period passed');
    });

    it('should allow flip with high confidence override', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        90, // Above 85% threshold
        100,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('High confidence override');
    });

    it('should allow flip with strong RSI reversal (oversold)', () => {
      service.recordSignal(SignalDirection.SHORT, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.LONG,
        60,
        100,
        20, // RSI below 25 threshold
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('Strong RSI reversal');
    });

    it('should allow flip with strong RSI reversal (overbought)', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        60,
        100,
        80, // RSI above 75 threshold (100 - 25)
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('Strong RSI reversal');
    });

    it('should allow flip with confirmation candles', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const bearishCandles = [
        createBearishCandle(99),
        createBearishCandle(98),
      ];

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        60,
        98,
        50,
        bearishCandles,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('confirmation candles');
    });

    it('should not allow flip without enough confirmation candles', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const mixedCandles = [
        createBullishCandle(101),
        createBearishCandle(100),
      ];

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        60,
        100,
        50,
        mixedCandles,
      );

      expect(result.blocked).toBe(true);
    });
  });

  describe('recordSignal', () => {
    it('should record signal direction and price', () => {
      service.recordSignal(SignalDirection.LONG, 100);

      const state = service.getState();
      expect(state.lastSignal).not.toBeNull();
      expect(state.lastSignal!.direction).toBe(SignalDirection.LONG);
      expect(state.lastSignal!.price).toBe(100);
    });

    it('should reset candle count on new signal', () => {
      service.recordSignal(SignalDirection.LONG, 100);
      service.onNewCandle();
      service.onNewCandle();

      service.recordSignal(SignalDirection.SHORT, 99);

      const state = service.getState();
      expect(state.candlesSinceSignal).toBe(0);
    });

    it('should not record HOLD signals', () => {
      service.recordSignal(SignalDirection.HOLD, 100);

      const state = service.getState();
      expect(state.lastSignal).toBeNull();
    });
  });

  describe('onNewCandle', () => {
    it('should increment candle count', () => {
      service.onNewCandle();
      service.onNewCandle();

      const state = service.getState();
      expect(state.candlesSinceSignal).toBe(2);
    });
  });

  describe('getState', () => {
    it('should report cooldown status correctly', () => {
      expect(service.getState().isInCooldown).toBe(false);

      service.recordSignal(SignalDirection.LONG, 100);
      expect(service.getState().isInCooldown).toBe(true);

      // Pass cooldown
      service.onNewCandle();
      service.onNewCandle();
      service.onNewCandle();
      jest.advanceTimersByTime(300001);

      expect(service.getState().isInCooldown).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      service.recordSignal(SignalDirection.LONG, 100);
      service.onNewCandle();

      service.reset();

      const state = service.getState();
      expect(state.lastSignal).toBeNull();
      expect(state.candlesSinceSignal).toBe(0);
      expect(state.isInCooldown).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should respect disabled config', () => {
      const disabledService = new AntiFlipService(mockLogger as any, {
        enabled: false,
      });

      disabledService.recordSignal(SignalDirection.LONG, 100);

      const result = disabledService.shouldBlockSignal(
        SignalDirection.SHORT,
        50,
        100,
      );

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Anti-flip disabled');
    });

    it('should update configuration', () => {
      service.updateConfig({ cooldownCandles: 5 });
      const config = service.getConfig();

      expect(config.cooldownCandles).toBe(5);
    });

    it('should use custom cooldown values', () => {
      const customService = new AntiFlipService(mockLogger as any, {
        enabled: true,
        cooldownCandles: 1,
        cooldownMs: 1000,
      });

      customService.recordSignal(SignalDirection.LONG, 100);
      customService.onNewCandle();
      jest.advanceTimersByTime(1001);

      const result = customService.shouldBlockSignal(
        SignalDirection.SHORT,
        50,
        100,
      );

      expect(result.blocked).toBe(false);
    });
  });
});
