import { INTEGER_MULTIPLIERS } from '../constants';

export type ShutdownCapableBot = {
  stop(): Promise<void>;
};

export type ClosableServer = {
  close(): void;
};

type ShutdownProcessLike = {
  on(event: string, listener: (...args: unknown[]) => void): void;
};

type ShutdownDependencies = {
  processRef?: ShutdownProcessLike;
  exit?: (code: number) => void;
  delay?: (ms: number) => Promise<void>;
  log?: Pick<typeof console, 'log' | 'error'>;
};

type ShutdownSignalHandlers = {
  onSigint(): void;
  onSigterm(): void;
  onUncaughtException(error: unknown): void;
  onUnhandledRejection(reason: unknown): void;
};

const SHUTDOWN_DELAY_MS = INTEGER_MULTIPLIERS.FIVE_HUNDRED;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function registerGracefulShutdownSignals(
  processRef: ShutdownProcessLike,
  handlers: ShutdownSignalHandlers,
): void {
  processRef.on('SIGINT', () => {
    handlers.onSigint();
  });

  processRef.on('SIGTERM', () => {
    handlers.onSigterm();
  });

  processRef.on('uncaughtException', (...args: unknown[]) => {
    const [error] = args;
    handlers.onUncaughtException(error);
  });

  processRef.on('unhandledRejection', (reason: unknown) => {
    handlers.onUnhandledRejection(reason);
  });
}

export function setupGracefulShutdown(
  bot: ShutdownCapableBot,
  webServer?: ClosableServer | null,
  dependencies: ShutdownDependencies = {},
): void {
  const processRef = dependencies.processRef ?? process;
  const exit = dependencies.exit ?? process.exit.bind(process);
  const delay = dependencies.delay ?? wait;
  const log = dependencies.log ?? console;

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    log.log(`\n[Main] Received ${signal} - shutting down gracefully...`);

    try {
      await bot.stop();
      webServer?.close();
      await delay(SHUTDOWN_DELAY_MS);

      log.log('[Main] Bot stopped successfully');
      exit(0);
    } catch (error) {
      log.error('[Main] Error during shutdown:', error);
      exit(1);
    }
  };

  registerGracefulShutdownSignals(processRef, {
    onSigint: () => {
      void shutdown('SIGINT');
    },
    onSigterm: () => {
      void shutdown('SIGTERM');
    },
    onUncaughtException: (error) => {
      log.error('\n[Main] Uncaught Exception:', error);
      void shutdown('uncaughtException');
    },
    onUnhandledRejection: (reason) => {
      log.error('\n[Main] Unhandled Promise Rejection:', reason);
      void shutdown('unhandledRejection');
    },
  });
}
