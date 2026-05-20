import {
  createManagedTrackedServicesFactoryRuntime,
  createManagedTrackedServicesAdapterRuntime,
  createManagedTrackedServicesBotRuntime,
  createManagedTrackedServicesInitializerRuntime,
  createManagedTrackedServicesState,
  createMinimalLifecycleConfig,
  normalizeTrackedLifecycleConfig,
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

  test('normalizeTrackedLifecycleConfig keeps tracked runtime helpers on the shared quiet logging shape', () => {
    const normalized = normalizeTrackedLifecycleConfig({
      ...createMinimalLifecycleConfig(),
      logging: {
        level: 'debug',
        logDir: './noisy-logs',
        logToFile: true,
      },
    } as unknown as ReturnType<typeof createMinimalLifecycleConfig>);

    expect(normalized.logging).toEqual({
      level: 'error',
      logDir: './logs',
      logToFile: false,
    });
  });

  test('tracked runtime harness forces quiet logging even when callers pass a noisy config', async () => {
    const runtime = createManagedTrackedServicesAdapterRuntime();
    try {
      const harness = runtime.createRuntimeBundleHarness({
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
    } finally {
      await runtime.cleanup();
    }
  });

  test('createManagedTrackedServicesState exposes the narrow tracked-services state shape', async () => {
    const state = createManagedTrackedServicesState();

    expect(Array.isArray(state.trackedServices)).toBe(true);
    expect(typeof state.cleanup).toBe('function');

    await expect(state.cleanup()).resolves.toBeUndefined();
  });

  test('createManagedTrackedServicesInitializerRuntime exposes only initializer harness creation plus cleanup', async () => {
    const runtime = createManagedTrackedServicesInitializerRuntime();

    expect(typeof runtime.createInitializerHarness).toBe('function');
    expect(typeof runtime.cleanup).toBe('function');
    expect('createTradingBotHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createRuntimeBundleHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);

    await expect(runtime.cleanup()).resolves.toBeUndefined();
  });

  test('createManagedTrackedServicesFactoryRuntime exposes only factory trading-bot runtime creation plus cleanup', async () => {
    const runtime = createManagedTrackedServicesFactoryRuntime();

    expect(typeof runtime.createFactoryTradingBotRuntimeHarness).toBe('function');
    expect(typeof runtime.cleanup).toBe('function');
    expect('createInitializerHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createTradingBotHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createRuntimeBundleHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);

    await expect(runtime.cleanup()).resolves.toBeUndefined();
  });

  test('createManagedTrackedServicesBotRuntime exposes only trading-bot harness creation plus cleanup', async () => {
    const runtime = createManagedTrackedServicesBotRuntime();

    expect(typeof runtime.createTradingBotHarness).toBe('function');
    expect(typeof runtime.cleanup).toBe('function');
    expect('createInitializerHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createRuntimeBundleHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);

    await expect(runtime.cleanup()).resolves.toBeUndefined();
  });
});
