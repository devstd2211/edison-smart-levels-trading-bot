export function assertRequiredOrderId(methodName: string, orderId: string): void {
  if (!orderId) {
    throw new Error(`SmartOrderExecutionService.${methodName}: orderId is required`);
  }
}

export function assertNonNegativeFilledSize(
  methodName: string,
  filledSize: number
): void {
  if (filledSize == null || filledSize < 0 || isNaN(filledSize)) {
    throw new Error(`SmartOrderExecutionService.${methodName}: filledSize must be >= 0`);
  }
}

export function assertPositiveFiniteNumber(
  methodName: string,
  fieldName: string,
  value: number
): void {
  if (value == null || value <= 0 || isNaN(value)) {
    throw new Error(`SmartOrderExecutionService.${methodName}: ${fieldName} must be > 0`);
  }
}

export function assertValidOrderSide(
  methodName: string,
  side: string
): void {
  if (!side || (side !== 'Buy' && side !== 'Sell')) {
    throw new Error(`SmartOrderExecutionService.${methodName}: valid side is required`);
  }
}
