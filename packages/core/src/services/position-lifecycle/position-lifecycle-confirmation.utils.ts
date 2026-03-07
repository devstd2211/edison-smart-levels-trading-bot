import { SignalDirection } from '../../types/legacy';

type PendingSignalConfirmedLogPayload = {
  pendingId: string;
  direction: SignalDirection;
  supportLevel?: string;
  resistanceLevel?: string;
  candleClose: string;
};

type PendingSignalRejectedLogPayload = {
  pendingId: string;
  supportLevel?: string;
  resistanceLevel?: string;
  candleClose: string;
};

export type PendingRejectionDescriptor = {
  message: string;
  levelKey: 'supportLevel' | 'resistanceLevel';
};

export function formatPriceForConfirmationLog(value: number, priceDecimals: number): string {
  return value.toFixed(priceDecimals);
}

export function buildPendingSignalConfirmedLogPayload(
  pendingId: string,
  direction: SignalDirection,
  keyLevel: number,
  candleClose: number,
  priceDecimals: number,
): PendingSignalConfirmedLogPayload {
  const levelValue = formatPriceForConfirmationLog(keyLevel, priceDecimals);
  const candleCloseValue = formatPriceForConfirmationLog(candleClose, priceDecimals);

  if (direction === SignalDirection.LONG) {
    return {
      pendingId,
      direction,
      supportLevel: levelValue,
      candleClose: candleCloseValue,
    };
  }

  return {
    pendingId,
    direction,
    resistanceLevel: levelValue,
    candleClose: candleCloseValue,
  };
}

export function buildPendingSignalRejectedLogPayload(
  levelKey: 'supportLevel' | 'resistanceLevel',
  pendingId: string,
  level: number,
  candleClose: number,
  priceDecimals: number,
): PendingSignalRejectedLogPayload {
  const levelValue = formatPriceForConfirmationLog(level, priceDecimals);
  const candleCloseValue = formatPriceForConfirmationLog(candleClose, priceDecimals);

  if (levelKey === 'supportLevel') {
    return {
      pendingId,
      supportLevel: levelValue,
      candleClose: candleCloseValue,
    };
  }

  return {
    pendingId,
    resistanceLevel: levelValue,
    candleClose: candleCloseValue,
  };
}

export function buildPendingSignalConfirmedLogMessage(direction: SignalDirection): string {
  return `${direction} signal confirmed - ready to enter`;
}

export function buildPendingLongRejectedLogMessage(): string {
  return 'LONG signal rejected - falling knife avoided';
}

export function buildPendingShortRejectedLogMessage(): string {
  return 'SHORT signal rejected - pump continues';
}

export function buildPendingRejectionDescriptor(
  direction: SignalDirection.LONG | SignalDirection.SHORT,
): PendingRejectionDescriptor {
  if (direction === SignalDirection.LONG) {
    return {
      message: buildPendingLongRejectedLogMessage(),
      levelKey: 'supportLevel',
    };
  }

  return {
    message: buildPendingShortRejectedLogMessage(),
    levelKey: 'resistanceLevel',
  };
}

export function resolvePendingRejectionDirection(
  direction: SignalDirection,
  reason: string,
): SignalDirection.LONG | SignalDirection.SHORT | null {
  if (direction === SignalDirection.LONG && reason.includes('below support')) {
    return SignalDirection.LONG;
  }

  if (direction === SignalDirection.SHORT && reason.includes('above resistance')) {
    return SignalDirection.SHORT;
  }

  return null;
}
