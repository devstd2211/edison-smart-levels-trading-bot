export type ManagedHarnessCleanupOptions<THarness> = {
  trackedHarnesses: THarness[];
  clearTimers?: boolean;
  resetHarness?: (harness: THarness) => void;
  afterCleanup?: () => void;
};

export type ManagedHarnessTrackerOptions<THarness, TOptions extends object> = {
  baseOptions?: TOptions;
  createHarness: (options: TOptions) => THarness;
  cleanupOptions?: Omit<ManagedHarnessCleanupOptions<THarness>, 'trackedHarnesses'>;
};

export type ManagedHarnessTracker<THarness, TOptions extends object> = {
  trackedHarnesses: THarness[];
  createTrackedHarness: (overrides?: Partial<TOptions>) => THarness;
  trackHarness: (harness: THarness) => THarness;
  cleanup: () => void;
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

export function createManagedHarnessTracker<THarness, TOptions extends object = Record<string, never>>({
  baseOptions,
  createHarness,
  cleanupOptions,
}: ManagedHarnessTrackerOptions<THarness, TOptions>): ManagedHarnessTracker<THarness, TOptions> {
  const trackedHarnesses: THarness[] = [];
  const resolvedBaseOptions = (baseOptions ?? {}) as TOptions;

  return {
    trackedHarnesses,
    createTrackedHarness: (overrides = {}) => {
      const harness = createHarness({
        ...resolvedBaseOptions,
        ...overrides,
      } as TOptions);
      trackedHarnesses.push(harness);
      return harness;
    },
    trackHarness: (harness) => {
      trackedHarnesses.push(harness);
      return harness;
    },
    cleanup: () => {
      cleanupManagedHarnesses({
        trackedHarnesses,
        ...cleanupOptions,
      });
    },
  };
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
