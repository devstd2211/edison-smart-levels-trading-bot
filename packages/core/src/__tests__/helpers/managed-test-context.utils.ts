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
