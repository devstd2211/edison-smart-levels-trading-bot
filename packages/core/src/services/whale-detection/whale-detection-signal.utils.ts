export function createNoWhaleSignal(reason: string = ''): {
  detected: false;
  mode: null;
  direction: null;
  confidence: number;
  reason: string;
  metadata: Record<string, never>;
} {
  return {
    detected: false,
    mode: null,
    direction: null,
    confidence: 0,
    reason,
    metadata: {},
  };
}

export function createDetectionFailedSignal(): {
  detected: false;
  mode: null;
  direction: null;
  confidence: number;
  reason: string;
  metadata: Record<string, never>;
} {
  return createNoWhaleSignal('Whale detection failed');
}

export function createWallBreakKey(side: 'BID' | 'ASK', price: number, priceDecimals: number): string {
  return `${side}_${price.toFixed(priceDecimals)}`;
}
