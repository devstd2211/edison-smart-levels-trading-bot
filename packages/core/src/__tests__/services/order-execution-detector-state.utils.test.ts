import {
  advanceOrderExecutionState,
  buildOrderExecutionResult,
  createOrderExecutionLogContext,
  detectOrderExecutionType,
  parseOrderExecutionNumber,
} from '../../services/order-execution-detector/order-execution-detector-state.utils';
import { createOrderExecutionDetectorExecutionData } from '../helpers/order-execution-detector-test.utils';

describe('order-execution-detector state utils', () => {
  it('parses finite numbers and rejects invalid values', () => {
    expect(parseOrderExecutionNumber('105.5')).toBe(105.5);
    expect(parseOrderExecutionNumber(undefined)).toBe(0);
    expect(parseOrderExecutionNumber('invalid')).toBeNull();
    expect(parseOrderExecutionNumber((Number.MAX_VALUE * 2).toString())).toBeNull();
  });

  it('detects execution type from websocket payload and closed size', () => {
    expect(
      detectOrderExecutionType(
        createOrderExecutionDetectorExecutionData({
          stopOrderType: 'UNKNOWN',
          createType: 'CreateByUser',
          closedSize: '5',
        }),
        5,
      ),
    ).toBe('TAKE_PROFIT');

    expect(
      detectOrderExecutionType(
        createOrderExecutionDetectorExecutionData({ stopOrderType: 'StopLoss' }),
        10,
      ),
    ).toBe('STOP_LOSS');

    expect(
      detectOrderExecutionType(
        createOrderExecutionDetectorExecutionData({ stopOrderType: 'TrailingStop' }),
        10,
      ),
    ).toBe('TRAILING_STOP');

    expect(
      detectOrderExecutionType(
        createOrderExecutionDetectorExecutionData({ closedSize: '0' }),
        0,
      ),
    ).toBe('ENTRY');
  });

  it('advances TP counter and close reason according to execution type', () => {
    const takeProfit = advanceOrderExecutionState(
      {
        tpCounter: 1,
        lastCloseReason: null,
      },
      'TAKE_PROFIT',
    );

    expect(takeProfit.tpLevel).toBe(2);
    expect(takeProfit.nextState).toEqual({
      tpCounter: 2,
      lastCloseReason: 'TP',
    });

    const stopLoss = advanceOrderExecutionState(takeProfit.nextState, 'STOP_LOSS');
    expect(stopLoss.nextState).toEqual({
      tpCounter: 0,
      lastCloseReason: 'SL',
    });

    const entry = advanceOrderExecutionState(stopLoss.nextState, 'ENTRY');
    expect(entry.nextState).toEqual({
      tpCounter: 0,
      lastCloseReason: 'SL',
    });
  });

  it('builds downstream execution result and debug log context', () => {
    const execData = createOrderExecutionDetectorExecutionData({
      orderId: 'tp-2',
      execPrice: '101.25',
      closedSize: '3.5',
    });

    expect(
      buildOrderExecutionResult({
        execData,
        type: 'TAKE_PROFIT',
        tpLevel: 2,
        closedSize: 3.5,
        execPrice: 101.25,
      }),
    ).toEqual({
      type: 'TAKE_PROFIT',
      tpLevel: 2,
      orderId: 'tp-2',
      symbol: 'APEXUSDT',
      closedSize: 3.5,
      execPrice: 101.25,
      execQty: '10',
      side: 'Buy',
      closedSizeStr: '3.5',
    });

    expect(createOrderExecutionLogContext(execData)).toMatchObject({
      orderId: 'tp-2',
      symbol: 'APEXUSDT',
      execPrice: '101.25',
      closedSize: '3.5',
    });
  });
});
