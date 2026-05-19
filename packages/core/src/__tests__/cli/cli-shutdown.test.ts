import { registerGracefulShutdownSignals, setupGracefulShutdown } from '../../cli/cli-shutdown';

describe('cli graceful shutdown', () => {
  test('registerGracefulShutdownSignals wires each process event to the provided handler', () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processRef = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    const handlers = {
      onSigint: jest.fn(),
      onSigterm: jest.fn(),
      onUncaughtException: jest.fn(),
      onUnhandledRejection: jest.fn(),
    };

    registerGracefulShutdownSignals(processRef, handlers);

    const uncaught = new Error('uncaught');
    const rejection = new Error('rejection');
    listeners.get('SIGINT')?.();
    listeners.get('SIGTERM')?.();
    listeners.get('uncaughtException')?.(uncaught);
    listeners.get('unhandledRejection')?.(rejection);

    expect(handlers.onSigint).toHaveBeenCalledTimes(1);
    expect(handlers.onSigterm).toHaveBeenCalledTimes(1);
    expect(handlers.onUncaughtException).toHaveBeenCalledWith(uncaught);
    expect(handlers.onUnhandledRejection).toHaveBeenCalledWith(rejection);
  });

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

  test('forwards uncaught errors through the shared shutdown signal helper before stopping', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processRef = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    const exit = jest.fn();
    const log = { log: jest.fn(), error: jest.fn() };

    setupGracefulShutdown(
      { stop: jest.fn().mockResolvedValue(undefined) },
      null,
      { processRef, exit, delay: jest.fn().mockResolvedValue(undefined), log },
    );

    listeners.get('uncaughtException')?.(new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    expect(log.error).toHaveBeenCalledWith('\n[Main] Uncaught Exception:', expect.any(Error));
    expect(exit).toHaveBeenCalledWith(0);
  });
});
