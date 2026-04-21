import { ErrorHandler } from '../../errors';
import {
  FundingRateData,
  FundingRateFilterService,
} from '../../services/funding-rate-filter.service';
import {
  FundingRateFilterConfig,
  LoggerService,
  LogLevel,
} from '../../types/legacy';

export function createFundingRateFilterLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createFundingRateFilterConfig(
  overrides: Partial<FundingRateFilterConfig> = {},
): FundingRateFilterConfig {
  return {
    enabled: true,
    blockLongThreshold: 0.0005,
    blockShortThreshold: -0.0005,
    cacheTimeMs: 3600000,
    ...overrides,
  };
}

export function createFundingRateData(
  overrides: Partial<FundingRateData> = {},
): FundingRateData {
  return {
    fundingRate: 0.0001,
    timestamp: Date.now(),
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
    ...overrides,
  };
}

export function createFundingRateDataSeries(
  fundingRates: number[],
  startTime = Date.now(),
): FundingRateData[] {
  return fundingRates.map((fundingRate, index) =>
    createFundingRateData({
      fundingRate,
      timestamp: startTime + index * 1000,
      nextFundingTime: startTime + (8 * 60 * 60 * 1000) + index * 1000,
    }),
  );
}

export function createFundingRateFilterHarness(options: {
  configOverrides?: Partial<FundingRateFilterConfig>;
  logger?: LoggerService;
  getFundingRate?: jest.Mock<Promise<FundingRateData>>;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createFundingRateFilterLogger();
  const config = createFundingRateFilterConfig(options.configOverrides);
  const mockGetFundingRate = options.getFundingRate ?? jest.fn<Promise<FundingRateData>, []>();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createFundingRateFilterService({
    config,
    getFundingRate: mockGetFundingRate,
    logger,
    withErrorHandler: options.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    logger,
    config,
    mockGetFundingRate,
    errorHandler,
    createStandardFilter: (overrides: {
      config?: FundingRateFilterConfig;
      configOverrides?: Partial<FundingRateFilterConfig>;
      logger?: LoggerService;
      getFundingRate?: jest.Mock<Promise<FundingRateData>>;
      withErrorHandler?: boolean;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createFundingRateFilterService({
        config: overrides.config,
        configOverrides: overrides.config ? undefined : overrides.configOverrides,
        logger: overrides.logger ?? logger,
        getFundingRate: overrides.getFundingRate ?? mockGetFundingRate,
        withErrorHandler: overrides.withErrorHandler ?? options.withErrorHandler,
        errorHandler: overrides.errorHandler ?? errorHandler,
      }),
    createLegacyFilter: (overrides: {
      config?: FundingRateFilterConfig;
      configOverrides?: Partial<FundingRateFilterConfig>;
      logger?: LoggerService;
      getFundingRate?: jest.Mock<Promise<FundingRateData>>;
    } = {}) =>
      createFundingRateFilterService({
        config: overrides.config,
        configOverrides: overrides.config ? undefined : overrides.configOverrides,
        logger: overrides.logger ?? logger,
        getFundingRate: overrides.getFundingRate ?? mockGetFundingRate,
        withErrorHandler: false,
      }),
  };
}

export function createFundingRateFilterService(options: {
  config?: FundingRateFilterConfig;
  configOverrides?: Partial<FundingRateFilterConfig>;
  logger?: LoggerService;
  getFundingRate?: jest.Mock<Promise<FundingRateData>>;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): FundingRateFilterService {
  const logger = options.logger ?? createFundingRateFilterLogger();
  const config = options.config ?? createFundingRateFilterConfig(options.configOverrides);
  const getFundingRate = options.getFundingRate ?? jest.fn<Promise<FundingRateData>, []>();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new FundingRateFilterService(
    config,
    getFundingRate,
    logger,
    errorHandler,
  );
}

export interface ManagedFundingRateFilterContext {
  service: FundingRateFilterService;
  logger: LoggerService;
  config: FundingRateFilterConfig;
  mockGetFundingRate: FundingRateFilterMock;
  errorHandler?: ErrorHandler;
  createStandardFilter: ReturnType<typeof createFundingRateFilterHarness>['createStandardFilter'];
  createLegacyFilter: ReturnType<typeof createFundingRateFilterHarness>['createLegacyFilter'];
  cleanup: () => Promise<void>;
  reset: () => void;
}

export type FundingRateFilterMock = jest.Mock<Promise<FundingRateData>, []>;

export type FundingRateFilterRuntime = Pick<
  ManagedFundingRateFilterContext,
  'config' | 'mockGetFundingRate' | 'logger' | 'errorHandler'
>;

export type FundingRateFilterFactories = Pick<
  ManagedFundingRateFilterContext,
  'createStandardFilter' | 'createLegacyFilter' | 'cleanup'
>;

export type FundingRateFilterServiceState = Pick<
  ManagedFundingRateFilterContext,
  'config' | 'mockGetFundingRate' | 'createLegacyFilter' | 'cleanup'
>;

export type FundingRateFilterErrorHandlingState = Pick<
  ManagedFundingRateFilterContext,
  | 'logger'
  | 'config'
  | 'mockGetFundingRate'
  | 'errorHandler'
  | 'createStandardFilter'
  | 'createLegacyFilter'
  | 'cleanup'
>;

export function createManagedFundingRateFilterContext(options: {
  configOverrides?: Partial<FundingRateFilterConfig>;
  logger?: LoggerService;
  getFundingRate?: FundingRateFilterMock;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): ManagedFundingRateFilterContext {
  const harness = createFundingRateFilterHarness(options);
  const trackedServices = new Set<FundingRateFilterService>([harness.service]);

  return {
    ...harness,
    createStandardFilter: (overrides = {}) => {
      const service = harness.createStandardFilter(overrides);
      trackedServices.add(service);
      return service;
    },
    createLegacyFilter: (overrides = {}) => {
      const service = harness.createLegacyFilter(overrides);
      trackedServices.add(service);
      return service;
    },
    cleanup: async () => {
      for (const service of trackedServices) {
        await service.clearCache().catch(() => undefined);
      }
      trackedServices.clear();
      trackedServices.add(harness.service);
      jest.clearAllMocks();
    },
    reset: () => {
      jest.clearAllMocks();
    },
  };
}
