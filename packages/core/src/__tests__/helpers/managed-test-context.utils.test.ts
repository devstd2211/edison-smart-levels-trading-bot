import {
  cleanupManagedHarnesses,
  cleanupManagedHarnessesAsync,
  createManagedHarnessTracker,
} from './managed-test-context.utils';

describe('managed test context utils', () => {
  test('runs harness reset hooks in LIFO order and clears timers when requested', () => {
    jest.useFakeTimers();
    const cleanupOrder: string[] = [];
    const trackedHarnesses = [
      { id: 'first' },
      { id: 'second' },
    ];
    let timerExecuted = false;

    setTimeout(() => {
      timerExecuted = true;
    }, 100);

    cleanupManagedHarnesses({
      trackedHarnesses,
      clearTimers: true,
      resetHarness: (harness) => {
        cleanupOrder.push(harness.id);
      },
    });

    expect(cleanupOrder).toEqual(['second', 'first']);
    expect(trackedHarnesses).toEqual([]);
    jest.runOnlyPendingTimers();
    expect(timerExecuted).toBe(false);

    jest.useRealTimers();
  });

  test('runs optional post-cleanup hooks before clearing shared mocks', () => {
    const trackedHarnesses = [{ id: 'only' }];
    const sharedMock = jest.fn();
    const hookObservations: string[] = [];

    sharedMock('before-cleanup');

    const afterCleanup = () => {
      hookObservations.push(
        sharedMock.mock.calls.length === 1 ? 'after-before-clear' : 'after-after-clear',
      );
    };

    cleanupManagedHarnesses({
      trackedHarnesses,
      afterCleanup,
    });

    expect(hookObservations).toEqual(['after-before-clear']);
    expect(sharedMock).not.toHaveBeenCalled();
  });

  test('awaits async harness resets before clearing shared mocks', async () => {
    const cleanupOrder: string[] = [];
    const sharedMock = jest.fn();
    const trackedHarnesses = [{ id: 'first' }, { id: 'second' }];

    sharedMock('before-cleanup');

    await cleanupManagedHarnessesAsync({
      trackedHarnesses,
      resetHarness: async (harness) => {
        cleanupOrder.push(`start:${harness.id}`);
        await Promise.resolve();
        cleanupOrder.push(`end:${harness.id}`);
      },
      afterCleanup: async () => {
        cleanupOrder.push(sharedMock.mock.calls.length === 1 ? 'after-before-clear' : 'after-after-clear');
      },
    });

    expect(cleanupOrder).toEqual([
      'start:second',
      'end:second',
      'start:first',
      'end:first',
      'after-before-clear',
    ]);
    expect(sharedMock).not.toHaveBeenCalled();
  });

  test('supports async post-cleanup hooks before clearing shared mocks in the async helper path', async () => {
    const trackedHarnesses = [{ id: 'only' }];
    const sharedMock = jest.fn();
    const hookObservations: string[] = [];

    sharedMock('before-cleanup');

    await cleanupManagedHarnessesAsync({
      trackedHarnesses,
      afterCleanup: async () => {
        await Promise.resolve();
        hookObservations.push(
          sharedMock.mock.calls.length === 1 ? 'after-before-clear' : 'after-after-clear',
        );
      },
    });

    expect(hookObservations).toEqual(['after-before-clear']);
    expect(sharedMock).not.toHaveBeenCalled();
  });

  test('tracks managed harness creation with merged overrides and shared cleanup behavior', () => {
    const resetOrder: string[] = [];
    const tracker = createManagedHarnessTracker({
      baseOptions: { prefix: 'base', suffix: 'value' },
      createHarness: (options: { prefix: string; suffix: string }) => ({
        id: `${options.prefix}:${options.suffix}`,
      }),
      cleanupOptions: {
        resetHarness: (harness) => {
          resetOrder.push(harness.id);
        },
      },
    });

    const first = tracker.createTrackedHarness();
    const second = tracker.createTrackedHarness({ suffix: 'override' });

    expect(first).toEqual({ id: 'base:value' });
    expect(second).toEqual({ id: 'base:override' });

    tracker.cleanup();

    expect(resetOrder).toEqual(['base:override', 'base:value']);
    expect(tracker.trackedHarnesses).toEqual([]);
  });
});
