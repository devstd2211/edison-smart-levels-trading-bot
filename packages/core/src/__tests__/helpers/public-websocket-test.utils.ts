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
};

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
  const service = new PublicWebSocketService(
    mockConfig,
    options.symbol ?? mockConfig.symbol,
    mockTimeframeProvider,
    loggerService,
    options.withErrorHandler === false ? undefined : errorHandlerService,
    options.btcConfirmation,
  );

  return {
    service,
    mockLogger,
    loggerService,
    mockTimeframeProvider,
    mockConfig,
    errorHandler,
    errorHandlerService,
    createStandardService: (overrides = {}) =>
      createStandardPublicWebSocketService(
        {
          createService: (serviceOverrides = {}) =>
            createPublicWebSocketService({
              mockConfig,
              mockTimeframeProvider,
              loggerService,
              errorHandlerService:
                serviceOverrides.withErrorHandler === false
                  ? undefined
                  : serviceOverrides.errorHandlerService ?? errorHandlerService,
              symbol: serviceOverrides.symbol,
              btcConfirmation: serviceOverrides.btcConfirmation,
            }),
          errorHandlerService,
        },
        overrides,
      ),
    createService: (overrides = {}) =>
      createPublicWebSocketService({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        errorHandlerService:
          overrides.withErrorHandler === false
            ? undefined
            : overrides.errorHandlerService ?? errorHandlerService,
        symbol: overrides.symbol,
        btcConfirmation: overrides.btcConfirmation,
      }),
    createLegacyService: (overrides = {}) =>
      createPublicWebSocketService({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        errorHandlerService: undefined,
        symbol: overrides.symbol,
        btcConfirmation: overrides.btcConfirmation,
      }),
    createBtcConfiguredService: (overrides = {}) =>
      createStandardPublicWebSocketService(
        {
          createService: (serviceOverrides = {}) =>
            createPublicWebSocketService({
              mockConfig,
              mockTimeframeProvider,
              loggerService,
              errorHandlerService:
                serviceOverrides.withErrorHandler === false
                  ? undefined
                  : serviceOverrides.errorHandlerService ?? errorHandlerService,
              symbol: serviceOverrides.symbol,
              btcConfirmation: serviceOverrides.btcConfirmation,
            }),
          errorHandlerService,
        },
        {
          symbol: overrides.symbol,
          withErrorHandler: overrides.withErrorHandler,
          btcConfirmation: overrides.btcConfirmation ?? createPublicWebSocketBtcConfirmationConfig(),
        },
      ),
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
