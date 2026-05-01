import type { OrderExecutionData } from '../../types/events/websocket.types';

export type OrderExecutionType =
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'TRAILING_STOP'
  | 'ENTRY'
  | 'UNKNOWN';

export type OrderExecutionCloseReason = 'SL' | 'TP' | 'TRAILING' | null;

export interface OrderExecutionDetectorState {
  tpCounter: number;
  lastCloseReason: OrderExecutionCloseReason;
}

export interface OrderExecutionStateTransition {
  type: OrderExecutionType;
  tpLevel?: number;
  nextState: OrderExecutionDetectorState;
}

export interface OrderExecutionResultPayload {
  type: OrderExecutionType;
  tpLevel?: number;
  orderId?: string;
  symbol: string;
  closedSize: number;
  execPrice: number;
  execQty: string;
  side: string;
  closedSizeStr: string;
}

export function parseOrderExecutionNumber(value: string | undefined): number | null {
  const parsedValue = parseFloat(value ?? '0');
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function detectOrderExecutionType(
  execData: OrderExecutionData,
  closedSize: number,
): OrderExecutionType {
  const isTakeProfit =
    execData.stopOrderType === 'PartialTakeProfit' ||
    (execData.stopOrderType === 'UNKNOWN' &&
      execData.createType === 'CreateByUser' &&
      closedSize > 0);

  if (isTakeProfit) {
    return 'TAKE_PROFIT';
  }

  if (
    execData.stopOrderType === 'StopLoss' ||
    execData.stopOrderType === 'Stop' ||
    execData.stopOrderType === 'PartialStopLoss'
  ) {
    return 'STOP_LOSS';
  }

  if (execData.stopOrderType === 'TrailingStop') {
    return 'TRAILING_STOP';
  }

  return 'ENTRY';
}

export function advanceOrderExecutionState(
  state: OrderExecutionDetectorState,
  type: OrderExecutionType,
): OrderExecutionStateTransition {
  switch (type) {
    case 'TAKE_PROFIT': {
      const tpLevel = state.tpCounter + 1;
      return {
        type,
        tpLevel,
        nextState: {
          tpCounter: tpLevel,
          lastCloseReason: 'TP',
        },
      };
    }
    case 'STOP_LOSS':
      return {
        type,
        nextState: {
          tpCounter: 0,
          lastCloseReason: 'SL',
        },
      };
    case 'TRAILING_STOP':
      return {
        type,
        nextState: {
          tpCounter: 0,
          lastCloseReason: 'TRAILING',
        },
      };
    case 'ENTRY':
    case 'UNKNOWN':
    default:
      return {
        type,
        nextState: {
          tpCounter: 0,
          lastCloseReason: state.lastCloseReason,
        },
      };
  }
}

export function buildOrderExecutionResult(params: {
  execData: OrderExecutionData;
  type: OrderExecutionType;
  tpLevel?: number;
  closedSize: number;
  execPrice: number;
}): OrderExecutionResultPayload {
  const { execData, type, tpLevel, closedSize, execPrice } = params;

  return {
    type,
    tpLevel,
    orderId: execData.orderId,
    symbol: execData.symbol ?? '',
    closedSize,
    execPrice,
    execQty: execData.execQty ?? '0',
    side: execData.side ?? '',
    closedSizeStr: execData.closedSize ?? '',
  };
}

export function createOrderExecutionLogContext(
  execData: OrderExecutionData,
): Record<string, unknown> {
  return {
    orderId: execData.orderId,
    symbol: execData.symbol,
    execType: execData.execType,
    stopOrderType: execData.stopOrderType,
    orderType: execData.orderType,
    createType: execData.createType,
    execPrice: execData.execPrice,
    execQty: execData.execQty,
    closedSize: execData.closedSize,
  };
}
