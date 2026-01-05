/**
 * WebSocketReceiver
 *
 * Receives and parses WebSocket messages from Bybit.
 * NO AWAIT operations - fire-and-forget to prevent blocking.
 */

import { CandleRecord, TradeTickRecord, LoggerService } from '../../types';

// ============================================================================
// INTERFACES (Bybit V5 format)
// ============================================================================

interface BybitKlineData {
  topic: string;
  type: string;
  data: Array<{
    start: number;
    end: number;
    interval: string;
    open: string;
    close: string;
    high: string;
    low: string;
    volume: string;
    turnover: string;
    confirm: boolean;
    timestamp: number;
  }>;
  ts: number;
}

interface BybitOrderbookData {
  topic: string;
  type: string;
  data: {
    s: string; // symbol
    b: Array<[string, string]>; // bids [[price, size], ...]
    a: Array<[string, string]>; // asks [[price, size], ...]
    u: number; // update id
    seq: number;
  };
  ts: number;
}

interface BybitTradeData {
  topic: string;
  type: string;
  data: Array<{
    T: number; // timestamp
    s: string; // symbol
    S: 'Buy' | 'Sell'; // side
    v: string; // volume
    p: string; // price
    L: string; // trade direction
    i: string; // trade id
    BT: boolean;
  }>;
  ts: number;
}

// ============================================================================
// RECEIVER
// ============================================================================

export class WebSocketReceiver {
  constructor(private logger: LoggerService) {}

  /**
   * Parse WebSocket message (NO AWAIT - returns data synchronously)
   */
  parseMessage(data: string): ParsedMessage | null {
    try {
      const message = JSON.parse(data) as Record<string, unknown>;

      // Subscription response
      if (message.op === 'subscribe') {
        return {
          type: 'subscription',
          success: message.success === true,
          conn_id: String(message.conn_id ?? ''),
          ret_msg: message.ret_msg as string | undefined,
        };
      }

      // Server-initiated ping
      if (message.op === 'ping') {
        const argsValue = message.args as unknown;
        const args: string[] = Array.isArray(argsValue) ? (argsValue as string[]) : [];
        return {
          type: 'server-ping',
          args,
        };
      }

      // Pong from server
      if (message.op === 'pong' || (message.op === 'ping' && message.ret_msg === 'pong')) {
        return {
          type: 'pong',
          op: message.op as string,
        };
      }

      // Data messages
      if (message.topic) {
        if ((message.topic as string).startsWith('kline.')) {
          return this.parseKlineData(message as unknown as BybitKlineData);
        } else if ((message.topic as string).startsWith('orderbook.')) {
          return this.parseOrderbookData(message as unknown as BybitOrderbookData);
        } else if ((message.topic as string).startsWith('publicTrade.')) {
          return this.parseTradeData(message as unknown as BybitTradeData);
        }
      }

      // Unhandled message
      return {
        type: 'unhandled',
        op: message.op as string | undefined,
        keys: Object.keys(message).join(','),
      };
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', {
        error: error instanceof Error ? error.message : String(error),
        data: data.substring(0, 200),
      });
      return null;
    }
  }

  /**
   * Parse kline (candle) data
   */
  private parseKlineData(data: BybitKlineData): ParsedMessage | null {
    try {
      const kline = data.data[0];
      const topicParts = data.topic.split('.'); // "kline.1.APEXUSDT"
      const timeframe = this.normalizeTimeframe(topicParts[1]);
      const symbol = topicParts[2];

      // Only save confirmed candles (closed candles)
      if (!kline.confirm) {
        return null;
      }

      const candle: CandleRecord = {
        symbol: symbol,
        timeframe: timeframe,
        timestamp: kline.end, // Use candle CLOSE time
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        createdAt: Date.now(),
      };

      return {
        type: 'candle',
        candle: candle,
      };
    } catch (error) {
      this.logger.error('Failed to parse kline data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Parse orderbook data
   */
  private parseOrderbookData(data: BybitOrderbookData): ParsedMessage | null {
    try {
      const symbol = data.data.s;

      return {
        type: 'orderbook',
        symbol: symbol,
        bids: data.data.b,
        asks: data.data.a,
      };
    } catch (error) {
      this.logger.error('Failed to parse orderbook data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Parse trade tick data
   */
  private parseTradeData(data: BybitTradeData): ParsedMessage | null {
    try {
      const ticks: TradeTickRecord[] = data.data.map((trade) => ({
        symbol: trade.s,
        timestamp: trade.T,
        price: parseFloat(trade.p),
        size: parseFloat(trade.v),
        side: trade.S,
        createdAt: Date.now(),
      }));

      return {
        type: 'trade-ticks',
        ticks: ticks,
      };
    } catch (error) {
      this.logger.error('Failed to parse trade data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Normalize timeframe format (Bybit uses "1" for 1m, we use "1m")
   */
  private normalizeTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '1h',
      '240': '4h',
    };
    return map[timeframe] || timeframe;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type ParsedMessage =
  | { type: 'subscription'; success: boolean; conn_id: string; ret_msg?: string }
  | { type: 'server-ping'; args: string[] }
  | { type: 'pong'; op: string }
  | { type: 'candle'; candle: CandleRecord }
  | { type: 'orderbook'; symbol: string; bids: Array<[string, string]>; asks: Array<[string, string]> }
  | { type: 'trade-ticks'; ticks: TradeTickRecord[] }
  | { type: 'unhandled'; op?: string; keys: string };
