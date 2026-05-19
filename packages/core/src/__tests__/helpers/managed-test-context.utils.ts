export type ManagedHarnessCleanupOptions<THarness> = {
  trackedHarnesses: THarness[];
  clearTimers?: boolean;
  resetHarness?: (harness: THarness) => void;
  afterCleanup?: () => void;
};

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

  afterCleanup?.();
  jest.clearAllMocks();

  if (clearTimers) {
    jest.clearAllTimers();
  }
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

  await afterCleanup?.();
  jest.clearAllMocks();

  if (clearTimers) {
    jest.clearAllTimers();
  }
}
