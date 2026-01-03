import { BotEventEmitter } from '../bot-event-emitter';
import { BotEventBus } from '../services/event-bus';
import { LoggerService } from '../types';

/**
 * Mock LoggerService for tests
 */
const createMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * BotEventEmitter Tests
 *
 * Tests the event adapter that bridges internal BotEventBus to external EventEmitter API
 */
describe('BotEventEmitter', () => {
  let eventBus: BotEventBus;
  let emitter: BotEventEmitter;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = createMockLogger() as LoggerService;
    eventBus = new BotEventBus(mockLogger);
    emitter = new BotEventEmitter(eventBus, mockLogger);
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  // ============================================================================
  // Event Bridging Tests
  // ============================================================================

  describe('event bridging - signal events', () => {
    it('should bridge signal events from BotEventBus', (done) => {
      const testSignal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      emitter.on('signal', (signal) => {
        expect(signal.source).toEqual('TEST');
        expect(signal.confidence).toEqual(0.75);
        done();
      });

      eventBus.emit('signal', testSignal);
    });

    it('should support multiple signal listeners', (done) => {
      const testSignal = {
        type: 'SHORT_ENTRY',
        direction: 'SELL' as const,
        confidence: 0.80,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      let callCount = 0;
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('signal', handler1);
      emitter.on('signal', handler2);

      eventBus.emit('signal', testSignal);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should support removing signal listeners', (done) => {
      const handler = jest.fn();
      emitter.on('signal', handler);
      emitter.off('signal', handler);

      const testSignal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      eventBus.emit('signal', testSignal);

      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('event bridging - position opened', () => {
    it('should bridge position-opened events', (done) => {
      const testPosition = {
        id: 'test-pos-1',
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        status: 'OPEN' as const,
        openedAt: Date.now(),
        entrySignalSource: 'TEST',
        takeProfit: [51000, 52000],
        stopLoss: { percent: 2 } as any,
        currentPrice: 50100,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 0.2,
      };

      emitter.on('position-opened', (position) => {
        expect(position.symbol).toEqual('BTCUSDT');
        done();
      });

      eventBus.emit('position-opened', testPosition);
    });

    it('should support multiple position-opened listeners', (done) => {
      const testPosition = {
        id: 'test-pos-2',
        symbol: 'ETHUSDT',
        entryPrice: 3000,
        quantity: 10,
        side: 'SHORT' as const,
        status: 'OPEN' as const,
        openedAt: Date.now(),
        entrySignalSource: 'TEST',
        takeProfit: [2900],
        stopLoss: { percent: 3 } as any,
        currentPrice: 2950,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 1.67,
      };

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('position-opened', handler1);
      emitter.on('position-opened', handler2);

      eventBus.emit('position-opened', testPosition);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('event bridging - position closed', () => {
    it('should bridge position-closed events', (done) => {
      const testResult = {
        positionId: 'test-pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: 50000,
        exitPrice: 51000,
        quantity: 1,
        pnl: 1000,
        pnlPercent: 2,
        reason: 'TAKE_PROFIT',
        exitType: 'TAKE_PROFIT_1' as const,
        exitedAt: Date.now(),
        duration: 3600000,
      };

      emitter.on('position-closed', (result) => {
        expect(result.symbol).toEqual('BTCUSDT');
        done();
      });

      eventBus.emit('position-closed', testResult);
    });

    it('should support multiple position-closed listeners', (done) => {
      const testResult = {
        positionId: 'test-pos-2',
        symbol: 'ETHUSDT',
        side: 'SHORT' as const,
        entryPrice: 3000,
        exitPrice: 2900,
        quantity: 10,
        pnl: 1000,
        pnlPercent: 3.33,
        reason: 'STOP_LOSS',
        exitType: 'STOP_LOSS' as const,
        exitedAt: Date.now(),
        duration: 1800000,
      };

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('position-closed', handler1);
      emitter.on('position-closed', handler2);

      eventBus.emit('position-closed', testResult);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('event bridging - error events', () => {
    it('should bridge error events', (done) => {
      const testError = new Error('Test error');

      emitter.on('error', (error) => {
        expect(error).toEqual(testError);
        done();
      });

      eventBus.emit('error', testError);
    });

    it('should support multiple error listeners', (done) => {
      const testError = new Error('Test error');
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('error', handler1);
      emitter.on('error', handler2);

      eventBus.emit('error', testError);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledWith(testError);
        expect(handler2).toHaveBeenCalledWith(testError);
        done();
      }, 10);
    });
  });

  describe('event bridging - lifecycle events', () => {
    it('should bridge bot-started events', (done) => {
      emitter.on('bot-started', () => {
        expect(true).toBe(true);
        done();
      });

      eventBus.emit('bot-started', true);
    });

    it('should bridge bot-stopped events', (done) => {
      emitter.on('bot-stopped', () => {
        expect(true).toBe(true);
        done();
      });

      eventBus.emit('bot-stopped', false);
    });

    it('should not emit bot-started if flag is false', (done) => {
      const handler = jest.fn();
      emitter.on('bot-started', handler);

      eventBus.emit('bot-started', false);

      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should not emit bot-stopped if flag is true', (done) => {
      const handler = jest.fn();
      emitter.on('bot-stopped', handler);

      eventBus.emit('bot-stopped', true);

      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  // ============================================================================
  // Type-Safe Convenience Methods Tests
  // ============================================================================

  describe('convenience methods - onSignal', () => {
    it('should provide onSignal() method', (done) => {
      const testSignal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      const handler = jest.fn();
      emitter.onSignal(handler);

      eventBus.emit('signal', testSignal);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('onSignal() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onSignal(handler);

      expect(typeof unsubscribe).toBe('function');

      const testSignal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      eventBus.emit('signal', testSignal);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('signal', testSignal);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });
  });

  describe('convenience methods - onPositionOpened', () => {
    it('should provide onPositionOpened() method', (done) => {
      const testPosition = {
        id: 'test-pos',
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        status: 'OPEN' as const,
        openedAt: Date.now(),
        entrySignalSource: 'TEST',
        takeProfit: [51000],
        stopLoss: { percent: 2 } as any,
        currentPrice: 50100,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 0.2,
      };

      const handler = jest.fn();
      emitter.onPositionOpened(handler);

      eventBus.emit('position-opened', testPosition);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('onPositionOpened() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onPositionOpened(handler);

      expect(typeof unsubscribe).toBe('function');

      const testPosition = {
        id: 'test-pos',
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        status: 'OPEN' as const,
        openedAt: Date.now(),
        entrySignalSource: 'TEST',
        takeProfit: [51000],
        stopLoss: { percent: 2 } as any,
        currentPrice: 50100,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 0.2,
      };

      eventBus.emit('position-opened', testPosition);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('position-opened', testPosition);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });
  });

  describe('convenience methods - onPositionClosed', () => {
    it('should provide onPositionClosed() method', (done) => {
      const testResult = {
        positionId: 'test-pos',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: 50000,
        exitPrice: 51000,
        quantity: 1,
        pnl: 1000,
        pnlPercent: 2,
        reason: 'TAKE_PROFIT',
        exitType: 'TAKE_PROFIT_1' as const,
        exitedAt: Date.now(),
        duration: 3600000,
      };

      const handler = jest.fn();
      emitter.onPositionClosed(handler);

      eventBus.emit('position-closed', testResult);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('onPositionClosed() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onPositionClosed(handler);

      expect(typeof unsubscribe).toBe('function');

      const testResult = {
        positionId: 'test-pos',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: 50000,
        exitPrice: 51000,
        quantity: 1,
        pnl: 1000,
        pnlPercent: 2,
        reason: 'TAKE_PROFIT',
        exitType: 'TAKE_PROFIT_1' as const,
        exitedAt: Date.now(),
        duration: 3600000,
      };

      eventBus.emit('position-closed', testResult);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('position-closed', testResult);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });
  });

  describe('convenience methods - onError', () => {
    it('should provide onError() method', (done) => {
      const testError = new Error('Test error');
      const handler = jest.fn();

      emitter.onError(handler);

      eventBus.emit('error', testError);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith(testError);
        done();
      }, 10);
    });

    it('onError() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onError(handler);

      expect(typeof unsubscribe).toBe('function');

      const testError = new Error('Test error');

      eventBus.emit('error', testError);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('error', testError);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });
  });

  describe('convenience methods - lifecycle', () => {
    it('should provide onBotStarted() method', (done) => {
      const handler = jest.fn();
      emitter.onBotStarted(handler);

      eventBus.emit('bot-started', true);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should provide onBotStopped() method', (done) => {
      const handler = jest.fn();
      emitter.onBotStopped(handler);

      eventBus.emit('bot-stopped', false);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('onBotStarted() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onBotStarted(handler);

      expect(typeof unsubscribe).toBe('function');

      eventBus.emit('bot-started', true);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('bot-started', true);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });

    it('onBotStopped() should return unsubscribe function', (done) => {
      const handler = jest.fn();
      const unsubscribe = emitter.onBotStopped(handler);

      expect(typeof unsubscribe).toBe('function');

      eventBus.emit('bot-stopped', false);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        eventBus.emit('bot-stopped', false);

        setTimeout(() => {
          expect(handler).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }, 10);
    });
  });

  // ============================================================================
  // Isolation & Safety Tests
  // ============================================================================

  describe('isolation - prevent external interference', () => {
    it('should work with multiple independent emitters', (done) => {
      const emitter2 = new BotEventEmitter(eventBus);

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('signal', handler1);
      emitter2.on('signal', handler2);

      const signal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      eventBus.emit('signal', signal);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('removing listener from one emitter should not affect another', (done) => {
      const emitter2 = new BotEventEmitter(eventBus);

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('signal', handler1);
      emitter2.on('signal', handler2);

      const signal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      emitter.off('signal', handler1);
      eventBus.emit('signal', signal);

      setTimeout(() => {
        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  // ============================================================================
  // Static Methods Tests
  // ============================================================================

  describe('static methods', () => {
    it('should provide getAvailableEvents() method', () => {
      const events = BotEventEmitter.getAvailableEvents();

      expect(Array.isArray(events)).toBe(true);
      expect(events).toContain('signal');
      expect(events).toContain('position-opened');
      expect(events).toContain('position-closed');
      expect(events).toContain('error');
      expect(events).toContain('bot-started');
      expect(events).toContain('bot-stopped');
      expect(events.length).toBe(6);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle rapid event emissions', (done) => {
      const handler = jest.fn();
      emitter.on('signal', handler);

      const signals = Array.from({ length: 10 }, (_, i) => ({
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: `TEST${i}`,
        timestamp: Date.now() + i,
        indicators: [],
      }));

      signals.forEach((signal) => {
        eventBus.emit('signal', signal);
      });

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(10);
        done();
      }, 10);
    });

    it('should handle once() method', (done) => {
      const handler = jest.fn();
      emitter.once('signal', handler);

      const signal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      eventBus.emit('signal', signal);
      eventBus.emit('signal', signal);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        done();
      }, 10);
    });

    it('should handle listener count', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('signal', handler1);
      emitter.on('signal', handler2);

      const count = emitter.listenerCount('signal');
      expect(count).toBe(2);
    });

    it('should handle removeAllListeners for specific event', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('signal', handler1);
      emitter.on('position-opened', handler2);

      emitter.removeAllListeners('signal');

      const signal = {
        type: 'LONG_ENTRY',
        direction: 'BUY' as const,
        confidence: 0.75,
        source: 'TEST',
        timestamp: Date.now(),
        indicators: [],
      };

      eventBus.emit('signal', signal);

      const position = {
        id: 'test',
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        status: 'OPEN' as const,
        openedAt: Date.now(),
        entrySignalSource: 'TEST',
        takeProfit: [51000],
        stopLoss: { percent: 2 } as any,
        currentPrice: 50100,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 0.2,
      };

      eventBus.emit('position-opened', position);

      setTimeout(() => {
        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        done();
      }, 10);
    });
  });
});
