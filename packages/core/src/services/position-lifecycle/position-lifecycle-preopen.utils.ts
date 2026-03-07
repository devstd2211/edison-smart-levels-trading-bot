export function resolveCurrentPriceWithFallback(
  success: boolean,
  value: number | undefined,
  signalPrice: number,
): number {
  return success && value !== undefined
    ? value
    : signalPrice;
}

export function shouldLogHangingOrderCancellationSkipped(success: boolean): boolean {
  return !success;
}

export function buildRetryLogPayload(
  delayMs: number,
  errorMessage: string,
): { delayMs: number; error: string } {
  return {
    delayMs,
    error: errorMessage,
  };
}

export function buildCurrentPriceFallbackLogPayload(
  signalPrice: number,
): { signalPrice: number } {
  return { signalPrice };
}

export function buildHangingOrderCancellationSkippedLogPayload(
  errorMessage?: string,
): { error?: string } {
  return { error: errorMessage };
}

export function buildHangingOrderCancellationStartLogMessage(): string {
  return 'Cancelling any hanging conditional orders before opening...';
}

export function buildHangingOrderCancellationFailedLogPayload(
  errorMessage: string,
): { error: string } {
  return { error: errorMessage };
}

export function buildHangingOrderCancellationNonBlockingFailureLogPayload(): { note: string } {
  return { note: 'Continuing with position opening' };
}
