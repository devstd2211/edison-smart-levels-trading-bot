import { ICONS } from '../../cli/cli-runtime';
import type { LoggerService } from '../../types/legacy';
import { SignalDirection } from '../../types/legacy';
import {
  createFundingRateData,
  createManagedFundingRateFilterContext,
} from '../helpers/funding-rate-filter-test.utils';

function createMockLogger(): LoggerService {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

describe('FundingRateFilterService - Functional behavior', () => {
  it('blocks overheated longs, then reuses cached funding data with shared icons', async () => {
    const logger = createMockLogger();
    const { createStandardFilter, mockGetFundingRate, cleanup } =
      createManagedFundingRateFilterContext({ logger });

    try {
      mockGetFundingRate.mockResolvedValue(
        createFundingRateData({ fundingRate: 0.001 }),
      );

      const service = createStandardFilter();

      const firstResult = await service.checkSignal(SignalDirection.LONG);
      const secondResult = await service.checkSignal(SignalDirection.SHORT);

      expect(firstResult.allowed).toBe(false);
      expect(secondResult.allowed).toBe(true);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.plug} Fetching funding rate from API`,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.chart} Funding rate updated`,
        expect.objectContaining({
          fundingRate: '0.1000%',
        }),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        `${ICONS.warning} Funding Rate Filter: LONG blocked`,
        expect.objectContaining({
          reason: 'Funding too high (too many longs)',
        }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.chart} Using cached funding rate`,
        expect.objectContaining({
          cacheAge: expect.any(String),
        }),
      );
    } finally {
      await cleanup();
    }
  });
});
