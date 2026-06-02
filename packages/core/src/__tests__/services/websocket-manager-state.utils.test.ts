import {
  buildExecutionEventKey,
  isClosedPositionSize,
  mapExecutionResultToEvent,
  mapOrderUpdateToEvent,
  matchesTrackedSymbol,
  normalizeOrderExecutions,
  normalizeOrderUpdates,
  normalizePositionUpdates,
} from '../../services/websocket-manager/websocket-manager-message.utils';
import {
  buildPrivateWebSocketSubscriptionMessage,
  calculateWebSocketBackoffDelay,
  decodePrivateWebSocketMessage,
  PRIVATE_WS_AUTH_RETRY,
  PRIVATE_WS_CONNECTION_RETRY,
  resolvePrivateWebSocketTarget,
  resolvePrivateWebSocketMode,
  resolvePrivateWebSocketUrl,
} from '../../services/websocket-manager/websocket-manager-connection.utils';

describe('websocket-manager utils', () => {
  it('resolves private websocket url and mode from config', () => {
    expect(resolvePrivateWebSocketUrl({ testnet: false, demo: false })).toBe(
      'wss://stream.bybit.com/v5/private',
    );
    expect(resolvePrivateWebSocketMode({ testnet: false, demo: false })).toBe('MAINNET');

    expect(resolvePrivateWebSocketUrl({ testnet: true, demo: false })).toBe(
      'wss://stream-testnet.bybit.com/v5/private',
    );
    expect(resolvePrivateWebSocketMode({ testnet: true, demo: false })).toBe('TESTNET');

    expect(resolvePrivateWebSocketUrl({ testnet: false, demo: true })).toBe(
      'wss://stream-demo.bybit.com/v5/private',
    );
    expect(resolvePrivateWebSocketMode({ testnet: false, demo: true })).toBe('DEMO');
  });

  it('resolves a consistent private websocket target when demo and testnet flags overlap', () => {
    expect(
      resolvePrivateWebSocketTarget({ testnet: true, demo: true }),
    ).toEqual({
      url: 'wss://stream-demo.bybit.com/v5/private',
      mode: 'DEMO',
    });
  });

  it('calculates retry backoff delays from retry config', () => {
    expect(calculateWebSocketBackoffDelay(1, PRIVATE_WS_CONNECTION_RETRY)).toBe(500);
    expect(calculateWebSocketBackoffDelay(2, PRIVATE_WS_CONNECTION_RETRY)).toBe(1000);
    expect(calculateWebSocketBackoffDelay(3, PRIVATE_WS_CONNECTION_RETRY)).toBe(2000);
    expect(calculateWebSocketBackoffDelay(2, PRIVATE_WS_AUTH_RETRY)).toBe(400);
  });

  it('builds subscribe payload and decodes websocket frames', () => {
    expect(buildPrivateWebSocketSubscriptionMessage()).toEqual({
      op: 'subscribe',
      args: ['position', 'execution', 'order'],
    });

    expect(decodePrivateWebSocketMessage('{"ok":true}')).toBe('{"ok":true}');
    expect(decodePrivateWebSocketMessage(Buffer.from('{"kind":"buffer"}'))).toBe(
      '{"kind":"buffer"}',
    );
    expect(
      decodePrivateWebSocketMessage([
        Buffer.from('{"kind":"array"'),
        Buffer.from(',"part":2}'),
      ]),
    ).toBe('{"kind":"array","part":2}');
    expect(
      decodePrivateWebSocketMessage(
        new TextEncoder().encode('{"kind":"array-buffer"}').buffer,
      ),
    ).toBe('{"kind":"array-buffer"}');
  });

  it('maps execution and order update payloads into emitted events', () => {
    expect(
      mapExecutionResultToEvent(
        {
          type: 'TAKE_PROFIT',
          orderId: 'tp-1',
          symbol: 'APEXUSDT',
          closedSize: 0.1,
          execPrice: 120,
          execQty: '0.1',
          side: 'Sell',
          closedSizeStr: '0.1',
          tpLevel: 1,
        },
        'APEXUSDT',
      ),
    ).toEqual({
      eventName: 'takeProfitFilled',
      payload: {
        orderId: 'tp-1',
        symbol: 'APEXUSDT',
        side: 'Sell',
        avgPrice: '120',
        qty: '0.1',
        cumExecQty: '0.1',
      },
    });

    expect(
      mapOrderUpdateToEvent(
        {
          orderId: 'sl-1',
          symbol: 'APEXUSDT',
          side: 'Sell',
          stopOrderType: 'StopLoss',
          orderStatus: 'Filled',
          avgPrice: '118',
          qty: '0.2',
          cumExecQty: '0.2',
        },
        'APEXUSDT',
      ),
    ).toEqual({
      eventName: 'stopLossFilled',
      payload: {
        orderId: 'sl-1',
        symbol: 'APEXUSDT',
        side: 'Sell',
        avgPrice: '118',
        qty: '0.2',
        cumExecQty: '0.2',
      },
    });
  });

  it('handles symbol matching, close detection, and execution dedupe keys', () => {
    expect(matchesTrackedSymbol('APEXUSDT', 'APEXUSDT')).toBe(true);
    expect(matchesTrackedSymbol('BTCUSDT', 'APEXUSDT')).toBe(false);

    expect(isClosedPositionSize('0')).toBe(true);
    expect(isClosedPositionSize('0.5')).toBe(false);

    expect(
      buildExecutionEventKey('TP', {
        orderId: 'tp-1',
        execPrice: 120,
        closedSize: 0.25,
      }),
    ).toBe('tp-1_120_0.25');
    expect(
      buildExecutionEventKey('SL', {
        orderId: 'sl-1',
        execPrice: 118,
        closedSize: 0.25,
      }),
    ).toBe('sl-1_118');
  });

  it('normalizes websocket topic payloads without propagating nullish records', () => {
    const positionData = {
      symbol: 'APEXUSDT',
      side: 'Buy',
      size: '0.1',
    };
    const executionData = {
      symbol: 'APEXUSDT',
      orderId: 'exec-1',
      execQty: '0.1',
      execPrice: '100',
      side: 'Buy',
    };
    const orderData = {
      symbol: 'APEXUSDT',
      orderId: 'order-1',
      orderStatus: 'Filled',
    };

    expect(
      normalizePositionUpdates([
        null as unknown as typeof positionData,
        positionData,
      ]),
    ).toEqual([positionData]);
    expect(
      normalizeOrderExecutions([
        executionData,
        undefined as unknown as typeof executionData,
      ]),
    ).toEqual([executionData]);
    expect(
      normalizeOrderUpdates([
        null as unknown as typeof orderData,
        orderData,
      ]),
    ).toEqual([orderData]);
  });
});
