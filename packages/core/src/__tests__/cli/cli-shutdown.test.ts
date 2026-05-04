import { setupGracefulShutdown } from '../../cli/cli-shutdown';

describe('cli graceful shutdown', () => {
  test('awaits bot shutdown before closing the web server and exiting', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processRef = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    let resolveStop: (() => void) | undefined;
    const stop = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        }),
    );
    const close = jest.fn();
    const exit = jest.fn();
    const delay = jest.fn().mockResolvedValue(undefined);

    setupGracefulShutdown(
      { stop },
      { close },
      { processRef, exit, delay, log: { log: jest.fn(), error: jest.fn() } },
    );

    listeners.get('SIGINT')?.();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    resolveStop?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('exits with code 1 when bot shutdown throws', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processRef = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    const exit = jest.fn();
    const log = { log: jest.fn(), error: jest.fn() };

    setupGracefulShutdown(
      { stop: jest.fn().mockRejectedValue(new Error('stop failed')) },
      null,
      { processRef, exit, delay: jest.fn().mockResolvedValue(undefined), log },
    );

    listeners.get('SIGTERM')?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(log.error).toHaveBeenCalledWith('[Main] Error during shutdown:', expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
