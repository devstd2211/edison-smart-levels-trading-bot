import { INTEGER_MULTIPLIERS } from '../../constants';
import type { OrderExecutionResult } from '../order-execution-detector.service';
import type { OrderExecutionData, OrderUpdateData, PositionData } from '../../types/legacy';

export type PrivateWebSocketMessage = {
  success?: boolean;
  op?: string;
  topic?: string;
  data?: unknown;
};

export type PrivateWebSocketEventName =
  | 'orderFilled'
  | 'positionClosed'
  | 'positionUpdate'
  | 'stopLossFilled'
  | 'takeProfitFilled';

export type PrivateWebSocketEventPayload = {
  orderId?: string;
  symbol: string;
  side?: string;
  avgPrice?: string;
  qty?: string;
  cumExecQty?: string;
  execQty?: string;
  execPrice?: string;
};

function isNonNullableRecord<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizePrivateWebSocketRecords<T>(data: T | T[] | null | undefined): T[] {
  if (data === null || data === undefined) {
    return [];
  }

  return (Array.isArray(data) ? data : [data]).filter(isNonNullableRecord);
}

export function parsePrivateWebSocketMessage(data: string): PrivateWebSocketMessage {
  return JSON.parse(data) as PrivateWebSocketMessage;
}

export function isAuthSuccessMessage(message: PrivateWebSocketMessage): boolean {
  return message.op === 'auth' && message.success === true;
}

export function isSubscriptionAckMessage(message: PrivateWebSocketMessage): boolean {
  return message.op === 'subscribe';
}

export function isPongMessage(message: PrivateWebSocketMessage): boolean {
  return message.op === 'pong';
}

export function hasMessageTopicData(
  message: PrivateWebSocketMessage,
): message is PrivateWebSocketMessage & { data: unknown; topic: string } {
  return typeof message.topic === 'string' && message.data !== undefined && message.data !== null;
}

export function normalizePositionUpdates(data: PositionData | PositionData[]): PositionData[] {
  return normalizePrivateWebSocketRecords(data);
}

export function normalizeOrderExecutions(
  data: OrderExecutionData | OrderExecutionData[],
): OrderExecutionData[] {
  return normalizePrivateWebSocketRecords(data);
}

export function normalizeOrderUpdates(data: OrderUpdateData | OrderUpdateData[]): OrderUpdateData[] {
  return normalizePrivateWebSocketRecords(data);
}

export function matchesTrackedSymbol(messageSymbol: string | undefined, trackedSymbol: string): boolean {
  return messageSymbol === trackedSymbol;
}

export function isClosedPositionSize(size: string | undefined): boolean {
  return parseFloat(size ?? '0') === INTEGER_MULTIPLIERS.ZERO;
}

export function buildExecutionEventKey(
  type: 'SL' | 'TP' | 'TRAILING',
  result: Pick<OrderExecutionResult, 'orderId' | 'execPrice' | 'closedSize'>,
): string {
  if (type === 'TP') {
    return `${result.orderId ?? 'unknown'}_${result.execPrice ?? '0'}_${result.closedSize}`;
  }

  return `${result.orderId ?? 'unknown'}_${result.execPrice ?? '0'}`;
}

export function mapExecutionResultToEvent(
  result: OrderExecutionResult,
  symbol: string,
): { eventName: PrivateWebSocketEventName; payload: PrivateWebSocketEventPayload } | null {
  switch (result.type) {
    case 'TAKE_PROFIT':
      return {
        eventName: 'takeProfitFilled',
        payload: {
          orderId: result.orderId ?? '',
          symbol,
          side: result.side,
          avgPrice: result.execPrice.toString(),
          qty: result.execQty,
          cumExecQty: result.closedSizeStr ?? result.execQty,
        },
      };

    case 'STOP_LOSS':
    case 'TRAILING_STOP':
      return {
        eventName: 'stopLossFilled',
        payload: {
          orderId: result.orderId ?? '',
          symbol,
          side: result.side,
          avgPrice: result.execPrice.toString(),
          qty: result.execQty,
          cumExecQty: result.closedSizeStr ?? result.execQty,
        },
      };

    case 'ENTRY':
      return {
        eventName: 'orderFilled',
        payload: {
          orderId: result.orderId ?? '',
          symbol,
          side: result.side,
          execQty: result.execQty,
          execPrice: result.execPrice.toString(),
        },
      };

    default:
      return null;
  }
}

export function mapOrderUpdateToEvent(
  orderData: OrderUpdateData,
  symbol: string,
): { eventName: 'stopLossFilled' | 'takeProfitFilled'; payload: PrivateWebSocketEventPayload } | null {
  if (orderData.orderStatus !== 'Filled') {
    return null;
  }

  if (orderData.stopOrderType === 'TakeProfit') {
    return {
      eventName: 'takeProfitFilled',
      payload: {
        orderId: orderData.orderId ?? '',
        symbol,
        side: orderData.side ?? '',
        avgPrice: orderData.avgPrice ?? '0',
        qty: orderData.qty ?? '0',
        cumExecQty: orderData.cumExecQty ?? '0',
      },
    };
  }

  if (orderData.stopOrderType === 'StopLoss') {
    return {
      eventName: 'stopLossFilled',
      payload: {
        orderId: orderData.orderId ?? '',
        symbol,
        side: orderData.side ?? '',
        avgPrice: orderData.avgPrice ?? '0',
        qty: orderData.qty ?? '0',
        cumExecQty: orderData.cumExecQty ?? '0',
      },
    };
  }

  return null;
}
