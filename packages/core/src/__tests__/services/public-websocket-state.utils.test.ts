import WebSocket from 'ws';
import type { OrderbookData, TimeframeRole, TradeData } from '../../types/legacy';
import {
  buildPublicWebSocketSubscriptionMessage,
  buildPublicWebSocketTopics,
  decodePublicWebSocketMessage,
} from '../../services/public-websocket/public-websocket-connection.utils';
import {
  appendBtcCandle,
  detectOrderbookSnapshot,
  extractSymbolFromKlineTopic,
  findTimeframeRoleByInterval,
  isBtcKlineTopic,
  isOrderbookDataComplete,
  isTradeDataComplete,
  mapClosedCandleFromKline,
  mapOrderbookUpdateEvent,
  mapTradeEvent,
} from '../../services/public-websocket/public-websocket-message.utils';
import { createPublicWebSocketBtcConfirmationConfig } from '../helpers/public-websocket-test.utils';

describe('public-websocket utils', () => {
  it('builds subscription topics and subscribe payloads', () => {
    const timeframes = new Map<TimeframeRole, { interval: string }>([
      ['ENTRY' as TimeframeRole, { interval: '1' }],
      ['TREND' as TimeframeRole, { interval: '5' }],
    ]);
    const topics = buildPublicWebSocketTopics({
      symbol: 'XRPUSDT',
      timeframes,
      btcConfirmation: createPublicWebSocketBtcConfirmationConfig(),
    });

    expect(topics).toEqual([
      'kline.1.XRPUSDT',
      'kline.5.XRPUSDT',
      'orderbook.50.XRPUSDT',
      'publicTrade.XRPUSDT',
      'kline.1.BTCUSDT',
    ]);
    expect(buildPublicWebSocketSubscriptionMessage(topics)).toEqual({
      op: 'subscribe',
      args: topics,
    });
  });

  it('decodes websocket message payloads from string, buffer, and buffer arrays', () => {
    expect(decodePublicWebSocketMessage('{"kind":"string"}')).toBe('{"kind":"string"}');
    expect(decodePublicWebSocketMessage(Buffer.from('{"kind":"buffer"}'))).toBe(
      '{"kind":"buffer"}',
    );
    expect(
      decodePublicWebSocketMessage([
        Buffer.from('{"kind":"array"'),
        Buffer.from(',"part":2}'),
      ]),
    ).toBe('{"kind":"array","part":2}');
    expect(decodePublicWebSocketMessage(new ArrayBuffer(8) as unknown as WebSocket.Data)).toBe(
      null,
    );
  });

  it('extracts symbols, maps closed candles, and detects btc topics/timeframe roles', () => {
    expect(extractSymbolFromKlineTopic('kline.1.BTCUSDT')).toBe('BTCUSDT');
    expect(
      mapClosedCandleFromKline({
        start: '1710000000000',
        open: '1',
        high: '2',
        low: '0.5',
        close: '1.5',
        volume: '100',
        confirm: true,
      }),
    ).toEqual({
      timestamp: 1710000000000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
    });
    expect(mapClosedCandleFromKline({ confirm: false })).toBeNull();
    expect(
      isBtcKlineTopic('BTCUSDT', createPublicWebSocketBtcConfirmationConfig()),
    ).toBe(true);
    expect(
      findTimeframeRoleByInterval(
        '5',
        new Map<TimeframeRole, { interval: string }>([
          ['ENTRY' as TimeframeRole, { interval: '1' }],
          ['TREND' as TimeframeRole, { interval: '5' }],
        ]),
      ),
    ).toBe('TREND');
  });

  it('appends btc candles and keeps only configured lookback depth', () => {
    const candles = [
      { timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { timestamp: 2, open: 2, high: 2, low: 2, close: 2, volume: 2 },
    ];

    const totalCandles = appendBtcCandle(
      candles,
      { timestamp: 3, open: 3, high: 3, low: 3, close: 3, volume: 3 },
      2,
    );

    expect(totalCandles).toBe(2);
    expect(candles.map((candle) => candle.timestamp)).toEqual([2, 3]);
  });

  it('detects orderbook snapshots and maps orderbook/trade events', () => {
    const snapshot: OrderbookData = {
      type: 'snapshot',
      u: 1,
      s: 'XRPUSDT',
      b: Array.from({ length: 50 }, () => ['1', '2'] as [string, string]),
      a: Array.from({ length: 50 }, () => ['3', '4'] as [string, string]),
    };

    expect(isOrderbookDataComplete(snapshot)).toBe(true);
    expect(detectOrderbookSnapshot(snapshot, 0)).toBe(true);
    expect(mapOrderbookUpdateEvent(snapshot, 'FALLBACK', true)).toEqual(
      expect.objectContaining({
        type: 'snapshot',
        symbol: 'XRPUSDT',
        updateId: 1,
        bids: snapshot.b,
        asks: snapshot.a,
      }),
    );

    const trade: TradeData = { T: 1710000000000, S: 'Buy', v: '25', p: '0.75' };
    expect(isTradeDataComplete(trade)).toBe(true);
    expect(
      mapTradeEvent(
        trade as TradeData & { T: number; S: 'Buy' | 'Sell'; v: string; p: string },
      ),
    ).toEqual({
      timestamp: 1710000000000,
      price: 0.75,
      quantity: 25,
      side: 'BUY',
    });
  });
});
