import {
  createManagedTrackedServicesContext,
  createMinimalLifecycleConfig,
  silenceTrackedLifecycleLogger,
  withQuietLifecycleLogging,
} from './service-lifecycle-test.utils';

describe('service lifecycle test utils', () => {
  test('silenceTrackedLifecycleLogger mutes logger methods temporarily and restores them afterwards', () => {
    let debugCalls = 0;
    let infoCalls = 0;
    let warnCalls = 0;
    let errorCalls = 0;
    const debug = (_message?: unknown) => {
      debugCalls += 1;
    };
    const info = (_message?: unknown) => {
      infoCalls += 1;
    };
    const warn = (_message?: unknown) => {
      warnCalls += 1;
    };
    const error = (_message?: unknown) => {
      errorCalls += 1;
    };
    const logger = { debug, info, warn, error };

    const restore = silenceTrackedLifecycleLogger(logger);

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(debugCalls).toBe(0);
    expect(infoCalls).toBe(0);
    expect(warnCalls).toBe(0);
    expect(errorCalls).toBe(0);

    restore();

    logger.info('restored');
    expect(infoCalls).toBe(1);
  });

  test('createMinimalLifecycleConfig keeps lifecycle harness logging quiet by default', () => {
    expect(createMinimalLifecycleConfig().logging.level).toBe('error');
  });

  test('withQuietLifecycleLogging forces the shared quiet logging config for lifecycle harnesses', () => {
    const config = withQuietLifecycleLogging({
      ...createMinimalLifecycleConfig(),
      logging: {
        level: 'info',
        logDir: './custom-logs',
        logToFile: true,
      },
    } as unknown as ReturnType<typeof createMinimalLifecycleConfig>);

    expect(config.logging).toEqual({
      level: 'error',
      logDir: './logs',
      logToFile: false,
    });
  });

  test('tracked runtime harness forces quiet logging even when callers pass a noisy config', () => {
    const context = createManagedTrackedServicesContext();
    const harness = context.createRuntimeBundleHarness({
      config: {
        ...createMinimalLifecycleConfig(),
        logging: {
          level: 'debug',
          logDir: './debug-logs',
          logToFile: true,
        },
      } as unknown as ReturnType<typeof createMinimalLifecycleConfig>,
    });

    expect(harness.config.logging).toEqual({
      level: 'error',
      logDir: './logs',
      logToFile: false,
    });
  });
});
