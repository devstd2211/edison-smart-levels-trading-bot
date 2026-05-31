import WebSocket from 'ws';
import {
  createManagedWebSocketManagerContext,
  emitWebSocketManagerMessage,
  setWebSocketManagerSocket,
  type ManagedWebSocketManagerContext,
} from '../helpers/websocket-manager-test.utils';

describe('WebSocketManagerService functional behavior', () => {
  let context: ManagedWebSocketManagerContext;

  beforeEach(() => {
    context = createManagedWebSocketManagerContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('subscribes after auth acknowledgement on an open socket', async () => {
    const send = jest.fn();
    setWebSocketManagerSocket(context.wsManager, {
      readyState: WebSocket.OPEN,
      send,
      close: jest.fn(),
    });

    emitWebSocketManagerMessage(context.wsManager, {
      op: 'auth',
      success: true,
    });

    await Promise.resolve();

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        op: 'subscribe',
        args: ['position', 'execution', 'order'],
      }),
    );
  });

  it('does not subscribe after auth acknowledgement when the socket is not open', async () => {
    const send = jest.fn();
    setWebSocketManagerSocket(context.wsManager, {
      readyState: WebSocket.CLOSED,
      send,
      close: jest.fn(),
    });

    emitWebSocketManagerMessage(context.wsManager, {
      op: 'auth',
      success: true,
    });

    await Promise.resolve();

    expect(send).not.toHaveBeenCalled();
  });

  it('emits positionUpdate for tracked symbol position messages', () => {
    const positionUpdateSpy = jest.fn();
    context.wsManager.on('positionUpdate', positionUpdateSpy);

    emitWebSocketManagerMessage(context.wsManager, {
      topic: 'position',
      data: {
        symbol: 'APEXUSDT',
        side: 'Buy',
        size: '0.5',
        entryPrice: '100',
        avgPrice: '100',
        leverage: '5',
        unrealisedPnl: '12.5',
        positionIM: '10',
      },
    });

    expect(positionUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'APEXUSDT',
        quantity: 0.5,
        entryPrice: 100,
        leverage: 5,
        unrealizedPnL: 12.5,
        status: 'OPEN',
      }),
    );
  });

  it('emits positionClosed and resets tp counter when tracked position size becomes zero', () => {
    const positionClosedSpy = jest.fn();
    context.wsManager.on('positionClosed', positionClosedSpy);

    emitWebSocketManagerMessage(context.wsManager, {
      topic: 'execution',
      data: {
        symbol: 'APEXUSDT',
        orderId: 'tp-1',
        side: 'Sell',
        execQty: '0.1',
        execPrice: '120',
        closedSize: '0.1',
        stopOrderType: 'PartialTakeProfit',
        createType: 'CreateByUser',
      },
    });

    expect(context.orderExecutionDetector.getTpCounter()).toBe(1);

    emitWebSocketManagerMessage(context.wsManager, {
      topic: 'position',
      data: {
        symbol: 'APEXUSDT',
        side: 'Buy',
        size: '0',
      },
    });

    expect(positionClosedSpy).toHaveBeenCalledWith({ symbol: 'APEXUSDT' });
    expect(context.orderExecutionDetector.getTpCounter()).toBe(0);
  });

  it('deduplicates repeated take-profit execution messages', () => {
    const takeProfitSpy = jest.fn();
    context.wsManager.on('takeProfitFilled', takeProfitSpy);

    const executionMessage = {
      topic: 'execution',
      data: {
        symbol: 'APEXUSDT',
        orderId: 'tp-duplicate',
        side: 'Sell',
        execQty: '0.1',
        execPrice: '121',
        closedSize: '0.1',
        stopOrderType: 'PartialTakeProfit',
        createType: 'CreateByUser',
      },
    };

    emitWebSocketManagerMessage(context.wsManager, executionMessage);
    emitWebSocketManagerMessage(context.wsManager, executionMessage);

    expect(takeProfitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits stopLossFilled from filled stop loss order updates', () => {
    const stopLossSpy = jest.fn();
    context.wsManager.on('stopLossFilled', stopLossSpy);

    emitWebSocketManagerMessage(context.wsManager, {
      topic: 'order',
      data: {
        symbol: 'APEXUSDT',
        orderId: 'sl-order-1',
        side: 'Sell',
        stopOrderType: 'StopLoss',
        orderStatus: 'Filled',
        avgPrice: '98',
        qty: '0.4',
        cumExecQty: '0.4',
      },
    });

    expect(stopLossSpy).toHaveBeenCalledWith({
      orderId: 'sl-order-1',
      symbol: 'APEXUSDT',
      side: 'Sell',
      avgPrice: '98',
      qty: '0.4',
      cumExecQty: '0.4',
    });
  });
});
