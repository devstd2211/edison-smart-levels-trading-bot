import {
  createCandleEnabledLifecycleConfig,
  createDashboardTimeframeLifecycleConfig,
  createDashboardEnabledLifecycleConfig,
  createLegacyEntrypointCandleRuntimeConfig,
  createManagedTrackedServicesRuntimeFactory,
  createManagedTrackedServicesBotRuntime,
  createManagedTrackedServicesInitializerRuntime,
  createManagedTrackedServicesRuntimeBundleRuntime,
  createManagedTrackedServicesState,
  createLegacyPreRuntimeDefaultsConfig,
  createMinimalLifecycleConfig,
  createRuntimeDefaultLifecycleConfig,
  createTimeframeNotificationLifecycleConfig,
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

  test('createRuntimeDefaultLifecycleConfig keeps the shared runtime-default fixture aligned with the minimal lifecycle defaults', () => {
    expect(createRuntimeDefaultLifecycleConfig()).toEqual(createMinimalLifecycleConfig());
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

  test('createCandleEnabledLifecycleConfig enables candle subscriptions without widening the quiet lifecycle fixture', () => {
    const config = createCandleEnabledLifecycleConfig();

    expect(config.dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
    expect(config.dataSubscriptions?.orderbook).toEqual({
      enabled: true,
      updateIntervalMs: 100,
    });
    expect(config.dataSubscriptions?.ticks).toEqual({
      enabled: true,
      calculateDelta: true,
    });
  });

  test('createDashboardEnabledLifecycleConfig enables dashboard mode on the shared quiet lifecycle fixture', () => {
    expect((createDashboardEnabledLifecycleConfig() as { dashboard?: { enabled?: boolean } }).dashboard).toEqual({
      enabled: true,
    });
  });

  test('createTimeframeNotificationLifecycleConfig disables the context timeframe without changing enabled labels', () => {
    expect(createTimeframeNotificationLifecycleConfig().timeframes).toEqual({
      entry: { interval: '1', candleLimit: 1000, enabled: true },
      primary: { interval: '5', candleLimit: 500, enabled: true },
      context: { interval: '15', candleLimit: 250, enabled: false },
    });
  });

  test('createDashboardTimeframeLifecycleConfig combines dashboard mode with the narrowed timeframe fixture', () => {
    const config = createDashboardTimeframeLifecycleConfig() as {
      dashboard?: { enabled?: boolean };
      timeframes?: Record<string, unknown>;
    };

    expect(config.dashboard).toEqual({ enabled: true });
    expect(config.timeframes).toEqual({
      entry: { interval: '1', candleLimit: 1000, enabled: true },
      primary: { interval: '5', candleLimit: 500, enabled: true },
      context: { interval: '15', candleLimit: 250, enabled: false },
    });
  });

  test('createLegacyEntrypointCandleRuntimeConfig reuses the candle-enabled runtime fixture for wrapper-level runtime coverage', () => {
    expect(createLegacyEntrypointCandleRuntimeConfig().dataSubscriptions?.candles).toEqual({
      enabled: true,
      calculateIndicators: false,
    });
  });

  test('createLegacyPreRuntimeDefaultsConfig leaves runtime-default fields absent while keeping legacy toggles explicit', () => {
    const config = createLegacyPreRuntimeDefaultsConfig();

    expect(config.dataSubscriptions).toBeUndefined();
    expect(config.webApi).toBeUndefined();
    expect(config.orderBook).toEqual({ enabled: true });
    expect(config.delta).toEqual({ enabled: true });
  });

  test('tracked runtime bundle harness forces quiet logging even when callers pass a noisy config', async () => {
    const runtime = createManagedTrackedServicesRuntimeBundleRuntime();
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

  test('createManagedTrackedServicesRuntimeBundleRuntime exposes only runtime bundle harness creation plus cleanup', async () => {
    const runtime = createManagedTrackedServicesRuntimeBundleRuntime();

    expect(typeof runtime.createRuntimeBundleHarness).toBe('function');
    expect(typeof runtime.cleanup).toBe('function');
    expect('createInitializerHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createTradingBotHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);
    expect('createRuntimeFactoryHarness' in (runtime as unknown as Record<string, unknown>)).toBe(false);

    await expect(runtime.cleanup()).resolves.toBeUndefined();
  });

  test('normalizeTrackedLifecycleConfig preserves legacy pre-runtime-default gaps for loader-level coverage', () => {
    const config = normalizeTrackedLifecycleConfig(createLegacyPreRuntimeDefaultsConfig());

    expect(config.dataSubscriptions).toBeUndefined();
    expect(config.webApi).toBeUndefined();
    expect(config.orderBook).toEqual({ enabled: true });
    expect(config.delta).toEqual({ enabled: true });
  });

  test('runtime bundle harness exposes only bundle-level runtime state for runtime-enabled fixtures', async () => {
    const runtime = createManagedTrackedServicesRuntimeBundleRuntime();

    try {
      const harness = runtime.createRuntimeBundleHarness({
        config: createLegacyEntrypointCandleRuntimeConfig(),
      });

      expect(harness.runtimeBundle.runtimeDependencies).toBe(harness.runtimeDependencies);
      expect('bot' in (harness as unknown as Record<string, unknown>)).toBe(false);
      expect('runtime' in (harness as unknown as Record<string, unknown>)).toBe(false);
    } finally {
      await runtime.cleanup();
    }
  });

  test('createManagedTrackedServicesRuntimeFactory exposes only runtime-factory trading-bot harness creation plus cleanup', async () => {
    const runtime = createManagedTrackedServicesRuntimeFactory();

    expect(typeof runtime.createRuntimeFactoryHarness).toBe('function');
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

