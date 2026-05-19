import { cleanupManagedHarnesses } from './managed-test-context.utils';

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
});
