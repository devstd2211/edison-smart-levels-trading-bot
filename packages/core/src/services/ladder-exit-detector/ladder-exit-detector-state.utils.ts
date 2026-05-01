import {
  BybitOrder,
  Position,
  PositionSide,
  SignalDirection,
} from '../../types/legacy';

export function getPositionDirection(position: Position): SignalDirection {
  return position.side === PositionSide.LONG
    ? SignalDirection.LONG
    : SignalDirection.SHORT;
}

export function isTpLevelHit(
  targetPrice: number,
  currentPrice: number,
  direction: SignalDirection,
): boolean {
  const tolerance = targetPrice * 0.0005;

  return direction === SignalDirection.LONG
    ? currentPrice >= targetPrice - tolerance
    : currentPrice <= targetPrice + tolerance;
}

export function detectLadderHitLevel(
  position: Position,
  currentPrice: number,
): number | undefined {
  if (!position.takeProfits?.length) {
    return undefined;
  }

  const direction = getPositionDirection(position);
  for (let index = position.takeProfits.length - 1; index >= 0; index -= 1) {
    if (isTpLevelHit(position.takeProfits[index].price, currentPrice, direction)) {
      return index + 1;
    }
  }

  return undefined;
}

export function identifyClosestTpLevel(
  executionPrice: number,
  position: Position,
): number {
  if (!position.takeProfits?.length) {
    return 1;
  }

  let closestLevel = 1;
  let minDifference = Math.abs(executionPrice - position.takeProfits[0].price);

  for (let index = 1; index < position.takeProfits.length; index += 1) {
    const difference = Math.abs(executionPrice - position.takeProfits[index].price);
    if (difference < minDifference) {
      minDifference = difference;
      closestLevel = index + 1;
    }
  }

  return closestLevel;
}

export function isBybitOrder(value: unknown): value is BybitOrder {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const order = value as Record<string, unknown>;
  return typeof order.orderId === 'string'
    && typeof order.orderType === 'string'
    && typeof order.side === 'string'
    && typeof order.price === 'string'
    && typeof order.reduceOnly === 'boolean';
}

export function toBybitOrders(value: unknown): BybitOrder[] {
  return Array.isArray(value) ? value.filter(isBybitOrder) : [];
}

export function getUpdatedTime(order: BybitOrder): number {
  return typeof order.updatedTime === 'number' ? order.updatedTime : 0;
}

export function getFilledReduceOnlyOrders(
  orders: BybitOrder[],
  position: Position,
): BybitOrder[] {
  return orders
    .filter(
      (order) =>
        order.symbol === position.symbol
        && order.orderStatus === 'Filled'
        && order.reduceOnly,
    )
    .sort((left, right) => getUpdatedTime(left) - getUpdatedTime(right));
}
