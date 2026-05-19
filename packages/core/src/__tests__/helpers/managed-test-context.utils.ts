export type ManagedHarnessCleanupOptions<THarness> = {
  trackedHarnesses: THarness[];
  clearTimers?: boolean;
  resetHarness?: (harness: THarness) => void;
  afterCleanup?: () => void;
};

function finalizeManagedHarnessCleanup(
  clearTimers: boolean,
  afterCleanup?: () => void | Promise<void>,
): void | Promise<void> {
  const finishCleanup = () => {
    jest.clearAllMocks();

    if (clearTimers) {
      jest.clearAllTimers();
    }
  };

  if (!afterCleanup) {
    finishCleanup();
    return;
  }

  const cleanupResult = afterCleanup();
  if (cleanupResult instanceof Promise) {
    return cleanupResult.then(() => {
      finishCleanup();
    });
  }

  finishCleanup();
}

export function cleanupManagedHarnesses<THarness>({
  trackedHarnesses,
  clearTimers = false,
  resetHarness,
  afterCleanup,
}: ManagedHarnessCleanupOptions<THarness>): void {
  while (trackedHarnesses.length > 0) {
    const harness = trackedHarnesses.pop();
    if (!harness) {
      continue;
    }
    resetHarness?.(harness);
  }

  finalizeManagedHarnessCleanup(clearTimers, afterCleanup);
}

export type ManagedHarnessAsyncCleanupOptions<THarness> = {
  trackedHarnesses: THarness[];
  clearTimers?: boolean;
  resetHarness?: (harness: THarness) => Promise<void> | void;
  afterCleanup?: () => Promise<void> | void;
};

export async function cleanupManagedHarnessesAsync<THarness>({
  trackedHarnesses,
  clearTimers = false,
  resetHarness,
  afterCleanup,
}: ManagedHarnessAsyncCleanupOptions<THarness>): Promise<void> {
  while (trackedHarnesses.length > 0) {
    const harness = trackedHarnesses.pop();
    if (!harness) {
      continue;
    }
    await resetHarness?.(harness);
  }

  await finalizeManagedHarnessCleanup(clearTimers, afterCleanup);
}
