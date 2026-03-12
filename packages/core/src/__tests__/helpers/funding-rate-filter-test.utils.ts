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
} = {}) {
  const logger = options.logger ?? createFundingRateFilterLogger();
  const config = createFundingRateFilterConfig(options.configOverrides);
  const mockGetFundingRate = options.getFundingRate ?? jest.fn<Promise<FundingRateData>, []>();
  const errorHandler = new ErrorHandler(logger);
  const service = new FundingRateFilterService(
    config,
    mockGetFundingRate,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    config,
    mockGetFundingRate,
    errorHandler,
  };
}
