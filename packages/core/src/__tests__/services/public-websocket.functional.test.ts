import WebSocket from 'ws';
import type { Candle, OrderbookData, TradeData } from '../../types/legacy';
import {
  createManagedPublicWebSocketContext,
  emitPublicWebSocketMessage,
  setPublicWebSocketSocket,
  type ManagedPublicWebSocketContext,
} from '../helpers/public-websocket-test.utils';

describe('PublicWebSocketService functional behavior', () => {
  let context: ManagedPublicWebSocketContext;

  beforeEach(() => {
    context = createManagedPublicWebSocketContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  it('subscribes all tracked topics on an open socket', () => {
    const send = jest.fn();
    setPublicWebSocketSocket(context.service, {
      readyState: WebSocket.OPEN,
      send,
      close: jest.fn(),
    });

    const serviceState = context.service as unknown as {
      subscribe: () => void;
      subscribedTopics: Set<string>;
    };

    serviceState.subscribe();

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        op: 'subscribe',
        args: [
          'kline.1.XRPUSDT',
          'kline.5.XRPUSDT',
          'kline.15.XRPUSDT',
          'orderbook.50.XRPUSDT',
          'publicTrade.XRPUSDT',
        ],
      }),
    );
    expect(Array.from(serviceState.subscribedTopics)).toEqual([
      'kline.1.XRPUSDT',
      'kline.5.XRPUSDT',
      'kline.15.XRPUSDT',
      'orderbook.50.XRPUSDT',
      'publicTrade.XRPUSDT',
    ]);
  });

  it('does not retain subscribed topics when subscription transport send fails', () => {
    const send = jest.fn(() => {
      throw new Error('send failed');
    });
    setPublicWebSocketSocket(context.service, {
      readyState: WebSocket.OPEN,
      send,
      close: jest.fn(),
    });
    const serviceState = context.service as unknown as {
      subscribe: () => void;
      subscribedTopics: Set<string>;
    };

    expect(() => serviceState.subscribe()).not.toThrow();
    expect(serviceState.subscribedTopics.size).toBe(0);
  });

  it('emits candleClosed for confirmed main-symbol candles', () => {
    const candleClosedSpy = jest.fn();
    context.service.on('candleClosed', candleClosedSpy);

    emitPublicWebSocketMessage(context.service, {
      topic: 'kline.5.XRPUSDT',
      data: [
        {
          start: '1710000000000',
          open: '1',
          high: '2',
          low: '0.5',
          close: '1.5',
          volume: '100',
          interval: '5',
          confirm: true,
        },
      ],
    });

    expect(candleClosedSpy).toHaveBeenCalledWith({
      role: 'TIMEFRAME_5M',
      candle: {
        timestamp: 1710000000000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
      },
    });
  });

  it('updates btc confirmation store without emitting main candle events', () => {
    const btcContext = createManagedPublicWebSocketContext({
      btcConfirmation: {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1',
        lookbackCandles: 2,
      },
    });
    const candleClosedSpy = jest.fn();
    const btcStore = { btcCandles1m: [] as Candle[] };
    btcContext.service.on('candleClosed', candleClosedSpy);
    btcContext.service.setBtcCandlesStore(btcStore as never);

    emitPublicWebSocketMessage(btcContext.service, {
      topic: 'kline.1.BTCUSDT',
      data: [
        {
          start: '1710000000000',
          open: '10',
          high: '11',
          low: '9',
          close: '10.5',
          volume: '50',
          interval: '1',
          confirm: true,
        },
        {
          start: '1710000060000',
          open: '10.5',
          high: '12',
          low: '10',
          close: '11.5',
          volume: '55',
          interval: '1',
          confirm: true,
        },
        {
          start: '1710000120000',
          open: '11.5',
          high: '13',
          low: '11',
          close: '12.5',
          volume: '60',
          interval: '1',
          confirm: true,
        },
      ],
    });

    expect(candleClosedSpy).not.toHaveBeenCalled();
    expect(btcStore.btcCandles1m.map((candle) => candle.timestamp)).toEqual([
      1710000060000,
      1710000120000,
    ]);
    btcContext.cleanup();
  });

  it('emits orderbookUpdate events with snapshot metadata', () => {
    const orderbookSpy = jest.fn();
    context.service.on('orderbookUpdate', orderbookSpy);

    emitPublicWebSocketMessage(context.service, {
      topic: 'orderbook.50.XRPUSDT',
      data: {
        type: 'snapshot',
        u: 1,
        s: 'XRPUSDT',
        b: Array.from({ length: 50 }, () => ['1', '2'] as [string, string]),
        a: Array.from({ length: 50 }, () => ['3', '4'] as [string, string]),
      } satisfies OrderbookData,
    });

    expect(orderbookSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'snapshot',
        symbol: 'XRPUSDT',
        updateId: 1,
      }),
    );
  });

  it('emits normalized trade events from public trade payloads', () => {
    const tradeSpy = jest.fn();
    context.service.on('trade', tradeSpy);

    emitPublicWebSocketMessage(context.service, {
      topic: 'publicTrade.XRPUSDT',
      data: [
        {
          T: 1710000000000,
          S: 'Buy',
          v: '25',
          p: '0.75',
        },
      ] satisfies TradeData[],
    });

    expect(tradeSpy).toHaveBeenCalledWith({
      timestamp: 1710000000000,
      price: 0.75,
      quantity: 25,
      side: 'BUY',
    });
  });
});
