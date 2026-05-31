import { RecoveryStrategy } from '../../errors/ErrorHandler';
import type { OrderbookData, TradeData } from '../../types/legacy';
import {
  createManagedPublicWebSocketContext,
  emitPublicWebSocketMessage,
  setPublicWebSocketSocket,
  type PublicWebSocketErrorHandlingState,
} from '../helpers/public-websocket-test.utils';

describe('PublicWebSocketService error handling', () => {
  let service: PublicWebSocketErrorHandlingState['service'];
  let mockLogger: PublicWebSocketErrorHandlingState['mockLogger'];
  let errorHandler: PublicWebSocketErrorHandlingState['errorHandler'];
  let createLegacyService: PublicWebSocketErrorHandlingState['createLegacyService'];
  let cleanup: PublicWebSocketErrorHandlingState['cleanup'];

  beforeEach(() => {
    ({
      service,
      mockLogger,
      errorHandler,
      createLegacyService,
      cleanup,
    } = createManagedPublicWebSocketContext());
  });

  afterEach(() => {
    cleanup();
  });

  it('uses GRACEFUL_DEGRADE when websocket payload JSON is malformed', () => {
    emitPublicWebSocketMessage(service, '{invalid json');

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'PublicWebSocketService.handleMessage',
        logger: mockLogger,
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping malformed message due to parse error'),
    );
  });

  it('emits fallback error when malformed JSON is received without an error handler', () => {
    const legacyService = createLegacyService({ symbol: 'XRPUSDT' });
    const errorSpy = jest.fn();
    legacyService.on('error', errorSpy);

    emitPublicWebSocketMessage(legacyService, '{invalid json');

    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('uses GRACEFUL_DEGRADE when orderbook payload is incomplete', () => {
    emitPublicWebSocketMessage(service, {
      topic: 'orderbook.50.XRPUSDT',
      data: { b: [['1', '2'] as [string, string]] } as Partial<OrderbookData>,
    });

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'PublicWebSocketService.handleOrderbookUpdate',
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Orderbook data missing b or a'),
      expect.any(Object),
    );
  });

  it('uses GRACEFUL_DEGRADE when trade payload is incomplete', () => {
    emitPublicWebSocketMessage(service, {
      topic: 'publicTrade.XRPUSDT',
      data: [{ v: '100' } as Partial<TradeData>],
    });

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'PublicWebSocketService.handleTradeUpdate',
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Incomplete trade data'),
      expect.any(Object),
    );
  });

  it('uses SKIP when disconnect cleanup throws', () => {
    const close = jest.fn(() => {
      throw new Error('close failed');
    });
    setPublicWebSocketSocket(service, {
      readyState: 1,
      close,
    });

    service.disconnect();

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.SKIP,
        context: 'PublicWebSocketService.disconnect',
      }),
    );
    expect(service.isConnected()).toBe(false);
  });

  it('uses GRACEFUL_DEGRADE when subscription transport send throws', () => {
    const send = jest.fn(() => {
      throw new Error('subscribe failed');
    });
    setPublicWebSocketSocket(service, {
      readyState: 1,
      send,
      close: jest.fn(),
    });

    expect(() =>
      (service as unknown as { subscribe: () => void }).subscribe(),
    ).not.toThrow();

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'PublicWebSocketService.subscribe',
      }),
    );
  });

  it('emits fallback error when subscription send throws without an error handler', () => {
    const legacyService = createLegacyService({ symbol: 'XRPUSDT' });
    const errorSpy = jest.fn();
    legacyService.on('error', errorSpy);
    setPublicWebSocketSocket(legacyService, {
      readyState: 1,
      send: () => {
        throw new Error('subscribe failed');
      },
      close: jest.fn(),
    });

    expect(() =>
      (legacyService as unknown as { subscribe: () => void }).subscribe(),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('uses GRACEFUL_DEGRADE when ping transport send throws', () => {
    jest.useFakeTimers();
    const send = jest.fn(() => {
      throw new Error('ping failed');
    });
    setPublicWebSocketSocket(service, {
      readyState: 1,
      send,
      close: jest.fn(),
    });

    expect(() =>
      (service as unknown as { startPing: () => void }).startPing(),
    ).not.toThrow();
    expect(() => {
      jest.advanceTimersByTime(20_000);
    }).not.toThrow();

    expect(errorHandler.handle).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'PublicWebSocketService.startPing',
      }),
    );
    jest.useRealTimers();
  });
});
