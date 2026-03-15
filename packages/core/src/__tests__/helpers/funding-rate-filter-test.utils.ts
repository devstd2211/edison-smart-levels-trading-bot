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
