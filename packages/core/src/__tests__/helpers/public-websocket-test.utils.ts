import { ErrorHandler } from '../../errors/ErrorHandler';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import { PublicWebSocketService } from '../../services/public-websocket.service';
import type { ExchangeConfig, LoggerService, TimeframeRole } from '../../types/legacy';

export type PublicWebSocketLoggerMock = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  setContext: jest.Mock;
};

export type PublicWebSocketErrorHandlerMock = {
  handle: jest.Mock;
  classify: jest.Mock;
  getLogger: jest.Mock;
};

export type PublicWebSocketHarness = {
  service: PublicWebSocketService;
  mockLogger: PublicWebSocketLoggerMock;
  loggerService: LoggerService;
  mockTimeframeProvider: TimeframeProvider;
  mockConfig: ExchangeConfig;
  errorHandler: PublicWebSocketErrorHandlerMock;
  errorHandlerService: ErrorHandler;
  createStandardService: (overrides?: {
    symbol?: string;
    withErrorHandler?: boolean;
    btcConfirmation?: {
      enabled?: boolean;
      timeframe?: string;
      symbol?: string;
      lookbackCandles?: number;
    };
  }) => PublicWebSocketService;
  createService: (
    overrides?: Partial<
      Omit<PublicWebSocketServiceOptions, 'mockConfig' | 'mockTimeframeProvider' | 'loggerService'>
    > & { withErrorHandler?: boolean },
  ) => PublicWebSocketService;
  createLegacyService: (overrides?: {
    symbol?: string;
    btcConfirmation?: {
      enabled?: boolean;
      timeframe?: string;
      symbol?: string;
      lookbackCandles?: number;
    };
  }) => PublicWebSocketService;
  createBtcConfiguredService: (overrides?: {
    symbol?: string;
    withErrorHandler?: boolean;
    btcConfirmation?: {
      enabled?: boolean;
      timeframe?: string;
      symbol?: string;
      lookbackCandles?: number;
    };
  }) => PublicWebSocketService;
  createInjectedService: (
    overrides?: Partial<PublicWebSocketServiceOptions>,
  ) => PublicWebSocketService;
};

export type ManagedPublicWebSocketContext = PublicWebSocketHarness & {
  cleanup: () => void;
};

export type PublicWebSocketSharedState = Pick<
  ManagedPublicWebSocketContext,
  | 'service'
  | 'mockLogger'
  | 'mockConfig'
  | 'mockTimeframeProvider'
  | 'loggerService'
  | 'errorHandler'
  | 'errorHandlerService'
  | 'cleanup'
>;

export type PublicWebSocketFactoryState = Pick<
  ManagedPublicWebSocketContext,
  | 'createService'
  | 'createStandardService'
  | 'createLegacyService'
  | 'createBtcConfiguredService'
  | 'createInjectedService'
>;

export type PublicWebSocketRuntimeState = PublicWebSocketSharedState;

export type PublicWebSocketFactories = PublicWebSocketFactoryState;

export type PublicWebSocketErrorHandlingState = Pick<
  ManagedPublicWebSocketContext,
  | 'service'
  | 'mockLogger'
  | 'mockConfig'
  | 'mockTimeframeProvider'
  | 'loggerService'
  | 'errorHandler'
  | 'errorHandlerService'
  | 'createService'
  | 'createStandardService'
  | 'createLegacyService'
  | 'createBtcConfiguredService'
  | 'createInjectedService'
  | 'cleanup'
>;

export type PublicWebSocketServiceOptions = {
  mockConfig: ExchangeConfig;
  symbol?: string;
  mockTimeframeProvider: TimeframeProvider;
  loggerService: LoggerService;
  errorHandlerService?: ErrorHandler;
  btcConfirmation?: {
    enabled?: boolean;
    timeframe?: string;
    symbol?: string;
    lookbackCandles?: number;
  };
};

export function createMockPublicWebSocketLogger(): PublicWebSocketLoggerMock {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  };
}

export function createMockPublicWebSocketTimeframeProvider(): TimeframeProvider {
  return {
    getAllTimeframes: jest.fn().mockReturnValue(
      new Map([
        ['TIMEFRAME_1M' as TimeframeRole, { interval: '1', durationSeconds: 60 }],
        ['TIMEFRAME_5M' as TimeframeRole, { interval: '5', durationSeconds: 300 }],
        ['TIMEFRAME_15M' as TimeframeRole, { interval: '15', durationSeconds: 900 }],
      ]),
    ),
  } as unknown as TimeframeProvider;
}

export function createMockPublicWebSocketConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return {
    name: 'bybit',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    symbol: 'XRPUSDT',
    timeframe: '1m',
    testnet: false,
    demo: false,
    ...overrides,
  };
}

export function createMockPublicWebSocketErrorHandler(
  mockLogger: PublicWebSocketLoggerMock,
): PublicWebSocketErrorHandlerMock {
  return {
    handle: jest.fn(),
    classify: jest.fn(),
    getLogger: jest.fn().mockReturnValue(mockLogger),
  };
}

export function createPublicWebSocketErrorHandlerService(
  mockLogger: PublicWebSocketLoggerMock = createMockPublicWebSocketLogger(),
): ErrorHandler {
  return createMockPublicWebSocketErrorHandler(mockLogger) as unknown as ErrorHandler;
}

export function createPublicWebSocketBtcConfirmationConfig(overrides: {
  enabled?: boolean;
  timeframe?: string;
  symbol?: string;
  lookbackCandles?: number;
} = {}): {
  enabled?: boolean;
  timeframe?: string;
  symbol?: string;
  lookbackCandles?: number;
} {
  return {
    enabled: true,
    symbol: 'BTCUSDT',
    timeframe: '1',
    lookbackCandles: 100,
    ...overrides,
  };
}

export function createPublicWebSocketHarness(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  withErrorHandler?: boolean;
  btcConfirmation?: {
    enabled?: boolean;
    timeframe?: string;
    symbol?: string;
    lookbackCandles?: number;
  };
} = {}): PublicWebSocketHarness {
  const mockLogger = createMockPublicWebSocketLogger();
  const loggerService = mockLogger as unknown as LoggerService;
  const mockTimeframeProvider = createMockPublicWebSocketTimeframeProvider();
  const mockConfig = createMockPublicWebSocketConfig(options.configOverrides);
  const errorHandler = createMockPublicWebSocketErrorHandler(mockLogger);
  const errorHandlerService = errorHandler as unknown as ErrorHandler;
  const service =
    options.withErrorHandler === false
      ? createLegacyPublicWebSocketService({
          mockConfig,
          mockTimeframeProvider,
          loggerService,
          symbol: options.symbol ?? mockConfig.symbol,
          btcConfirmation: options.btcConfirmation,
        })
      : createStandardPublicWebSocketServiceFromOptions({
          mockConfig,
          mockTimeframeProvider,
          loggerService,
          errorHandlerService,
          symbol: options.symbol ?? mockConfig.symbol,
          btcConfirmation: options.btcConfirmation,
        });

  return {
    service,
    mockLogger,
    loggerService,
    mockTimeframeProvider,
    mockConfig,
    errorHandler,
    errorHandlerService,
    createStandardService: (overrides = {}) =>
      createStandardPublicWebSocketServiceFromOptions({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        errorHandlerService,
        symbol: overrides.symbol ?? 'XRPUSDT',
        btcConfirmation: overrides.btcConfirmation,
      }),
    createService: (overrides = {}) =>
      overrides.withErrorHandler === false
        ? createLegacyPublicWebSocketService({
            mockConfig,
            mockTimeframeProvider,
            loggerService,
            symbol: overrides.symbol,
            btcConfirmation: overrides.btcConfirmation,
          })
        : createStandardPublicWebSocketServiceFromOptions({
            mockConfig,
            mockTimeframeProvider,
            loggerService,
            errorHandlerService:
              overrides.errorHandlerService ?? errorHandlerService,
            symbol: overrides.symbol,
            btcConfirmation: overrides.btcConfirmation,
          }),
    createLegacyService: (overrides = {}) =>
      createLegacyPublicWebSocketService({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        symbol: overrides.symbol,
        btcConfirmation: overrides.btcConfirmation,
      }),
    createBtcConfiguredService: (overrides = {}) =>
      overrides.withErrorHandler === false
        ? createLegacyPublicWebSocketService({
            mockConfig,
            mockTimeframeProvider,
            loggerService,
            symbol: overrides.symbol,
            btcConfirmation:
              overrides.btcConfirmation ?? createPublicWebSocketBtcConfirmationConfig(),
          })
        : createStandardPublicWebSocketServiceFromOptions({
            mockConfig,
            mockTimeframeProvider,
            loggerService,
            errorHandlerService,
            symbol: overrides.symbol,
            btcConfirmation:
              overrides.btcConfirmation ?? createPublicWebSocketBtcConfirmationConfig(),
          }),
    createInjectedService: (overrides = {}) =>
      createStandardPublicWebSocketServiceFromOptions({
        mockConfig: overrides.mockConfig ?? mockConfig,
        mockTimeframeProvider: overrides.mockTimeframeProvider ?? mockTimeframeProvider,
        loggerService: overrides.loggerService ?? loggerService,
        errorHandlerService: overrides.errorHandlerService ?? errorHandlerService,
        symbol: overrides.symbol ?? (overrides.mockConfig ?? mockConfig).symbol,
        btcConfirmation: overrides.btcConfirmation,
      }),
  };
}

export function createManagedPublicWebSocketContext(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  withErrorHandler?: boolean;
  btcConfirmation?: {
    enabled?: boolean;
    timeframe?: string;
    symbol?: string;
    lookbackCandles?: number;
  };
} = {}): ManagedPublicWebSocketContext {
  const harness = createPublicWebSocketHarness(options);
  const trackedServices = new Set<PublicWebSocketService>([harness.service]);

  const trackService = (service: PublicWebSocketService): PublicWebSocketService => {
    trackedServices.add(service);
    return service;
  };

  return {
    ...harness,
    createStandardService: (overrides = {}) => trackService(harness.createStandardService(overrides)),
    createService: (overrides = {}) => trackService(harness.createService(overrides)),
    createLegacyService: (overrides = {}) => trackService(harness.createLegacyService(overrides)),
    createBtcConfiguredService: (overrides = {}) => trackService(harness.createBtcConfiguredService(overrides)),
    createInjectedService: (overrides = {}) => trackService(harness.createInjectedService(overrides)),
    cleanup: () => {
      for (const service of trackedServices) {
        service.disconnect();
      }
      trackedServices.clear();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.restoreAllMocks();
    },
  };
}

export function createPublicWebSocketService(
  options: PublicWebSocketServiceOptions,
): PublicWebSocketService {
  return new PublicWebSocketService(
    options.mockConfig,
    options.symbol ?? options.mockConfig.symbol,
    options.mockTimeframeProvider,
    options.loggerService,
    options.errorHandlerService,
    options.btcConfirmation,
  );
}

export function createStandardPublicWebSocketServiceFromOptions(
  options: PublicWebSocketServiceOptions,
): PublicWebSocketService {
  return createPublicWebSocketService({
    ...options,
    errorHandlerService: options.errorHandlerService,
  });
}

export function createLegacyPublicWebSocketService(
  options: Omit<PublicWebSocketServiceOptions, 'errorHandlerService'>,
): PublicWebSocketService {
  return createPublicWebSocketService({
    ...options,
    errorHandlerService: undefined,
  });
}

export function createStandardPublicWebSocketService(
  harness: Pick<
    PublicWebSocketHarness,
    'createService' | 'errorHandlerService'
  >,
  overrides: {
    symbol?: string;
    withErrorHandler?: boolean;
    btcConfirmation?: {
      enabled?: boolean;
      timeframe?: string;
      symbol?: string;
      lookbackCandles?: number;
    };
  } = {},
): PublicWebSocketService {
  return harness.createService({
    symbol: overrides.symbol ?? 'XRPUSDT',
    withErrorHandler: overrides.withErrorHandler,
    errorHandlerService:
      overrides.withErrorHandler === false ? undefined : harness.errorHandlerService,
    btcConfirmation: overrides.btcConfirmation,
  });
}
